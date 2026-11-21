<?php

/**
 * @file JsCreatorLogTest.php
 * @path api/tests/Apps/JsCreator/Feature/JsCreatorLogTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the audit log of the application "JS Creator"
 *   (JsCreatorLogController): permission, newest first, filters, detail; the browser cannot write.
 * @dependencies Tests\TestCase.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\JsCreatorLog;
use Tests\TestCase;

/**
 * @description /api/js-creator/logs.
 */
class JsCreatorLogTest extends TestCase
{
    /**
     * @description Inserts a log row (created_at is not mass assignable).
     * @param array<string, mixed> $attributes Column overrides.
     * @return JsCreatorLog
     */
    private function log(array $attributes = []): JsCreatorLog
    {
        return JsCreatorLog::forceCreate(array_merge([
            'event_type' => 'update', 'module' => 'JsCreator', 'description' => 'Changed', 'origin' => '127.0.0.1',
            'user_plain' => 'system', 'user_id_plain' => '0',
        ], $attributes));
    }

    /**
     * @description List and detail need js-creator-view-logs; newest first; a filter narrows the
     *   list; the browser cannot write.
     * @input Account without / with the permission; rows A (yesterday, create) and B (today).
     * @output 403; B first; event_type=create returns A; detail of A; 404 for an unknown id;
     *   POST 405.
     */
    public function test_log(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/js-creator/logs')->assertStatus(403);

        $this->signIn($this->userWith(['js-creator-view-logs']));
        $a = $this->log(['created_at' => now()->subDay(), 'event_type' => 'create']);
        $b = $this->log(['created_at' => now()]);

        $this->getJson('/api/js-creator/logs')->assertOk()->assertJsonPath('data.0.id', $b->id);
        $this->getJson('/api/js-creator/logs?event_type=create')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $a->id);
        $this->getJson("/api/js-creator/logs/{$a->id}")->assertOk()->assertJsonPath('data.event_type', 'create');
        $this->getJson('/api/js-creator/logs/999')->assertNotFound();
        $this->postJson('/api/js-creator/logs', [])->assertStatus(405);
    }
}
