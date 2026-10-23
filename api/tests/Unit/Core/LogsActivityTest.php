<?php

/**
 * @file LogsActivityTest.php
 * @path api/tests/Unit/Core/LogsActivityTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the LogsActivity trait (audit log writer): actor and IP,
 *   credentials never logged, per-call excluded keys, uploaded files (name + size only),
 *   oversized / unencodable payloads, and that a failing log write never breaks the calling action.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Unit\Core;

use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * @description App\Traits\LogsActivity.
 */
class LogsActivityTest extends TestCase
{
    /**
     * @description Calls the protected logAction() of an object using the trait.
     * @param Request $request Request to log.
     * @param string $description Log text.
     * @param array<int, string> $extraExcluded Extra keys to strip.
     * @return void
     */
    private function log(Request $request, string $description = 'Did something', array $extraExcluded = []): void
    {
        $logger = new class {
            use LogsActivity;

            /** Exposes logAction() to the test. */
            public function write(...$args): void
            {
                $this->logAction(...$args);
            }
        };

        $logger->write($request, CoreLog::class, 'update', 'User', $description, 7, 'User', $extraExcluded);
    }

    /**
     * @description A row carries the actor, IP, entity and the payload without credentials
     *   and without the per-call excluded keys.
     * @input Signed-in request with name, password, token, refreshToken, new_password, logo_file;
     *        extra excluded ['logo_file'].
     * @output context_data {name}; user_id / user_plain of the actor; affected entity 7 / User.
     */
    public function test_writes_row_without_sensitive_keys(): void
    {
        $actor = $this->user();
        $request = Request::create('/x', 'POST', [
            'name' => 'Jo', 'password' => 'p', 'token' => 't', 'refreshToken' => 'r', 'new_password' => 'n', 'logo_file' => 'f',
        ]);
        $request->setUserResolver(fn () => $actor);

        $this->log($request, 'Did something', ['logo_file']);

        $row = CoreLog::sole();
        $this->assertSame(['name' => 'Jo'], $row->context_data);
        $this->assertSame($actor->id, $row->user_id);
        $this->assertSame($actor->user_email, $row->user_plain);
        $this->assertSame((string) $actor->id, $row->user_id_plain);
        $this->assertSame(7, (int) $row->affected_entity_id);
        $this->assertSame('User', $row->affected_entity_type);
        $this->assertSame('127.0.0.1', $row->origin);
    }

    /**
     * @description Without a user the actor is 'system' / '0'; a long description is cut;
     *   an oversized payload is replaced by a marker.
     * @input Anonymous request with a 70 000-byte field; description 2000 chars.
     * @output user_plain 'system', user_id_plain '0'; description 993 chars ending '...';
     *   context_data {_truncated: true, note}.
     */
    public function test_anonymous_long_and_oversized(): void
    {
        $this->log(Request::create('/x', 'POST', ['blob' => str_repeat('a', 70000)]), str_repeat('d', 2000));

        $row = CoreLog::sole();
        $this->assertSame('system', $row->user_plain);
        $this->assertSame('0', $row->user_id_plain);
        $this->assertSame(993, mb_strlen($row->description));
        $this->assertStringEndsWith('...', $row->description);
        $this->assertTrue($row->context_data['_truncated']);
    }

    /**
     * @description Uploaded files (also nested in arrays) are logged as name + size only, so a
     *   request with attachments is still written to the audit log; a payload that cannot be
     *   encoded as JSON is replaced by a marker instead of losing the whole row.
     * @input Request {thema, cv (3 KB), attachments: [a.pdf 1 KB]}; request with invalid UTF-8 "\xB1".
     * @output context_data {thema, cv: {file cv.pdf, size 3072}, attachments: [{file a.pdf, size 1024}]};
     *   second row context_data {_omitted: true, note}.
     */
    public function test_uploaded_files_and_unencodable_payload(): void
    {
        $request = Request::create('/x', 'POST', ['thema' => 'Web'], [], [
            'cv' => UploadedFile::fake()->create('cv.pdf', 3),
            'attachments' => [UploadedFile::fake()->create('a.pdf', 1)],
        ]);

        $this->log($request);
        $this->log(Request::create('/x', 'POST', ['name' => "\xB1"]));

        [$files, $broken] = CoreLog::orderBy('id')->get()->all();
        $this->assertSame([
            'thema' => 'Web',
            'cv' => ['file' => 'cv.pdf', 'size' => 3072],
            'attachments' => [['file' => 'a.pdf', 'size' => 1024]],
        ], $files->context_data);
        $this->assertTrue($broken->context_data['_omitted']);
    }

    /**
     * @description A failing log write is swallowed and reported to the application log.
     * @input core_logs INSERT fails.
     * @output No exception; Log::error "Log error (App\Models\Core\CoreLog)".
     */
    public function test_failure_never_throws(): void
    {
        Log::spy();
        $this->failOn('core_logs', 'INSERT');

        $this->log(Request::create('/x', 'POST'));

        Log::shouldHaveReceived('error')->withArgs(fn ($message) => str_starts_with($message, 'Log error (' . CoreLog::class . ')'));
        $this->assertSame(0, CoreLog::count());
    }
}
