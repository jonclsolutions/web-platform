<?php

/**
 * @file SecurityMonitoringTest.php
 * @path api/tests/Feature/Core/SecurityMonitoringTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the security monitoring administration
 *   (CoreSecurityEventController, CoreSecuritySettingController): list with filters,
 *   detail, triage, delete, purge by retention, chart statistics and the retention setting.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core;

use App\Models\Core\CoreSecurityEvent;
use App\Models\Core\CoreSecuritySetting;
use Tests\TestCase;

/**
 * @description /api/core/security_events and /api/core/security_settings.
 */
class SecurityMonitoringTest extends TestCase
{
    /**
     * @description Inserts a security event row directly (bypassing the bucketing).
     * @param array<string, mixed> $attributes Column overrides.
     * @return CoreSecurityEvent
     */
    private function event(array $attributes = []): CoreSecurityEvent
    {
        static $n = 0;
        $n++;

        return CoreSecurityEvent::create(array_merge([
            'fingerprint' => hash('sha256', "event-{$n}"), 'event_type' => 'login_failed', 'severity' => 'warning',
            'ip_address' => '10.0.0.1', 'occurrences' => 1, 'first_seen_at' => now(), 'last_seen_at' => now(), 'status' => 'new',
        ], $attributes));
    }

    /**
     * @description Signs in an account with the given security permissions.
     * @param string[] $permissions Permission keys (core-security-view/update/delete).
     * @return void
     */
    private function securityAdmin(array $permissions = ['core-security-view', 'core-security-update', 'core-security-delete']): void
    {
        $this->signIn($this->userWith($permissions));
    }

    /**
     * @description The list needs core-security-view.
     * @input Account without permissions, GET /api/core/security_events.
     * @output 403.
     */
    public function test_index_requires_permission(): void
    {
        $this->signIn($this->user());

        $this->getJson('/api/core/security_events')->assertStatus(403);
    }

    /**
     * @description The list is paginated, newest last_seen_at first by default.
     * @input Events seen yesterday and today, GET ?per_page=1.
     * @output 200 {total 2, last_page 2}; first row = today's event.
     */
    public function test_index_default_order_and_pagination(): void
    {
        $this->securityAdmin(['core-security-view']);
        $this->event(['last_seen_at' => now()->subDay()]);
        $today = $this->event();

        $this->getJson('/api/core/security_events?per_page=1')
            ->assertOk()
            ->assertJson(['meta' => ['total' => 2, 'per_page' => 1, 'current_page' => 1, 'last_page' => 2]])
            ->assertJsonPath('data.0.id', $today->id);
    }

    /**
     * @description Every filter narrows the list (id, event_type, severity, status, IP part, date range).
     * @input Two different events; one request per filter.
     * @output Each filter returns exactly the matching event.
     */
    public function test_index_filters(): void
    {
        $this->securityAdmin(['core-security-view']);
        $a = $this->event(['event_type' => 'scan_probe', 'severity' => 'critical', 'status' => 'reviewed', 'ip_address' => '192.168.1.5', 'last_seen_at' => now()->subDays(5)]);
        $b = $this->event();

        foreach ([
            "id={$a->id}", 'event_type=scan_probe', 'severity=critical', 'status=reviewed', 'ip_address=168.1',
            'date_to=' . urlencode(now()->subDays(4)->toDateTimeString()),
        ] as $filter) {
            $this->getJson("/api/core/security_events?{$filter}")->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $a->id);
        }
        $this->getJson('/api/core/security_events?date_from=' . urlencode(now()->subDay()->toDateTimeString()))
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $b->id);
    }

    /**
     * @description no_pagination returns all rows (export) in the requested order.
     * @input Two events, GET ?no_pagination=true&sort_by=id&sort_direction=asc.
     * @output Plain array of both, ascending id.
     */
    public function test_index_export(): void
    {
        $this->securityAdmin(['core-security-view']);
        $a = $this->event();
        $b = $this->event();

        $this->getJson('/api/core/security_events?no_pagination=true&sort_by=id&sort_direction=asc')
            ->assertOk()->assertJsonPath('data.*.id', [$a->id, $b->id]);
    }

    /**
     * @description The detail returns the event incl. decoded context; unknown id is 404.
     * @input Event with context_data, GET /{id} and /999.
     * @output 200 with context_data object; 404.
     */
    public function test_show(): void
    {
        $this->securityAdmin(['core-security-view']);
        $event = $this->event(['context_data' => ['route' => 'api/login']]);

        $this->getJson("/api/core/security_events/{$event->id}")
            ->assertOk()->assertJsonPath('data.context_data.route', 'api/login');
        $this->getJson('/api/core/security_events/999')->assertStatus(404);
    }

    /**
     * @description Triage changes status and note (wrapped in {data}); invalid status is refused;
     *   it needs core-security-update.
     * @input PUT {status:'false_positive', notes} with update permission; PUT {status:'bogus'};
     *        PATCH without update permission.
     * @output 200 {data.status}; core log; 422; 403.
     */
    public function test_update_triage(): void
    {
        $this->securityAdmin();
        $event = $this->event();

        $this->putJson("/api/core/security_events/{$event->id}", ['status' => 'false_positive', 'notes' => 'ok'])
            ->assertOk()->assertJsonPath('data.status', 'false_positive')->assertJsonPath('data.notes', 'ok');
        $this->assertCoreLog('security_event_triaged', "from status 'new' to 'false_positive'");

        $this->patchJson("/api/core/security_events/{$event->id}", ['status' => 'bogus'])->assertStatus(422);

        $this->securityAdmin(['core-security-view']);
        $this->patchJson("/api/core/security_events/{$event->id}", ['status' => 'reviewed'])->assertStatus(403);
    }

    /**
     * @description A single event can be deleted (e.g. GDPR request).
     * @input DELETE /{id}.
     * @output 200; row gone; security_event_deleted log with type and IP.
     */
    public function test_destroy(): void
    {
        $this->securityAdmin();
        $event = $this->event();

        $this->deleteJson("/api/core/security_events/{$event->id}")->assertOk();

        $this->assertNull($event->fresh());
        $this->assertCoreLog('security_event_deleted', 'login_failed, IP: 10.0.0.1');
    }

    /**
     * @description The purge deletes events older than the retention period only.
     * @input Retention 30 days; events seen 31 and 29 days ago; DELETE /purge.
     * @output 200 {deleted:1}; the recent event stays; security_events_purged log.
     */
    public function test_purge_uses_retention(): void
    {
        $this->securityAdmin();
        CoreSecuritySetting::current()->update(['retention_days' => 30]);
        $old = $this->event(['last_seen_at' => now()->subDays(31)]);
        $recent = $this->event(['last_seen_at' => now()->subDays(29)]);

        $this->deleteJson('/api/core/security_events/purge')
            ->assertOk()->assertJson(['message' => 'Deleted 1 records older than 30 days.', 'data' => ['deleted' => 1]]);

        $this->assertNull($old->fresh());
        $this->assertNotNull($recent->fresh());
        $this->assertCoreLog('security_events_purged');
    }

    /**
     * @description The chart statistics sum occurrences per day and severity within the window.
     * @input Today: 2 warning events (3 + 4 occurrences), 1 critical (2); 20 days ago 1 warning; GET /stats?days=7.
     * @output 200 {data: [{day: today, severity: critical, total: 2}, {…warning, total: 7}]} as integers.
     */
    public function test_stats(): void
    {
        $this->securityAdmin(['core-security-view']);
        $this->event(['occurrences' => 3]);
        $this->event(['occurrences' => 4]);
        $this->event(['occurrences' => 2, 'severity' => 'critical']);
        $this->event(['occurrences' => 9, 'last_seen_at' => now()->subDays(20)]);

        $rows = collect($this->getJson('/api/core/security_events/stats?days=7')->assertOk()->json('data'))
            ->sortBy('severity')->values()->all();

        $this->assertSame([
            ['day' => now()->toDateString(), 'severity' => 'critical', 'total' => 2],
            ['day' => now()->toDateString(), 'severity' => 'warning', 'total' => 7],
        ], $rows);
    }

    /**
     * @description The retention setting: show (singleton created with 90 days), update within
     *   7–365 (wrapped in {data}), out of range refused.
     * @input GET settings; PUT {retention_days:30}; PUT {retention_days:3}.
     * @output 90; 200 {data.retention_days:30} + log "from 90 to 30"; 422.
     */
    public function test_retention_setting(): void
    {
        $this->securityAdmin();

        $this->getJson('/api/core/security_settings')->assertOk()->assertJsonPath('data.retention_days', 90);
        $this->putJson('/api/core/security_settings', ['retention_days' => 30])
            ->assertOk()->assertJsonPath('data.retention_days', 30);
        $this->assertCoreLog('security_retention_updated', 'from 90 to 30 days');
        $this->putJson('/api/core/security_settings', ['retention_days' => 3])->assertStatus(422);
    }
}
