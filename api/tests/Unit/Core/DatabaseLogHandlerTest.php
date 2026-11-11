<?php

/**
 * @file DatabaseLogHandlerTest.php
 * @path api/tests/Unit/Core/DatabaseLogHandlerTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the `database` log channel (App\Logging\DatabaseLogHandler): log
 *   records in core_logs with level, request and exception details, secrets scrubbed, the level
 *   threshold, an unhandled exception (HTTP 500) of a request, the signed-in user, and that a
 *   missing table never breaks the application.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Unit\Core;

use App\Logging\DatabaseLogHandler;
use App\Models\Core\CoreLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

/**
 * @description App\Logging\DatabaseLogHandler.
 */
class DatabaseLogHandlerTest extends TestCase
{
    /**
     * @description An error with an exception and context: row in core_logs, secrets removed.
     * @input Log::channel('database')->error('Mail failed', {order: 5, password, nested.api_key,
     *   exception RuntimeException('smtp down')}).
     * @output event log_error, module Application, description 'Mail failed'; exception class /
     *   message / file of this test; context {order 5, nested []} without password / api_key.
     */
    public function test_error_with_exception_is_stored(): void
    {
        Log::channel('database')->error('Mail failed', [
            'order' => 5, 'password' => 'p', 'nested' => ['api_key' => 'k'], 'exception' => new RuntimeException('smtp down'),
        ]);

        $row = CoreLog::sole();
        $this->assertSame(['log_error', DatabaseLogHandler::MODULE, 'Mail failed'], [$row->event_type, $row->module, $row->description]);
        $this->assertSame('error', $row->context_data['level']);
        $this->assertSame(RuntimeException::class, $row->context_data['exception']['class']);
        $this->assertSame('smtp down', $row->context_data['exception']['message']);
        $this->assertStringStartsWith('tests/Unit/Core/DatabaseLogHandlerTest.php:', $row->context_data['exception']['file']);
        $this->assertSame(['order' => 5, 'nested' => []], $row->context_data['context']);
        $this->assertSame('system', $row->user_plain);
    }

    /**
     * @description Records below the channel level (info) are not stored; info is.
     * @input debug 'noise'; info 'Purge finished'.
     * @output one row log_info.
     */
    public function test_level_threshold(): void
    {
        Log::channel('database')->debug('noise');
        Log::channel('database')->info('Purge finished', ['deleted' => 3]);

        $this->assertSame(['log_info'], CoreLog::pluck('event_type')->all());
    }

    /**
     * @description An unhandled exception of a request (HTTP 500) is reported to the core log with
     *   the request and the signed-in user.
     * @input default log channel = database; route GET api/test-boom throwing RuntimeException;
     *   signed-in user calls it.
     * @output 500; row log_error with exception RuntimeException 'kaput', request GET
     *   api/test-boom, user of the request.
     */
    public function test_unhandled_exception_of_a_request(): void
    {
        config(['logging.default' => 'database']);
        app('log')->forgetChannel();
        Route::get('api/test-boom', fn () => throw new RuntimeException('kaput'))->middleware('auth:sanctum');
        $user = $this->user();
        $this->signIn($user);

        $this->getJson('/api/test-boom')->assertStatus(500);

        $row = CoreLog::where('event_type', 'log_error')->sole();
        $this->assertSame('kaput', $row->context_data['exception']['message']);
        $this->assertSame(['GET', 'api/test-boom'], [$row->context_data['request']['method'], $row->context_data['request']['path']]);
        $this->assertSame($user->id, $row->user_id);
        $this->assertSame($user->user_email, $row->user_plain);
    }

    /**
     * @description A failing write (no table) is swallowed - the application keeps running.
     * @input core_logs dropped; error logged.
     * @output no exception.
     */
    public function test_missing_table_never_throws(): void
    {
        Schema::drop('core_logs');

        Log::channel('database')->error('still fine');

        $this->assertFalse(Schema::hasTable('core_logs'));
    }

    /**
     * @description Details of an exception and of the context: at most 15 application frames, the
     *   previous exception, long strings cut, objects as class names (a Throwable with its message).
     * @input Exception thrown 20 calls deep with a previous one; context {long: 3000 × a, obj: stdClass,
     *   err: LogicException('inner')}.
     * @output trace of 15 frames; previous 'InvalidArgumentException: root'; long cut to 2000 + '...';
     *   obj 'stdClass'; err 'LogicException: inner'.
     */
    public function test_exception_and_context_details(): void
    {
        $deep = function (int $n) use (&$deep) {
            if ($n === 0) {
                throw new RuntimeException('deep', 0, new \InvalidArgumentException('root'));
            }
            $deep($n - 1);
        };
        try {
            $deep(20);
        } catch (RuntimeException $e) {
            Log::channel('database')->error('Deep failure', ['exception' => $e, 'long' => str_repeat('a', 3000), 'obj' => new \stdClass(), 'err' => new \LogicException('inner')]);
        }

        $data = CoreLog::sole()->context_data;
        $this->assertCount(15, $data['exception']['trace']);
        $this->assertSame('InvalidArgumentException: root', $data['exception']['previous']);
        $this->assertSame(2003, strlen($data['context']['long']));
        $this->assertSame(['stdClass', 'LogicException: inner'], [$data['context']['obj'], $data['context']['err']]);
    }

    /**
     * @description A too large context is dropped (with a note) instead of failing the insert.
     * @input 40 context values of 2000 characters (> 60000 bytes); the same with an exception.
     * @output context missing, _truncated true, level kept; the exception kept with ≤ 5 frames.
     */
    public function test_oversized_context_is_truncated(): void
    {
        Log::channel('database')->warning('Big', array_fill(0, 40, str_repeat('b', 2000)));
        Log::channel('database')->error('Big with exception', ['exception' => new RuntimeException('x')] + array_fill(0, 40, str_repeat('c', 2000)));

        [$plain, $withException] = CoreLog::orderBy('id')->get()->all();
        $this->assertArrayNotHasKey('context', $plain->context_data);
        $this->assertTrue($plain->context_data['_truncated']);
        $this->assertSame('warning', $plain->context_data['level']);
        $this->assertTrue($withException->context_data['_truncated']);
        $this->assertSame('x', $withException->context_data['exception']['message']);
        $this->assertLessThanOrEqual(5, count($withException->context_data['exception']['trace']));
    }

    /**
     * @description Outside a request (artisan command, scheduler) the row names the command and
     *   origin "console"; a failing auth guard leaves the user empty; a log record written while
     *   a row is being stored (a query listener) never loops.
     * @input environment 'local' (not the test runner); Auth::guard throws; DB::listen logging again.
     * @output one row: origin console, `console` key, user_plain system.
     */
    public function test_console_failing_guard_and_no_loop(): void
    {
        $this->app['env'] = 'local';
        Auth::shouldReceive('guard')->andThrow(new RuntimeException('guard down'));
        DB::listen(function ($query) {
            if (str_contains($query->sql, 'core_logs')) {
                Log::channel('database')->error('nested');
            }
        });

        Log::channel('database')->notice('From a command');
        $this->app['env'] = 'testing';

        $row = CoreLog::sole();
        $this->assertSame(['console', 'system'], [$row->origin, $row->user_plain]);
        $this->assertArrayHasKey('console', $row->context_data);
        $this->assertArrayNotHasKey('request', $row->context_data);
    }
}
