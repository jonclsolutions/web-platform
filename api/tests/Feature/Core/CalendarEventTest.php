<?php

/**
 * @file CalendarEventTest.php
 * @path api/tests/Feature/Core/CalendarEventTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the personal events of the admin calendar
 *   (CoreCalendarEventController + agenda): create / edit / done / delete of own events without any
 *   permission, clean-up and validation, only the owner sees and changes them (404 for others),
 *   the agenda returns the own events of the range (open past = overdue), the audit log never
 *   contains the private texts, the limit per user.
 * @dependencies
 * - Tests\TestCase (InteractsWithAccounts); the clock frozen at 2026-11-11 10:00.
 */

namespace Tests\Feature\Core;

use App\Http\Controllers\Api\Core\CoreCalendarEventController;
use App\Models\Core\CoreCalendarEvent;
use App\Models\Core\CoreLog;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * @description POST / PUT / DELETE /api/core/calendar-events, GET /api/core/agenda (personal part).
 */
class CalendarEventTest extends TestCase
{
    /**
     * @description Freezes the clock.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-11 10:00:00');
    }

    /**
     * @description Unfreezes the clock.
     * @return void
     */
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * @description An admin without any permission creates, edits, marks done and deletes own
     *   events; texts are plain (tags removed, whitespace of the title collapsed, note lines kept).
     * @input POST with tags / spaces / two-line note and time; PUT is_done only; PUT title + no
     *   time; DELETE.
     * @output 201 agenda shape (personal-{id}, module personal, link null, time 09:30, note with
     *   line break); done true (title kept); time null; 204 and no row.
     */
    public function test_owner_manages_own_events(): void
    {
        $this->signIn($this->user());

        $created = $this->postJson('/api/core/calendar-events', [
            'date' => '2026-11-20', 'time' => '09:30', 'title' => '  <b>Zavolat</b>   účetní ', 'note' => "Řádek 1\r\nŘádek 2",
        ])->assertCreated()->json('data');
        $id = $created['personal']['id'];
        $this->assertSame(["personal-{$id}", 'personal', 'personal', '2026-11-20', 'Zavolat účetní', null], [$created['id'], $created['type'], $created['module'], $created['date'], $created['subject'], $created['link']]);
        $this->assertSame(['id' => $id, 'time' => '09:30', 'note' => "Řádek 1\nŘádek 2", 'done' => false], $created['personal']);

        $this->putJson("/api/core/calendar-events/{$id}", ['is_done' => true])->assertOk()
            ->assertJsonPath('data.personal.done', true)->assertJsonPath('data.subject', 'Zavolat účetní');
        $this->putJson("/api/core/calendar-events/{$id}", ['title' => 'Zavolat', 'time' => null])->assertOk()
            ->assertJsonPath('data.personal.time', null)->assertJsonPath('data.subject', 'Zavolat');

        $this->deleteJson("/api/core/calendar-events/{$id}")->assertNoContent();
        $this->assertSame(0, CoreCalendarEvent::count());
    }

    /**
     * @description Invalid input is refused.
     * @input Missing title / date; title of tags only; bad date / time; too long note; guest.
     * @output 422 with the field errors; 401 for a guest.
     */
    public function test_validation(): void
    {
        $this->postJson('/api/core/calendar-events', ['date' => '2026-11-20', 'title' => 'x'])->assertUnauthorized();

        $this->signIn($this->user());
        $this->postJson('/api/core/calendar-events', [])->assertStatus(422)->assertJsonValidationErrors(['date', 'title']);
        $this->postJson('/api/core/calendar-events', ['date' => '2026-11-20', 'title' => '<i></i>'])->assertStatus(422)->assertJsonValidationErrors(['title']);
        $this->postJson('/api/core/calendar-events', ['date' => '20.11.2026', 'time' => '25:00', 'title' => 'x', 'note' => str_repeat('a', 1001)])
            ->assertStatus(422)->assertJsonValidationErrors(['date', 'time', 'note']);
    }

    /**
     * @description Only the owner sees and changes an event; the agenda returns the own events of
     *   the range only, an open past one as overdue, a done past one not.
     * @input Events of A: 2026-11-05 open, 2026-11-06 done, 2026-11-20, 2027-02-01; of B: 2026-11-20.
     * @output B: PUT / DELETE of A's event 404; B's agenda: only B's event; A's agenda for November:
     *   3 personal events, severities [danger, info, info]; nothing of B.
     */
    public function test_events_are_private(): void
    {
        $a = $this->user();
        $b = $this->user();
        $own = fn ($user, $date, $done = false) => tap(new CoreCalendarEvent(['date' => $date, 'title' => "T {$date}", 'is_done' => $done]), function ($e) use ($user) {
            $e->user_id = $user->id;
            $e->save();
        });
        $first = $own($a, '2026-11-05');
        $own($a, '2026-11-06', true);
        $own($a, '2026-11-20');
        $own($a, '2027-02-01');
        $own($b, '2026-11-20');

        $this->signIn($b);
        $this->putJson("/api/core/calendar-events/{$first->id}", ['title' => 'hack'])->assertNotFound();
        $this->deleteJson("/api/core/calendar-events/{$first->id}")->assertNotFound();
        $this->assertSame(1, count(collect($this->getJson('/api/core/agenda?from=2026-10-26&to=2026-12-06')->json('data.events'))->where('module', 'personal')));

        $this->signIn($a);
        $personal = collect($this->getJson('/api/core/agenda?from=2026-10-26&to=2026-12-06')->json('data.events'))->where('module', 'personal')->values();
        $this->assertSame(['2026-11-05', '2026-11-06', '2026-11-20'], $personal->pluck('date')->all());
        $this->assertSame(['danger', 'info', 'info'], $personal->pluck('severity')->all());
        $this->assertSame('T 2026-11-05', CoreCalendarEvent::find($first->id)->title);
    }

    /**
     * @description The audit log records the action but never the private texts; the limit per
     *   user stops further events.
     * @input Create with title / note "secret"; MAX_EVENTS_PER_USER events, then one more.
     * @output CoreLog "Created personal calendar event #id" without "secret" anywhere; 422 at the limit.
     */
    public function test_log_and_limit(): void
    {
        $user = $this->signIn($this->user());
        $this->postJson('/api/core/calendar-events', ['date' => '2026-11-20', 'title' => 'secret title', 'note' => 'secret note'])->assertCreated();
        $log = CoreLog::where('module', 'CoreCalendarEvent')->latest('id')->firstOrFail();
        $this->assertStringStartsWith('Created personal calendar event #', $log->description);
        $this->assertStringNotContainsString('secret', json_encode($log->toArray()));

        $rows = array_fill(0, CoreCalendarEventController::MAX_EVENTS_PER_USER - 1, ['user_id' => $user->id, 'date' => '2026-11-20', 'title' => 'x', 'is_done' => false]);
        foreach (array_chunk($rows, 200) as $chunk) {
            CoreCalendarEvent::insert($chunk);
        }
        $this->postJson('/api/core/calendar-events', ['date' => '2026-11-21', 'title' => 'one more'])->assertStatus(422);
    }
}
