<?php

/**
 * @file WebLogTest.php
 * @path api/tests/Feature/Web/WebLogTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the web audit log API (WebLogController): reading needs
 *   web-view-web-logs, writing an own entry is open to every signed-in account.
 * @dependencies
 * - Tests\TestCase.
 */

namespace Tests\Feature\Web;

use App\Models\Web\WebLog;
use Tests\TestCase;

/**
 * @description /api/web/logs.
 */
class WebLogTest extends TestCase
{
    /**
     * @description Inserts a web log row (created_at is not mass assignable).
     * @param array<string, mixed> $attributes Column overrides.
     * @return WebLog
     */
    private function log(array $attributes = []): WebLog
    {
        return WebLog::forceCreate(array_merge([
            'event_type' => 'update', 'module' => 'WebNews', 'description' => 'Changed', 'origin' => '127.0.0.1',
            'user_plain' => 'system', 'user_id_plain' => '0',
        ], $attributes));
    }

    /**
     * @description Reading needs web-view-web-logs.
     * @input Account without permission: GET list and detail.
     * @output 403 both.
     */
    public function test_read_requires_permission(): void
    {
        $log = $this->log();
        $this->signIn($this->user());

        $this->getJson('/api/web/logs')->assertStatus(403);
        $this->getJson("/api/web/logs/{$log->id}")->assertStatus(403);
    }

    /**
     * @description List: paginated, newest first, column filters, global search, export.
     * @input Row A (yesterday, create / WebSalesLead / eve@x.cz / 10.1.1.1 / 'Lead added') and row B (today).
     * @output Default: B first; each filter and the search return only A; no_pagination returns both.
     */
    public function test_index(): void
    {
        $this->signIn($this->userWith(['web-view-web-logs']));
        $a = $this->log(['created_at' => now()->subDay(), 'event_type' => 'create', 'module' => 'WebSalesLead', 'user_plain' => 'eve@x.cz', 'origin' => '10.1.1.1', 'description' => 'Lead added']);
        $b = $this->log(['created_at' => now()]);

        $this->getJson('/api/web/logs?per_page=1')->assertOk()
            ->assertJson(['meta' => ['total' => 2, 'last_page' => 2]])->assertJsonPath('data.0.id', $b->id);
        foreach (["id={$a->id}", 'event_type=create', 'module=WebSalesLead', 'user_plain=eve@', 'origin=10.1', 'search=Lead%20add'] as $filter) {
            $this->getJson("/api/web/logs?{$filter}")->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $a->id);
        }
        $this->getJson('/api/web/logs?no_pagination=true&sort_by=id&sort_direction=asc')->assertJsonPath('data.*.id', [$a->id, $b->id]);
    }

    /**
     * @description The detail names the actor's e-mail, or "Unknown user" without an account (English, finding #29).
     * @input Row of an existing account, row without account; GET each; GET /999.
     * @output user.user_email = e-mail / 'Unknown user'; 404.
     */
    public function test_show(): void
    {
        $actor = $this->signIn($this->userWith(['web-view-web-logs']));
        $own = $this->log(['user_id' => $actor->id, 'context_data' => ['k' => 'v']]);
        $anonymous = $this->log();

        $this->getJson("/api/web/logs/{$own->id}")->assertOk()
            ->assertJsonPath('data.user.user_email', $actor->user_email)->assertJsonPath('data.context_data.k', 'v');
        $this->getJson("/api/web/logs/{$anonymous->id}")->assertJsonPath('data.user.user_email', 'Unknown user');
        $this->getJson('/api/web/logs/999')->assertStatus(404);
    }

    /**
     * @description Any signed-in account writes an own entry; the server fills actor and IP.
     * @input Account without permissions: POST {event_type, module, description}; POST {}.
     * @output 201 with user_plain = own e-mail; 422.
     */
    public function test_store(): void
    {
        $me = $this->signIn($this->user());

        $this->postJson('/api/web/logs', ['event_type' => 'export_csv', 'module' => 'web/news', 'description' => 'Exported'])
            ->assertCreated()->assertJsonPath('data.user_plain', $me->user_email)->assertJsonPath('data.origin', '127.0.0.1');
        $this->postJson('/api/web/logs', [])->assertStatus(422)->assertJsonValidationErrors(['event_type', 'module', 'description']);
    }
}
