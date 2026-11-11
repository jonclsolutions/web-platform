<?php

/**
 * @file LogsActivityTest.php
 * @path api/tests/Unit/Core/LogsActivityTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the LogsActivity trait (audit log writer): actor and IP,
 *   credentials never logged, per-call excluded keys, uploaded files (name + size only),
 *   oversized / unencodable payloads, and that a failing log write never breaks the calling action.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Unit\Core;

use App\Models\Core\CoreLog;
use App\Models\Core\CoreCalendarEvent;
use App\Models\Core\CoreRole;
use App\Support\Audit\ModelChanges;
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
     * @param string $logModel Log model class.
     * @return void
     */
    private function log(Request $request, string $description = 'Did something', array $extraExcluded = [], string $logModel = CoreLog::class): void
    {
        $logger = new class {
            use LogsActivity;

            /** Exposes logAction() to the test. */
            public function write(...$args): void
            {
                $this->logAction(...$args);
            }
        };

        $logger->write($request, $logModel, 'update', 'User', $description, 7, 'User', $extraExcluded);
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
        app(ModelChanges::class)->flush(); // the fixture account is not part of this row

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

    /**
     * @description A log model that does not exist (a removed module) is an \Error, not an
     *   \Exception - it is swallowed too, the calling action never answers 500 because of it.
     * @input logAction() with the class name 'App\Models\Missing\MissingLog'.
     * @output No exception; Log::error "Log error (App\Models\Missing\MissingLog)".
     */
    public function test_missing_log_model_never_throws(): void
    {
        Log::spy();

        $this->log(Request::create('/x', 'POST'), logModel: 'App\\Models\\Missing\\MissingLog');

        Log::shouldHaveReceived('error')->withArgs(fn ($message) => str_starts_with($message, 'Log error (App\\Models\\Missing\\MissingLog)'));
    }

    /**
     * @description A row carries the data changes since the previous row: created values, updated
     *   [old, new], soft delete / restore; personal data (AUDIT_MASKED) and the per-call private
     *   keys only as [masked]; timestamps and hidden / secret attributes never; the next row starts
     *   empty.
     * @input Calendar event created (title, note masked); updated title + date + time + is_done with
     *   the private key 'time'; role soft-deleted and restored; second log call.
     * @output changes: created (title [masked], date), updated title [masked, masked], date
     *   [old, new], time [masked, masked] (private key), is_done [false, true]; role soft_deleted,
     *   updated (deleted_at → null) + restored; no updated_at; no title text anywhere; second row without changes.
     */
    public function test_rows_carry_the_data_changes(): void
    {
        $owner = $this->user();
        $role = CoreRole::create(['role_name' => 'temp']);
        app(ModelChanges::class)->flush();
        $event = new CoreCalendarEvent(['date' => '2026-11-20', 'title' => 'Doctor', 'note' => 'private', 'is_done' => false]);
        $event->user_id = $owner->id;
        $event->save();
        $event->update(['title' => 'Dentist', 'date' => '2026-11-21', 'time' => '09:30', 'is_done' => true]);
        $role->delete();
        $role->restore();

        $this->log(Request::create('/x', 'POST'), 'Changed', ['time']);
        $this->log(Request::create('/x', 'POST'), 'Nothing');

        [$first, $second] = CoreLog::orderBy('id')->get()->all();
        $changes = $first->context_data['changes'];
        $this->assertSame(['created', 'updated', 'soft_deleted', 'updated', 'restored'], array_column($changes, 'event'));
        $this->assertNull($changes[3]['changes']['deleted_at'][1]);
        $this->assertSame([ModelChanges::MASK, ModelChanges::MASK, '2026-11-20'], [$changes[0]['values']['title'], $changes[0]['values']['note'], $changes[0]['values']['date']]);
        $this->assertSame([ModelChanges::MASK, ModelChanges::MASK], $changes[1]['changes']['title']);
        $this->assertSame([ModelChanges::MASK, ModelChanges::MASK], $changes[1]['changes']['time']);
        $this->assertSame(['2026-11-20', '2026-11-21'], $changes[1]['changes']['date']);
        $this->assertEquals([false, true], $changes[1]['changes']['is_done']);
        $this->assertArrayNotHasKey('updated_at', $changes[1]['changes']);
        $this->assertSame(['CoreRole', $role->id], [$changes[2]['model'], $changes[2]['id']]);
        $this->assertStringNotContainsString('Dentist', json_encode($first->context_data));
        $this->assertStringNotContainsString('Doctor', json_encode($first->context_data));
        $this->assertSame([], $second->context_data);
    }

    /**
     * @description At most MAX_ENTRIES changes are kept per row, the rest is counted; the log
     *   models themselves are never collected.
     * @input MAX_ENTRIES + 3 roles created; a core log row created.
     * @output MAX_ENTRIES entries + {_more: 3}; no CoreLog entry.
     */
    public function test_changes_are_capped(): void
    {
        app(ModelChanges::class)->flush();
        for ($i = 0; $i < ModelChanges::MAX_ENTRIES + 3; $i++) {
            CoreRole::create(['role_name' => "role-cap-{$i}"]);
        }
        CoreLog::create(['event_type' => 'x', 'module' => 'x', 'description' => 'x']);

        $changes = app(ModelChanges::class)->flush();
        $this->assertCount(ModelChanges::MAX_ENTRIES + 1, $changes);
        $this->assertSame(['_more' => 3], end($changes));
    }

    /**
     * @description Edge cases of the collector: an update changing only skipped attributes (a
     *   touch) is not noted; non-string values are stored as JSON / formatted dates.
     * @input Role touched (updated_at only); record('created') of a model whose raw attributes are an
     *   array and a DateTime.
     * @output no entry for the touch; values meta '{"a":1}', when '2026-01-02 03:04:05'.
     */
    public function test_collector_edge_cases(): void
    {
        $role = CoreRole::create(['role_name' => 'touch-me']);
        $collector = app(ModelChanges::class);
        $collector->flush();
        $this->travel(1)->minutes();
        $role->touch();
        $this->assertSame([], $collector->flush());

        $model = new CoreRole();
        $model->setRawAttributes(['meta' => ['a' => 1], 'when' => new \DateTime('2026-01-02 03:04:05')]);
        $collector->record('created', $model);
        $this->assertSame(['meta' => '{"a":1}', 'when' => '2026-01-02 03:04:05'], $collector->flush()[0]['values']);
    }

    /**
     * @description Changes too large for the row (> 40 000 bytes) are replaced by a note with their
     *   count - the row itself is still written.
     * @input 100 roles with a 480-character description; log call.
     * @output changes {_omitted: true, count: 100}.
     */
    public function test_too_large_changes_are_omitted(): void
    {
        app(ModelChanges::class)->flush();
        for ($i = 0; $i < 100; $i++) {
            CoreRole::create(['role_name' => "big-{$i}", 'description' => str_repeat('d', 480)]);
        }

        $this->log(Request::create('/x', 'POST'));

        $this->assertSame(['_omitted' => true, 'count' => 100], CoreLog::sole()->context_data['changes']);
    }
}
