<?php

/**
 * @file CoreLogTest.php
 * @path api/tests/Feature/Core/CoreLogTest.php
 * @project RPSW Web
 * @author RPSW
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
            ->assertJson(['total' => 2, 'per_page' => 1, 'last_page' => 2])
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
            $this->getJson("/api/core/logs?{$filter}")->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $a->id);
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

        $this->getJson('/api/core/logs?no_pagination=true&sort_by=id&sort_direction=asc')->assertOk()->assertJsonPath('*.id', [$a->id, $b->id]);
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

        $this->getJson("/api/core/logs/{$log->id}")->assertOk()->assertJsonPath('context_data.k', 'v');
        $this->getJson('/api/core/logs/999')->assertStatus(404);
    }

    /**
     * @description Any signed-in account writes an own entry; actor and IP are filled in by
     *   the server, the payload is validated.
     * @input Account without permissions, POST {event_type, module, description}; POST {}.
     * @output 201 with user_plain = the account's e-mail, origin 127.0.0.1; 422.
     */
    public function test_store(): void
    {
        $me = $this->signIn($this->user());

        $this->postJson('/api/core/logs', ['event_type' => 'export_csv', 'module' => 'core/users', 'description' => 'Exported'])
            ->assertCreated()
            ->assertJsonPath('user_plain', $me->user_email)
            ->assertJsonPath('user_id', $me->id)
            ->assertJsonPath('origin', '127.0.0.1');

        $this->postJson('/api/core/logs', [])->assertStatus(422)->assertJsonValidationErrors(['event_type', 'module', 'description']);
    }
}
