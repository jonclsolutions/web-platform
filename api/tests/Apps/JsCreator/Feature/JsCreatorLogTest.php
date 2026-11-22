<?php

/**
 * @file JsCreatorLogTest.php
 * @path api/tests/Apps/JsCreator/Feature/JsCreatorLogTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the audit log of the application "JS Creator"
 *   (JsCreatorLogController): permission, newest first, filters, detail; the browser cannot write;
 *   the rows written by the workspace never contain names or content (AUDIT_MASKED of the models,
 *   upload file names excluded).
 * @dependencies Tests\TestCase, JsCreatorFixtures.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\JsCreatorLog;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/logs.
 */
class JsCreatorLogTest extends TestCase
{
    use JsCreatorFixtures;

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

    /**
     * @description Nothing of the content of a workspace reaches the log - neither from the request
     *   copy nor from the data changes: names of folders, images (also the upload file name),
     *   fonts and templates, texts and the caption pattern of a document.
     * @input folder, image upload `Secret-photo.png` + rename, font family, template with a text
     *   layer and a caption, its copy and deletion - all named "Secret…".
     * @output log rows written (create / update / soft_delete …); none contains "Secret".
     */
    public function test_log_never_contains_names_or_content(): void
    {
        $this->fakeDisk();
        $this->signIn($this->creator());
        $folder = $this->postJson('/api/js-creator/folders', ['name' => 'Secret folder'])->assertCreated()->json('data.id');
        $this->putJson("/api/js-creator/folders/{$folder}", ['name' => 'Secret renamed folder'])->assertOk();
        $asset = $this->post('/api/js-creator/library/assets', ['files' => [$this->png(30, 20, 'Secret-photo.png')]], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.0.id');
        $this->putJson("/api/js-creator/library/assets/{$asset}", ['name' => 'Secret renamed image'])->assertOk();
        $this->post('/api/js-creator/library/fonts', ['file' => $this->font('wOF2', 'Secret.woff2'), 'family' => 'SecretFamily', 'weight' => 400, 'style' => 'normal'], ['Accept' => 'application/json'])
            ->assertCreated();
        $template = $this->postJson('/api/js-creator/images/templates', ['name' => 'Secret template', 'width' => 1080, 'height' => 1080])->json('data.id');
        $this->putJson("/api/js-creator/images/templates/{$template}", [
            'name' => 'Secret saved', 'width' => 1080, 'height' => 1080, 'output_format' => 'png', 'output_quality' => 90,
            'caption_template' => 'Secret caption', 'version' => 1, 'document' => $this->document([$this->layer('text', ['text' => 'Secret text', 'name' => 'Secret layer'])]),
        ])->assertOk();
        $this->postJson("/api/js-creator/images/templates/{$template}/duplicate", ['name' => 'Secret copy'])->assertCreated();
        $this->deleteJson("/api/js-creator/images/templates/{$template}")->assertNoContent();

        $this->assertGreaterThanOrEqual(8, JsCreatorLog::count());
        $this->assertStringNotContainsString('Secret', JsCreatorLog::query()->get()->toJson());
    }
}
