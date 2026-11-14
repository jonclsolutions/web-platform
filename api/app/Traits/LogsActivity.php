<?php
/**
 * @file LogsActivity.php
 * @path app/Traits/LogsActivity.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared audit-logging helper of the core and the applications. Writes to
 * whichever log model is passed in (an AuditLog: CoreLog or the log of an application - the same
 * columns and an `'array'` cast on `context_data`). Centralizes truncation safety so an oversized description/context_data can
 * never itself throw and mask the original error. Each row also carries the data changes of the
 * request since the previous row (`changes`, App\Support\Audit\ModelChanges).
 */

namespace App\Traits;

use App\Support\Audit\ModelChanges;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

trait LogsActivity
{
    /**
     * @description Keys stripped from the logged payload regardless of endpoint - never
     * write credentials or tokens into an audit trail, even accidentally.
     */
    private const SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'user_password_hash',
        'user_password_salt',
        'token',
        'refreshToken',
        'refresh_token',
        'current_password',
        'confirm_password',
        'old_password',
        'new_password',
        'new_password_confirmation',
    ];

    /**
     * @description Logs an administrative action to the given audit-log model.
     * @param Request $request Current request instance (source of IP/user/payload).
     * @param string $logModel Fully-qualified log model class, e.g. CoreLog::class.
     * @param string $eventType Action type (create, update, delete, error, etc.).
     * @param string $module Domain module context (e.g. "WebSalesLead", "CoreRole").
     * @param string $description Human-readable audit message.
     * @param int|null $affectedId Entity identifier.
     * @param string|null $affectedType Entity class/type name.
     * @param array $extraExcludedKeys Additional request keys to strip from context_data
     *   for this specific call only (e.g. uploaded file fields like 'logo_file') - on top
     *   of the global SENSITIVE_KEYS list.
     * @note Never throws - a failure here must not mask or interrupt the original
     * controller action.
     */
    protected function logAction(
        Request $request,
        string $logModel,
        string $eventType,
        string $module,
        string $description,
        ?int $affectedId = null,
        ?string $affectedType = null,
        array $extraExcludedKeys = []
    ): void {
        try {
            $user = $request->user();

            $logModel::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => Str::limit($description, 990, '...'),
                'affected_entity_type' => $affectedType,
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => $this->withChanges($this->safeContextData($request, $extraExcludedKeys), $extraExcludedKeys),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'system',
            ]);
        } catch (\Throwable $e) {
            // Throwable, not only Exception: a missing log model / table (\Error) must not turn
            // the already finished action into a 500 either.
            Log::error("Log error ({$logModel}): " . $e->getMessage());
        }
    }

    /**
     * @description Builds a safe-to-store payload array from the request: strips
     * globally sensitive fields plus any call-specific extra fields, then caps overall
     * size so an oversized request body can never cause the log write itself to fail on
     * the `text` column limit.
     * @param Request $request
     * @param array $extraExcludedKeys
     * @return array
     */
    private function safeContextData(Request $request, array $extraExcludedKeys = []): array
    {
        $excluded = array_merge(self::SENSITIVE_KEYS, $extraExcludedKeys);
        $data = $this->withoutSecretKeys($this->describeUploadedFiles($request->except($excluded)));

        $encoded = json_encode($data, JSON_UNESCAPED_UNICODE);
        if ($encoded === false) {
            return ['_omitted' => true, 'note' => 'Payload could not be encoded as JSON and was omitted.'];
        }
        if (strlen($encoded) > 60000) {
            return ['_truncated' => true, 'note' => 'Payload exceeded 60000 bytes and was omitted.'];
        }

        return $data;
    }

    /**
     * @description Adds the data changes of the request since the last log row (ModelChanges:
     *   created values, updated `[old, new]`, deleted / restored) as `changes`, so the row shows
     *   what really changed in the database. Too large changes are dropped with a note.
     * @param array $context Safe request payload.
     * @param array $maskedKeys Per-call excluded keys - their values are masked in the changes too.
     * @return array
     */
    private function withChanges(array $context, array $maskedKeys = []): array
    {
        $changes = app(ModelChanges::class)->flush($maskedKeys);
        if ($changes === []) {
            return $context;
        }
        $encoded = json_encode($changes, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        $context['changes'] = $encoded !== false && strlen($encoded) <= 40000
            ? $changes
            : ['_omitted' => true, 'count' => count($changes)];

        return $context;
    }

    /**
     * @description Removes every key that names a secret (contains "password", "token" or
     *   "secret", any case), also in nested arrays - the safety net behind SENSITIVE_KEYS.
     * @param array $data Request payload.
     * @return array The payload without secret-looking keys.
     */
    private function withoutSecretKeys(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key) && preg_match('/password|token|secret/i', $key)) {
                unset($data[$key]);
            } elseif (is_array($value)) {
                $data[$key] = $this->withoutSecretKeys($value);
            }
        }

        return $data;
    }

    /**
     * @description Replaces uploaded files (also nested, e.g. `attachments[]`) by a short
     *   description - the file itself is never part of the audit log.
     * @param array $data Request payload.
     * @return array The payload with every UploadedFile replaced by {file, size}.
     */
    private function describeUploadedFiles(array $data): array
    {
        foreach ($data as $key => $value) {
            if ($value instanceof UploadedFile) {
                $data[$key] = ['file' => $value->getClientOriginalName(), 'size' => $value->getSize()];
            } elseif (is_array($value)) {
                $data[$key] = $this->describeUploadedFiles($value);
            }
        }

        return $data;
    }
}