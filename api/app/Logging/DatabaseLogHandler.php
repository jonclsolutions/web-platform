<?php
/**
 * @file DatabaseLogHandler.php
 * @path app/Logging/DatabaseLogHandler.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Monolog handler of the `database` log channel: every application log record (by
 * default level info and higher - Log::info / warning / error, reported exceptions = HTTP 500,
 * failures of commands, jobs and e-mails) is also written to the core audit log (`core_logs`), so in
 * production the admin's Core → Logs is the one place to trace what happened. The file log stays as
 * a fallback.
 * @note Row: event_type = `log_<level>` (`log_error` with an exception), module `Application`,
 *   description = the message, context_data = {level, request {method, path, route, query keys},
 *   exception {class, message, code, file, line, trace (application frames)}, context (scrubbed)}.
 *   Keys naming a secret (password / token / secret / authorization / cookie) are removed, values
 *   are cut, the whole context is capped. The write never throws and never logs itself (a failing
 *   database must not hide the original error or loop).
 * @dependencies core_logs table, Monolog 3.
 */

namespace App\Logging;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\LogRecord;
use Throwable;

class DatabaseLogHandler extends AbstractProcessingHandler
{
    /** @description Module of the rows (Core → Logs filter). */
    public const MODULE = 'Application';

    /** @description Keys whose value is never stored (case-insensitive, also nested). */
    private const SECRET_KEY_PATTERN = '/password|token|secret|authorization|cookie|api[_-]?key/i';

    /** @description Longest stored context (JSON bytes) - the column is a TEXT. */
    private const CONTEXT_MAX_BYTES = 60000;

    /** @description Application stack frames kept of an exception. */
    private const TRACE_FRAMES = 15;

    /** @var bool Guard against logging from inside a write (a failing insert logs again). */
    private static bool $writing = false;

    /**
     * @description Writes one log record to core_logs.
     * @param LogRecord $record Monolog record.
     * @return void
     */
    protected function write(LogRecord $record): void
    {
        if (self::$writing) {
            return;
        }
        self::$writing = true;

        try {
            $context = $record->context;
            $exception = $context['exception'] ?? null;
            unset($context['exception']);
            $user = $this->user();
            $request = app()->runningInConsole() && !app()->runningUnitTests() ? null : request();

            $data = ['level' => strtolower($record->level->getName())];
            if ($request !== null) {
                $data['request'] = [
                    'method' => $request->method(),
                    'path'   => $request->path(),
                    'route'  => $request->route()?->uri(),
                    'query'  => array_keys($request->query()),
                ];
            } else {
                $data['console'] = implode(' ', array_slice($_SERVER['argv'] ?? [], 1, 4));
            }
            if ($exception instanceof Throwable) {
                $data['exception'] = $this->describeException($exception);
            }
            if ($context !== []) {
                $data['context'] = $this->scrub($context);
            }

            DB::table('core_logs')->insert([
                'created_at'           => now(),
                'origin'               => $request?->ip() ?? 'console',
                'event_type'           => Str::limit('log_' . $data['level'], 50, ''),
                'module'               => self::MODULE,
                'description'          => Str::limit($record->message !== '' ? $record->message : ($data['exception']['message'] ?? '-'), 990, '...'),
                'affected_entity_type' => null,
                'affected_entity_id'   => null,
                'user_id'              => $user?->id,
                'context_data'         => $this->encode($data),
                'user_id_plain'        => (string) ($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'system',
            ]);
        } catch (Throwable) {
            // The database is not reachable / the table is missing: the file log has the record.
        } finally {
            self::$writing = false;
        }
    }

    /**
     * @description Signed-in user of the request, null in the console or when the guard fails.
     * @return \App\Models\User|null
     */
    private function user(): ?object
    {
        try {
            return Auth::guard('sanctum')->user() ?? Auth::user();
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @description Class, message, code, origin and the application frames of an exception (and of
     *   its previous one).
     * @param Throwable $e Exception.
     * @return array<string, mixed>
     */
    private function describeException(Throwable $e): array
    {
        $frames = [];
        foreach ($e->getTrace() as $frame) {
            $file = $frame['file'] ?? '';
            if ($file === '' || str_contains($file, DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR)) {
                continue;
            }
            $frames[] = $this->relative($file) . ':' . ($frame['line'] ?? 0) . ' ' . ($frame['class'] ?? '') . ($frame['type'] ?? '') . ($frame['function'] ?? '');
            if (count($frames) >= self::TRACE_FRAMES) {
                break;
            }
        }

        $described = [
            'class'   => $e::class,
            'message' => Str::limit($e->getMessage(), 2000),
            'code'    => $e->getCode(),
            'file'    => $this->relative($e->getFile()) . ':' . $e->getLine(),
            'trace'   => $frames,
        ];
        if ($e->getPrevious() !== null) {
            $described['previous'] = $e->getPrevious()::class . ': ' . Str::limit($e->getPrevious()->getMessage(), 500);
        }

        return $described;
    }

    /**
     * @description Removes secret-looking keys (recursively) and cuts long values.
     * @param array<mixed> $data Context.
     * @return array<mixed>
     */
    private function scrub(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key) && preg_match(self::SECRET_KEY_PATTERN, $key)) {
                unset($data[$key]);
            } elseif (is_array($value)) {
                $data[$key] = $this->scrub($value);
            } elseif (is_string($value)) {
                $data[$key] = Str::limit($value, 2000);
            } elseif (is_object($value)) {
                $data[$key] = $value instanceof Throwable ? $value::class . ': ' . Str::limit($value->getMessage(), 500) : $value::class;
            }
        }

        return $data;
    }

    /**
     * @description JSON of the context, replaced by a note when too large or not encodable.
     * @param array<mixed> $data Context.
     * @return string
     */
    private function encode(array $data): string
    {
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
        if ($json === false || strlen($json) > self::CONTEXT_MAX_BYTES) {
            unset($data['context']);
            if (isset($data['exception'])) {
                $data['exception']['trace'] = array_slice($data['exception']['trace'], 0, 5);
            }
            $data['_truncated'] = true;
            $json = (string) json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
        }

        return $json;
    }

    /**
     * @description Path relative to the application root (no server paths in the admin).
     * @param string $path Absolute path.
     * @return string
     */
    private function relative(string $path): string
    {
        return ltrim(Str::after($path, base_path()), DIRECTORY_SEPARATOR);
    }
}
