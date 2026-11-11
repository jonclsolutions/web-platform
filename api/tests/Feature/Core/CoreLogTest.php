<?php

/**
 * @file CoreLogTest.php
 * @path api/tests/Feature/Core/CoreLogTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the core audit log API (CoreLogController): reading needs
 *   view-core, writing an own entry is open to every signed-in account.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core;

use App\Models\Core\CoreLog;
use Tests\TestCase;

/**
 * @description /api/core/logs.
 */
class CoreLogTest extends TestCase
{
    /**
     * @description Inserts an audit log row.
     * @param array<string, mixed> $attributes Column overrides.
     * @return CoreLog
     */
    private function log(array $attributes = []): CoreLog
    {
        // forceCreate: created_at is not mass assignable (filled by the DB default in production)
        return CoreLog::forceCreate(array_merge([
            'event_type' => 'update', 'module' => 'User', 'description' => 'Something happened',
            'origin' => '127.0.0.1', 'user_plain' => 'system', 'user_id_plain' => '0',
        ], $attributes));
    }

    /**
     * @description Reading the log needs view-core.
     * @input Account without permissions, GET /api/core/logs and /api/core/logs/1.
     * @output 403 both.
     */
    public function test_read_requires_view_core(): void
    {
        $log = $this->log();
        $this->signIn($this->user());

        $this->getJson('/api/core/logs')->assertStatus(403);
        $this->getJson("/api/core/logs/{$log->id}")->assertStatus(403);
    }

    /**
     * @description The list is paginated, newest first by default.
     * @input Rows created yesterday and today, GET ?per_page=1.
     * @output 200 {total 2, last_page 2}; today's row first.
     */
    public function test_index_paginated_newest_first(): void
    {
        $this->signIn($this->userWith(['view-core']));
        $this->log(['created_at' => now()->subDay()]);
        $today = $this->log(['created_at' => now()]);

        $this->getJson('/api/core/logs?per_page=1')
            ->assertOk()
            ->assertJson(['meta' => ['total' => 2, 'per_page' => 1, 'last_page' => 2]])
            ->assertJsonPath('data.0.id', $today->id);
    }

    /**
     * @description Column filters and the global search (across event_type, module,
     *   user_plain, origin, description).
     * @input Row A (login_failed / Auth / eve@x.cz / 10.1.1.1 / 'Bad password'), row B (default).
     * @output Every filter and the search 'Bad pass' return only A.
     */
    public function test_index_filters_and_search(): void
    {
        $this->signIn($this->userWith(['view-core']));
        $a = $this->log(['event_type' => 'login_failed', 'module' => 'Auth', 'user_plain' => 'eve@x.cz', 'origin' => '10.1.1.1', 'description' => 'Bad password']);
        $this->log();

        foreach (["id={$a->id}", 'event_type=login_failed', 'module=Auth', 'user_plain=eve@', 'origin=10.1', 'search=Bad%20pass'] as $filter) {
            $this->getJson("/api/core/logs?{$filter}")->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $a->id);
        }
    }

    /**
     * @description no_pagination returns the whole (sorted) list.
     * @input Two rows, GET ?no_pagination=true&sort_by=id&sort_direction=asc.
     * @output Plain array, ascending id.
     */
    public function test_index_export(): void
    {
        $this->signIn($this->userWith(['view-core']));
        $a = $this->log();
        $b = $this->log();

        $this->getJson('/api/core/logs?no_pagination=true&sort_by=id&sort_direction=asc')->assertOk()->assertJsonPath('data.*.id', [$a->id, $b->id]);
    }

    /**
     * @description The detail returns one row incl. decoded context; unknown id is 404.
     * @input Row with context_data, GET /{id}, /999.
     * @output 200 with context_data; 404.
     */
    public function test_show(): void
    {
        $this->signIn($this->userWith(['view-core']));
        $log = $this->log(['context_data' => ['k' => 'v']]);

        $this->getJson("/api/core/logs/{$log->id}")->assertOk()->assertJsonPath('data.context_data.k', 'v');
        $this->getJson('/api/core/logs/999')->assertStatus(404);
    }

    /**
     * @description The browser cannot write the audit log; a data export is logged by the server
     *   when it serves the data (`?export=`): format, record count, path, filters; an unknown
     *   `export` value or a failed request is not logged.
     * @input POST core/logs; GET core/logs?export=csv&search=x, ?export=raw_xlsx, ?export=report,
     *   ?export=<script>; GET without permission with ?export=csv.
     * @output 405, no row written by it; rows export_csv "Exported 0 records (CSV) from api/core/logs"
     *   with the filter search=x, export_raw_xlsx, generate_report; nothing for the unknown value
     *   and the 403.
     */
    public function test_browser_cannot_write_and_exports_are_logged_by_the_server(): void
    {
        $this->signIn($this->userWith(['view-core']));

        $this->postJson('/api/core/logs', ['event_type' => 'export_csv', 'module' => 'core/users', 'description' => 'Exported'])->assertStatus(405);
        $this->assertSame(0, CoreLog::count());

        $this->getJson('/api/core/logs?export=csv&search=x&no_pagination=true')->assertOk();
        $this->getJson('/api/core/logs?export=raw_xlsx&no_pagination=true')->assertOk();
        $this->getJson('/api/core/logs?export=report&no_pagination=true')->assertOk();
        $this->getJson('/api/core/logs?export=' . urlencode('<script>'))->assertOk();
        $this->signIn($this->user());
        $this->getJson('/api/core/logs?export=csv')->assertForbidden();

        $rows = CoreLog::orderBy('id')->get();
        $this->assertSame(['export_csv', 'export_raw_xlsx', 'generate_report'], $rows->pluck('event_type')->all());
        $this->assertSame('Exported 0 records (CSV) from api/core/logs', $rows[0]->description);
        $this->assertSame(['api/core/logs', 'collection'], [$rows[0]->module, $rows[0]->affected_entity_type]);
        $this->assertSame('x', $rows[0]->context_data['search']);
        $this->assertSame('Exported 1 records (RAW XLSX) from api/core/logs', $rows[1]->description);
    }
}
