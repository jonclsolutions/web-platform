<?php

/**
 * @file __APP__LogTest.php
 * @path api/tests/Apps/__APP__/Feature/__APP__LogTest.php
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Feature tests of the audit log of the application "__NAME__"
 *   (__APP__LogController): permission, newest first, filters, detail; the browser cannot write.
 * @dependencies Tests\TestCase.
 */

namespace Tests\Apps\__APP__\Feature;

use App\Apps\__APP__\Models\__APP__Log;
use Tests\TestCase;

/**
 * @description /api/__app__/logs.
 */
class __APP__LogTest extends TestCase
{
    /**
     * @description Inserts a log row (created_at is not mass assignable).
     * @param array<string, mixed> $attributes Column overrides.
     * @return __APP__Log
     */
    private function log(array $attributes = []): __APP__Log
    {
        return __APP__Log::forceCreate(array_merge([
            'event_type' => 'update', 'module' => '__APP__', 'description' => 'Changed', 'origin' => '127.0.0.1',
            'user_plain' => 'system', 'user_id_plain' => '0',
        ], $attributes));
    }

    /**
     * @description List and detail need __app__-view-logs; newest first; a filter narrows the
     *   list; the browser cannot write.
     * @input Account without / with the permission; rows A (yesterday, create) and B (today).
     * @output 403; B first; event_type=create returns A; detail of A; 404 for an unknown id;
     *   POST 405.
     */
    public function test_log(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/__app__/logs')->assertStatus(403);

        $this->signIn($this->userWith(['__app__-view-logs']));
        $a = $this->log(['created_at' => now()->subDay(), 'event_type' => 'create']);
        $b = $this->log(['created_at' => now()]);

        $this->getJson('/api/__app__/logs')->assertOk()->assertJsonPath('data.0.id', $b->id);
        $this->getJson('/api/__app__/logs?event_type=create')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $a->id);
        $this->getJson("/api/__app__/logs/{$a->id}")->assertOk()->assertJsonPath('data.event_type', 'create');
        $this->getJson('/api/__app__/logs/999')->assertNotFound();
        $this->postJson('/api/__app__/logs', [])->assertStatus(405);
    }
}
