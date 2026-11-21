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
use Illuminate\Support\Facades\DB;
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
     * @description Reading the log needs its own permission core-logs-view - the Core tab
     *   (view-core) alone is not enough, the log holds e-mail and IP addresses of every account.
     * @input Account without permissions, then with view-core only; GET /api/core/logs and /api/core/logs/1.
     * @output 403 for all four requests.
     */
    public function test_read_requires_core_logs_view(): void
    {
        $log = $this->log();
        $this->signIn($this->user());
        $this->getJson('/api/core/logs')->assertStatus(403);
        $this->getJson("/api/core/logs/{$log->id}")->assertStatus(403);

        $this->signIn($this->userWith(['view-core']));
        $this->getJson('/api/core/logs')->assertStatus(403);
        $this->getJson("/api/core/logs/{$log->id}")->assertStatus(403);
    }

    /**
     * @description The migration adding core-logs-view gives it to every role and account that
     *   holds view-core, so nobody loses access by the release; down() removes the key again.
     * @input Role R with view-core, account A with an explicit view-core, role S without; up(), up()
     *        again, down().
     * @output R and A have core-logs-view, S not; a second up() changes nothing; after down() the key is gone.
     */
    public function test_migration_grants_core_logs_view_to_holders_of_view_core(): void
    {
        $migration = require base_path('database/migrations/2026_11_27_000000_add_core_logs_view_permission.php');
        $viewCore = DB::table('core_permissions')->where('permission_key', 'view-core')->value('id')
            ?? DB::table('core_permissions')->insertGetId(['permission_key' => 'view-core', 'module' => 'core']);
        DB::table('core_permissions')->where('permission_key', 'core-logs-view')->delete();
        $r = $this->role('reader');
        $s = $this->role('other');
        DB::table('core_role_permissions')->insert(['role_id' => $r->id, 'permission_id' => $viewCore]);
        $a = $this->user();
        DB::table('user_permissions')->insert(['user_id' => $a->id, 'permission_id' => $viewCore]);

        $migration->up();
        $migration->up();

        $logs = DB::table('core_permissions')->where('permission_key', 'core-logs-view')->value('id');
        $this->assertNotNull($logs);
        $this->assertSame([$r->id], DB::table('core_role_permissions')->where('permission_id', $logs)->pluck('role_id')->map(fn ($id) => (int) $id)->all());
        $this->assertSame([$a->id], DB::table('user_permissions')->where('permission_id', $logs)->pluck('user_id')->map(fn ($id) => (int) $id)->all());
        $this->assertNotContains($s->id, DB::table('core_role_permissions')->where('permission_id', $logs)->pluck('role_id')->all());

        $migration->down();
        $this->assertFalse(DB::table('core_permissions')->where('permission_key', 'core-logs-view')->exists());
    }

    /**
     * @description The list is paginated, newest first by default.
     * @input Rows created yesterday and today, GET ?per_page=1.
     * @output 200 {total 2, last_page 2}; today's row first.
     */
    public function test_index_paginated_newest_first(): void
    {
        $this->signIn($this->userWith(['core-logs-view']));
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
        $this->signIn($this->userWith(['core-logs-view']));
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
        $this->signIn($this->userWith(['core-logs-view']));
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
        $this->signIn($this->userWith(['core-logs-view']));
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
        $this->signIn($this->userWith(['core-logs-view']));

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
