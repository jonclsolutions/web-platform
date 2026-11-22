<?php

/**
 * @file TemplateTest.php
 * @path api/tests/Apps/JsCreator/Feature/TemplateTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the templates (TemplateController, TemplateUsages, FileController):
 *   new / list / detail, save of the editor with the version check, validation of the document
 *   and of the files it uses, thumbnail, copy (also to another size), trash, the isolation of
 *   workspaces (another account and the sysadmin get 404), the usage of library files (a used
 *   image / font cannot be deleted), the quota and the retention of the trash.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorSetting;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\CreatorUsage;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\JsCreatorRetentionSource;
use App\Apps\JsCreator\Services\WorkspaceQuota;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/images/templates and /api/js-creator/files/templates.
 */
class TemplateTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Base path of the templates of the section Images. */
    private const BASE = '/api/js-creator/images/templates';

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description A new template starts with an empty document; the list filters by name and
     *   size and reports the sizes in use; the log never names a template.
     * @input two templates 1080×1350 and 1080×1920; search; size filter.
     * @output 201 with version 1, empty document, PNG; list of 2; search 1; size 1; meta.sizes;
     *   log "Template #id created" without the name.
     */
    public function test_create_list_and_detail(): void
    {
        $this->signIn($this->creator());
        $created = $this->postJson(self::BASE, ['name' => '  Launch post  ', 'width' => 1080, 'height' => 1350])
            ->assertCreated()->assertJsonPath('data.name', 'Launch post')->assertJsonPath('data.version', 1)
            ->assertJsonPath('data.output_format', 'png')->assertJsonPath('data.thumb_url', null)
            ->assertJsonPath('data.document.schema', 1)->assertJsonPath('data.document.pages.0.layers', []);
        $this->postJson(self::BASE, ['name' => 'Story', 'width' => 1080, 'height' => 1920])->assertCreated();
        $this->postJson(self::BASE, ['name' => 'Tiny', 'width' => 50, 'height' => 1920])->assertUnprocessable();

        $list = $this->getJson(self::BASE)->assertOk()->assertJsonCount(2, 'data')->assertJsonMissingPath('data.0.document');
        $this->assertEqualsCanonicalizing(
            [['width' => 1080, 'height' => 1350, 'count' => 1], ['width' => 1080, 'height' => 1920, 'count' => 1]],
            $list->json('meta.sizes')
        );
        $this->getJson(self::BASE . '?search=launch')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Launch post');
        $this->getJson(self::BASE . '?size=1080x1920')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Story');

        $id = $created->json('data.id');
        $this->getJson(self::BASE . "/{$id}")->assertOk()->assertJsonPath('data.document.fields', []);
        $log = JsCreatorLog::query()->where('affected_entity_type', 'Template')->where('affected_entity_id', $id)->first();
        $this->assertSame("Template #{$id} created", $log?->description);
        $this->assertStringNotContainsString('Launch', JsCreatorLog::query()->get()->toJson());
    }

    /**
     * @description A save stores the document and the usages of own files and raises the version;
     *   a save based on an older version is refused with 409 and changes nothing.
     * @input own image and own font in the document; save version 1; save version 1 again.
     * @output 200 version 2 with the document; usages asset + font; 409 version_conflict with
     *   current_version 2; the first save kept.
     */
    public function test_save_and_version_conflict(): void
    {
        $this->signIn($this->creator());
        $asset = $this->uploadAsset();
        $font = $this->uploadFont();
        $id = $this->postJson(self::BASE, ['name' => 'A', 'width' => 1080, 'height' => 1080])->json('data.id');
        $document = $this->document([
            $this->layer('text', ['field' => 'title', 'font' => ['family' => "user:{$font}", 'weight' => 400, 'style' => 'normal']]),
            $this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $asset], 'anchor' => 'tr', 'x' => -40]),
        ], [$this->textField('title')]);

        $this->putJson(self::BASE . "/{$id}", $this->save($document, 1, ['name' => 'Renamed', 'output_format' => 'jpg', 'output_quality' => 82, 'caption_template' => 'New: {{title}}']))
            ->assertOk()->assertJsonPath('data.version', 2)->assertJsonPath('data.name', 'Renamed')->assertJsonPath('data.output_format', 'jpg')
            ->assertJsonPath('data.caption_template', 'New: {{title}}')->assertJsonPath('data.document.pages.0.layers.1.anchor', 'tr');
        $this->assertEqualsCanonicalizing(
            [['asset', $asset], ['font', $font]],
            CreatorUsage::query()->get()->map(fn ($u) => [$u->target_type, $u->target_id])->all()
        );

        $this->putJson(self::BASE . "/{$id}", $this->save($this->document(), 1, ['name' => 'Stale']))
            ->assertStatus(409)->assertJsonPath('error_code', 'version_conflict')->assertJsonPath('current_version', 2);
        $this->assertSame('Renamed', CreatorTemplate::find($id)->name);
        $this->assertCount(2, CreatorTemplate::find($id)->document['pages'][0]['layers']);

        $this->putJson(self::BASE . "/{$id}", $this->save($this->document(), 2))->assertOk()->assertJsonPath('data.version', 3);
        $this->assertSame(0, CreatorUsage::count());
    }

    /**
     * @description An invalid document, an image of another account, an image in the own trash and
     *   a font of another account are refused with the path of the error; nothing is saved.
     * @input unknown property; foreign asset id; trashed own asset; foreign font.
     * @output 422 with errors at the paths; version stays 1.
     */
    public function test_document_and_its_files_are_validated(): void
    {
        $other = $this->creator();
        $this->signIn($other);
        $foreignAsset = $this->uploadAsset();
        $foreignFont = $this->uploadFont();

        $this->signIn($this->creator());
        $trashed = $this->uploadAsset();
        $this->deleteJson("/api/js-creator/library/assets/{$trashed}")->assertNoContent();
        $id = $this->postJson(self::BASE, ['name' => 'A', 'width' => 1080, 'height' => 1080])->json('data.id');

        $broken = $this->document([$this->layer('shape', ['script' => 'alert(1)'])]);
        $this->putJson(self::BASE . "/{$id}", $this->save($broken, 1))->assertUnprocessable()->assertJsonValidationErrors(['document.pages.0.layers.0']);

        $image = fn (int $assetId) => $this->document([$this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $assetId]])]);
        $this->putJson(self::BASE . "/{$id}", $this->save($image($foreignAsset), 1))->assertUnprocessable()
            ->assertJsonValidationErrors(['document.pages.0.layers.0.source.assetId']);
        $this->putJson(self::BASE . "/{$id}", $this->save($image($trashed), 1))->assertUnprocessable()
            ->assertJsonValidationErrors(['document.pages.0.layers.0.source.assetId']);

        $text = $this->document([$this->layer('text', ['font' => ['family' => "user:{$foreignFont}", 'weight' => 400, 'style' => 'normal']])]);
        $this->putJson(self::BASE . "/{$id}", $this->save($text, 1))->assertUnprocessable()
            ->assertJsonValidationErrors(['document.pages.0.layers.0.font.family']);

        $this->assertSame(1, CreatorTemplate::find($id)->version);
        $this->assertSame(0, CreatorUsage::count());
    }

    /**
     * @description Another account and the sysadmin never reach a template (404 everywhere, not
     *   in their list); a view-only account cannot create or save.
     * @input template of A; requests of B (full permissions), of the sysadmin and of a view-only account.
     * @output 404 for show / save / thumbnail / copy / delete / restore / file of a foreign
     *   template; empty lists; 403 for create and save without the permissions.
     */
    public function test_workspaces_are_isolated(): void
    {
        $owner = $this->signIn($this->creator());
        $id = $this->postJson(self::BASE, ['name' => 'Secret', 'width' => 1080, 'height' => 1080])->json('data.id');
        $this->post(self::BASE . "/{$id}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertOk();

        foreach ([$this->creator(), $this->sysadmin()] as $intruder) {
            $this->signIn($intruder);
            $this->getJson(self::BASE)->assertOk()->assertJsonCount(0, 'data');
            $this->getJson(self::BASE . "/{$id}")->assertNotFound();
            $this->putJson(self::BASE . "/{$id}", $this->save($this->document(), 1))->assertNotFound();
            $this->post(self::BASE . "/{$id}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertNotFound();
            $this->postJson(self::BASE . "/{$id}/duplicate", ['name' => 'Mine'])->assertNotFound();
            $this->postJson(self::BASE . "/{$id}/restore")->assertNotFound();
            $this->deleteJson(self::BASE . "/{$id}")->assertNotFound();
            $this->deleteJson(self::BASE . "/{$id}?force=1")->assertNotFound();
        }
        $this->assertSame(1, CreatorTemplate::count());
        $this->assertSame($owner->id, CreatorTemplate::first()->user_id);

        $this->signIn($this->creator(['view']));
        $this->postJson(self::BASE, ['name' => 'X', 'width' => 1080, 'height' => 1080])->assertForbidden();
        $this->putJson(self::BASE . "/{$id}", $this->save($this->document(), 1))->assertForbidden();
        $this->get('/api/js-creator/files/templates/' . $id)->assertForbidden();
    }

    /**
     * @description The thumbnail of the editor is re-encoded to WebP of at most 480 px, replaces the
     *   previous file, counts towards the quota and is shown only through its signed URL; other
     *   files and a full workspace are refused.
     * @input PNG 960×600; second PNG; text file; quota of 1 MB filled by another thumbnail.
     * @output WebP 480×300 behind a working signed URL; the first file deleted; thumb_bytes in the
     *   usage; 422 for the text file; 422 quota_exceeded.
     */
    public function test_thumbnail(): void
    {
        $user = $this->signIn($this->creator());
        $id = $this->postJson(self::BASE, ['name' => 'A', 'width' => 1080, 'height' => 1080])->json('data.id');

        $url = $this->post(self::BASE . "/{$id}/thumbnail", ['thumb' => $this->png(960, 600, 'thumb.png')], ['Accept' => 'application/json'])
            ->assertOk()->json('data.thumb_url');
        $first = CreatorTemplate::find($id);
        $stored = Storage::disk('private')->get($first->thumb_path);
        $info = getimagesizefromstring($stored);
        $this->assertSame(['image/webp', 480, 300], [$info['mime'], $info[0], $info[1]]);
        $this->assertSame(strlen($stored), $first->thumb_bytes);
        $this->assertSame($first->thumb_bytes, WorkspaceQuota::usedBytes($user->id));
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/webp')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->get($url . 'x')->assertForbidden();

        $this->post(self::BASE . "/{$id}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('private')->assertMissing($first->thumb_path);

        $this->post(self::BASE . "/{$id}/thumbnail", ['thumb' => UploadedFile::fake()->createWithContent('thumb.png', 'not an image')], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        CreatorSetting::query()->create(['default_quota_mb' => 1]);
        $filler = $this->postJson(self::BASE, ['name' => 'Filler', 'width' => 1080, 'height' => 1080])->json('data.id');
        CreatorTemplate::query()->whereKey($filler)->update(['thumb_bytes' => WorkspaceQuota::MB]);
        $this->post(self::BASE . "/{$id}/thumbnail", ['thumb' => $this->png(960, 960, 'thumb.png')], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonPath('error_code', 'quota_exceeded');
    }

    /**
     * @description A copy keeps the document, output and usages; a copy of the same size also
     *   gets its own thumbnail file, a copy to another size none.
     * @input template with an own image and a thumbnail; copy; copy to 1080×1920.
     * @output 201 version 1 with the same document; thumbnail file copied / null; usages of both copies.
     */
    public function test_duplicate_also_to_another_size(): void
    {
        $this->signIn($this->creator());
        $asset = $this->uploadAsset();
        $id = $this->postJson(self::BASE, ['name' => 'Post', 'width' => 1080, 'height' => 1350])->json('data.id');
        $document = $this->document([$this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $asset], 'anchor' => 'br', 'x' => -40, 'y' => -40])]);
        $this->putJson(self::BASE . "/{$id}", $this->save($document, 1, ['name' => 'Post', 'height' => 1350, 'caption_template' => 'Hi']))->assertOk();
        $this->post(self::BASE . "/{$id}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertOk();

        $same = $this->postJson(self::BASE . "/{$id}/duplicate", ['name' => 'Post (copy)'])->assertCreated()
            ->assertJsonPath('data.version', 1)->assertJsonPath('data.width', 1080)->assertJsonPath('data.height', 1350)
            ->assertJsonPath('data.caption_template', 'Hi')->assertJsonPath('data.document.pages.0.layers.0.anchor', 'br');
        $this->assertNotNull($same->json('data.thumb_url'));
        $copy = CreatorTemplate::find($same->json('data.id'));
        $this->assertNotSame(CreatorTemplate::find($id)->thumb_path, $copy->thumb_path);
        Storage::disk('private')->assertExists($copy->thumb_path);

        $story = $this->postJson(self::BASE . "/{$id}/duplicate", ['name' => 'Post story', 'width' => 1080, 'height' => 1920])->assertCreated()
            ->assertJsonPath('data.height', 1920)->assertJsonPath('data.thumb_url', null)->assertJsonPath('data.document.pages.0.layers.0.x', -40);
        $this->postJson(self::BASE . "/{$id}/duplicate", ['name' => 'Half', 'width' => 1080])->assertUnprocessable();

        $this->assertSame(3, CreatorUsage::query()->where('target_type', 'asset')->where('target_id', $asset)->count());
        $this->assertSame(1, CreatorUsage::query()->where('owner_id', $story->json('data.id'))->count());
    }

    /**
     * @description Trash: delete, list of the trash, restore, delete for good (thumbnail and usages
     *   with it), empty the trash; a template in the trash cannot be opened or saved.
     * @input template with a thumbnail and a used image; second template.
     * @output the flow works; files and usages removed; 404 for detail / save in the trash.
     */
    public function test_trash(): void
    {
        $this->signIn($this->creator());
        $asset = $this->uploadAsset();
        $id = $this->postJson(self::BASE, ['name' => 'A', 'width' => 1080, 'height' => 1080])->json('data.id');
        $this->putJson(self::BASE . "/{$id}", $this->save($this->document([$this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $asset]])]), 1))->assertOk();
        $this->post(self::BASE . "/{$id}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertOk();
        $other = $this->postJson(self::BASE, ['name' => 'B', 'width' => 1080, 'height' => 1080])->json('data.id');

        $this->deleteJson(self::BASE . "/{$id}?force=1")->assertNotFound();
        $this->deleteJson(self::BASE . "/{$id}")->assertNoContent();
        $this->getJson(self::BASE)->assertJsonCount(1, 'data');
        $this->getJson(self::BASE . '?only_trashed=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id);
        $this->getJson(self::BASE . "/{$id}")->assertNotFound();
        $this->putJson(self::BASE . "/{$id}", $this->save($this->document(), 2))->assertNotFound();

        $this->postJson(self::BASE . "/{$id}/restore")->assertOk();
        $this->deleteJson(self::BASE . "/{$id}")->assertNoContent();
        $thumb = CreatorTemplate::withTrashed()->find($id)->thumb_path;
        $this->deleteJson(self::BASE . "/{$id}?force=1")->assertNoContent();
        $this->assertNull(CreatorTemplate::withTrashed()->find($id));
        Storage::disk('private')->assertMissing($thumb);
        $this->assertSame(0, CreatorUsage::count());

        $this->deleteJson(self::BASE . "/{$other}")->assertNoContent();
        $this->deleteJson(self::BASE . '/trash')->assertNoContent();
        $this->assertSame(0, CreatorTemplate::withTrashed()->count());
    }

    /**
     * @description A library image or own font used by a template (also one in the trash) cannot
     *   be deleted; the lists name the templates; deleting the template for good frees them.
     * @input image + font used by a template; template moved to the trash; then deleted for good.
     * @output 409 in_use with the template (trashed: true); `used_by` in the lists; 204 at the end.
     */
    public function test_used_library_files_cannot_be_deleted(): void
    {
        $this->signIn($this->creator());
        $asset = $this->uploadAsset();
        $font = $this->uploadFont();
        $id = $this->postJson(self::BASE, ['name' => 'Uses both', 'width' => 1080, 'height' => 1080])->json('data.id');
        $document = $this->document([
            $this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $asset]]),
            $this->layer('text', ['font' => ['family' => "user:{$font}", 'weight' => 400, 'style' => 'normal']]),
        ]);
        $this->putJson(self::BASE . "/{$id}", $this->save($document, 1, ['name' => 'Uses both']))->assertOk();

        $this->getJson('/api/js-creator/library/assets')->assertJsonPath('data.0.used_by.0.name', 'Uses both');
        $this->getJson('/api/js-creator/library/fonts')->assertJsonPath('data.0.used_by.0.id', $id);
        $this->deleteJson(self::BASE . "/{$id}")->assertNoContent();

        $this->deleteJson("/api/js-creator/library/assets/{$asset}")->assertStatus(409)
            ->assertJsonPath('error_code', 'in_use')->assertJsonPath('used_by.0.trashed', true);
        $this->deleteJson("/api/js-creator/library/fonts/{$font}")->assertStatus(409)->assertJsonPath('error_code', 'in_use');

        $this->deleteJson(self::BASE . "/{$id}?force=1")->assertNoContent();
        $this->deleteJson("/api/js-creator/library/assets/{$asset}")->assertNoContent();
        $this->deleteJson("/api/js-creator/library/fonts/{$font}")->assertNoContent();
    }

    /**
     * @description Retention deletes templates of the trash after the period (with thumbnail and
     *   usages) and the clean-up keeps known thumbnails.
     * @input template trashed 31 days ago with a thumbnail and a used image; active template with a thumbnail.
     * @output purge 1; file and usages gone; the image can be deleted; the active thumbnail stays.
     */
    public function test_retention_of_trashed_templates(): void
    {
        $this->signIn($this->creator());
        $asset = $this->uploadAsset();
        $old = $this->postJson(self::BASE, ['name' => 'Old', 'width' => 1080, 'height' => 1080])->json('data.id');
        $this->putJson(self::BASE . "/{$old}", $this->save($this->document([$this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $asset]])]), 1))->assertOk();
        $this->post(self::BASE . "/{$old}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertOk();
        $active = $this->postJson(self::BASE, ['name' => 'Active', 'width' => 1080, 'height' => 1080])->json('data.id');
        $this->post(self::BASE . "/{$active}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertOk();
        $this->deleteJson(self::BASE . "/{$old}")->assertNoContent();
        CreatorTemplate::onlyTrashed()->update(['deleted_at' => Carbon::now()->subDays(31)]);
        $oldThumb = CreatorTemplate::withTrashed()->find($old)->thumb_path;

        $this->assertSame(1, (new JsCreatorRetentionSource())->purge('js_creator_trash', Carbon::now()->subDays(30)));
        Storage::disk('private')->assertMissing($oldThumb);
        $this->assertSame(0, CreatorUsage::count());

        $activeThumb = CreatorTemplate::find($active)->thumb_path;
        touch(Storage::disk('private')->path($activeThumb), Carbon::now()->subDays(2)->getTimestamp());
        (new JsCreatorRetentionSource())->cleanUp();
        Storage::disk('private')->assertExists($activeThumb);
        $this->deleteJson("/api/js-creator/library/assets/{$asset}")->assertNoContent();
    }

    /**
     * @description Body of a save of the editor.
     * @param array<string, mixed> $document Document.
     * @param int $version Version the editor started from.
     * @param array<string, mixed> $overrides Further properties.
     * @return array<string, mixed>
     */
    private function save(array $document, int $version, array $overrides = []): array
    {
        return array_replace([
            'name' => 'A', 'width' => 1080, 'height' => 1080, 'output_format' => 'png', 'output_quality' => 90,
            'caption_template' => null, 'version' => $version, 'document' => $document,
        ], $overrides);
    }

    /**
     * @description Uploads an image to the library of the signed-in account.
     * @return int Its id.
     */
    private function uploadAsset(): int
    {
        return (int) $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.0.id');
    }

    /**
     * @description Uploads a font of the signed-in account.
     * @return int Its id.
     */
    private function uploadFont(): int
    {
        return (int) $this->post('/api/js-creator/library/fonts', ['file' => $this->font(), 'family' => 'Brand', 'weight' => 400, 'style' => 'normal'], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.id');
    }
}
