<?php

/**
 * @file BlockTest.php
 * @path api/tests/Apps/JsCreator/Feature/BlockTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the blocks (BlockController, block instances of TemplateController,
 *   TemplateUsages, FileController): new (empty / from the selection), save with the version
 *   check, no blocks inside a block, instances in templates (own blocks of the section outside
 *   the trash only; the detail of a template carries its blocks), a changed block makes the
 *   thumbnails of its templates stale, a used block cannot be deleted, thumbnail, copy, trash,
 *   the isolation of workspaces, the quota and the retention.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\CreatorUsage;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\JsCreatorRetentionSource;
use App\Apps\JsCreator\Services\WorkspaceQuota;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/images/blocks, block instances of /api/js-creator/images/templates
 *   and /api/js-creator/files/blocks.
 */
class BlockTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Base path of the blocks of the section Images. */
    private const BASE = '/api/js-creator/images/blocks';

    /** @description Base path of the templates of the section Images. */
    private const TEMPLATES = '/api/js-creator/images/templates';

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description A new block is empty with a transparent background; a save stores its document
     *   and usages and raises the version; an older version is refused; a block instance inside a
     *   block is refused; the log never names a block.
     * @input new block 600×200; save with an own image and a text field; save of version 1 again;
     *   document with a block layer.
     * @output 201 transparent; 200 version 2 with usage asset; 409 version_conflict; 422 at `.type`.
     */
    public function test_create_save_and_no_nesting(): void
    {
        $this->signIn($this->creator());
        $asset = $this->uploadAsset();
        $created = $this->postJson(self::BASE, ['name' => '  Price tag ', 'width' => 600, 'height' => 200])->assertCreated()
            ->assertJsonPath('data.name', 'Price tag')->assertJsonPath('data.version', 1)->assertJsonPath('data.used_by', [])
            ->assertJsonPath('data.document.pages.0.background.fill.color', '#ffffff00');
        $id = $created->json('data.id');

        $document = $this->document([
            $this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $asset]]),
            $this->layer('text', ['field' => 'price']),
        ], [$this->textField('price')]);
        $this->putJson(self::BASE . "/{$id}", $this->blockSave($document, 1, ['name' => 'Tag']))->assertOk()
            ->assertJsonPath('data.version', 2)->assertJsonPath('data.name', 'Tag')->assertJsonPath('data.document.fields.0.key', 'price');
        $this->assertSame([['block', $id, 'asset', $asset]], CreatorUsage::query()->get()
            ->map(fn ($u) => [$u->owner_type, $u->owner_id, $u->target_type, $u->target_id])->all());

        $this->putJson(self::BASE . "/{$id}", $this->blockSave($this->document(), 1))
            ->assertStatus(409)->assertJsonPath('error_code', 'version_conflict')->assertJsonPath('current_version', 2);
        $this->putJson(self::BASE . "/{$id}", $this->blockSave($this->document([$this->layer('block', ['blockId' => $id])]), 2))
            ->assertUnprocessable()->assertJsonValidationErrors(['document.pages.0.layers.0.type']);
        $this->postJson(self::BASE, ['name' => 'Nested', 'width' => 600, 'height' => 200, 'document' => $this->document([$this->layer('block', ['blockId' => $id])])])
            ->assertUnprocessable();

        $this->getJson(self::BASE)->assertOk()->assertJsonCount(1, 'data')->assertJsonMissingPath('data.0.document');
        $this->getJson(self::BASE . '?search=tag')->assertJsonCount(1, 'data');
        $this->getJson(self::BASE . '?search=nothing')->assertJsonCount(0, 'data');
        $this->assertSame("Block #{$id} created", JsCreatorLog::query()->where('affected_entity_type', 'Block')->first()?->description);
        $this->assertStringNotContainsString('Price', JsCreatorLog::query()->get()->toJson());
    }

    /**
     * @description "Block from the selection": a new block with its document (validated, usages).
     * @input document with an own font and an image field; invalid document; foreign image.
     * @output 201 with the document and a font usage; 422; 422 at the path of the image.
     */
    public function test_block_from_selection(): void
    {
        $this->signIn($this->creator());
        $font = $this->uploadFont();
        $document = $this->document([
            $this->layer('text', ['font' => ['family' => "user:{$font}", 'weight' => 400, 'style' => 'normal']]),
            $this->layer('image', ['source' => ['kind' => 'field', 'field' => 'logo']]),
        ], [$this->imageField('logo')]);
        $document['pages'][0]['background']['fill']['color'] = '#ffffff00';

        $id = $this->postJson(self::BASE, ['name' => 'Footer', 'width' => 1080, 'height' => 200, 'document' => $document])->assertCreated()
            ->assertJsonPath('data.document.fields.0.key', 'logo')->json('data.id');
        $this->assertSame(1, CreatorUsage::query()->where('owner_type', 'block')->where('owner_id', $id)->where('target_type', 'font')->count());

        $this->postJson(self::BASE, ['name' => 'Bad', 'width' => 1080, 'height' => 200, 'document' => ['schema' => 1]])->assertUnprocessable();
        $foreign = $this->document([$this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => 999]])]);
        $this->postJson(self::BASE, ['name' => 'Foreign', 'width' => 1080, 'height' => 200, 'document' => $foreign])
            ->assertUnprocessable()->assertJsonValidationErrors(['document.pages.0.layers.0.source.assetId']);
        $this->assertSame(1, CreatorBlock::count());
    }

    /**
     * @description Instances in templates: an own block of the section is accepted (usage, the
     *   detail of the template carries the block), a foreign / trashed / missing block is refused;
     *   saving the block makes the thumbnail of the template stale, a new thumbnail clears it;
     *   the block lists the template in `used_by`.
     * @input block with a field; template with two instances; block of another account; block in
     *   the trash; save of the block; thumbnail of the template.
     * @output template saved with usage `block`; GET template → `blocks.0.document`; 422 for the
     *   others; thumb_stale true → false; used_by of the block.
     */
    public function test_instances_in_templates(): void
    {
        $other = $this->signIn($this->creator());
        $foreign = $this->postJson(self::BASE, ['name' => 'Foreign', 'width' => 300, 'height' => 300])->json('data.id');

        $owner = $this->signIn($this->creator());
        $block = $this->postJson(self::BASE, ['name' => 'Tag', 'width' => 400, 'height' => 200])->json('data.id');
        $this->putJson(self::BASE . "/{$block}", $this->blockSave($this->document([$this->layer('text', ['field' => 'price'])], [$this->textField('price')]), 1))->assertOk();
        $trashed = $this->postJson(self::BASE, ['name' => 'Old', 'width' => 300, 'height' => 300])->json('data.id');
        $this->deleteJson(self::BASE . "/{$trashed}")->assertNoContent();

        $template = $this->postJson(self::TEMPLATES, ['name' => 'Post', 'width' => 1080, 'height' => 1350])->json('data.id');
        $document = $this->document([
            $this->layer('block', ['blockId' => $block, 'scale' => 0.5, 'w' => 200, 'h' => 100, 'anchor' => 'tr', 'x' => -40, 'y' => 40]),
            $this->layer('block', ['blockId' => $block, 'scale' => 1, 'w' => 400, 'h' => 200]),
        ]);
        $this->putJson(self::TEMPLATES . "/{$template}", $this->templateSave($document, 1))->assertOk()
            ->assertJsonPath('data.blocks.0.id', $block)->assertJsonPath('data.blocks.0.document.fields.0.key', 'price');
        $this->assertSame(1, CreatorUsage::query()->where('owner_type', 'template')->where('target_type', 'block')->where('target_id', $block)->count());
        $this->getJson(self::TEMPLATES . "/{$template}")->assertOk()->assertJsonCount(1, 'data.blocks')->assertJsonPath('data.blocks.0.width', 400);

        foreach ([$foreign, $trashed, 9999] as $i => $refused) {
            $this->putJson(self::TEMPLATES . "/{$template}", $this->templateSave($this->document([$this->layer('block', ['blockId' => $refused])]), 2))
                ->assertUnprocessable()->assertJsonValidationErrors(['document.pages.0.layers.0.blockId']);
        }

        $this->post(self::TEMPLATES . "/{$template}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertOk();
        $this->assertFalse(CreatorTemplate::find($template)->thumb_stale);
        $this->putJson(self::BASE . "/{$block}", $this->blockSave($this->document([$this->layer('text', ['field' => 'price'])], [$this->textField('price')]), 2, ['width' => 500]))
            ->assertOk()->assertJsonPath('data.used_by.0.id', $template)->assertJsonPath('data.used_by.0.kind', 'template');
        $this->assertTrue(CreatorTemplate::find($template)->thumb_stale);
        $this->getJson(self::TEMPLATES)->assertJsonPath('data.0.thumb_stale', true);
        $this->post(self::TEMPLATES . "/{$template}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertOk();
        $this->assertFalse(CreatorTemplate::find($template)->thumb_stale);
        $this->getJson(self::BASE)->assertJsonPath('data.0.used_by.0.name', 'Post');

        $copy = $this->postJson(self::TEMPLATES . "/{$template}/duplicate", ['name' => 'Story', 'width' => 1080, 'height' => 1920])->assertCreated()
            ->assertJsonPath('data.blocks.0.id', $block)->json('data.id');
        $this->assertSame(1, CreatorUsage::query()->where('owner_id', $copy)->where('target_type', 'block')->count());
        $this->assertNotSame($other->id, $owner->id);
    }

    /**
     * @description A block used by a template (also one in the trash) cannot be deleted - the
     *   answer names the templates; an image used only by a block cannot be deleted either;
     *   deleting the template for good frees the block.
     * @input block with an own image, used by a template; template moved to the trash; then deleted for good.
     * @output 409 in_use with the template (trashed false, then true); image 409 with the block
     *   (kind block); finally 204 for the block and the image.
     */
    public function test_used_block_cannot_be_deleted(): void
    {
        $this->signIn($this->creator());
        $asset = $this->uploadAsset();
        $block = $this->postJson(self::BASE, ['name' => 'Logo', 'width' => 300, 'height' => 300])->json('data.id');
        $this->putJson(self::BASE . "/{$block}", $this->blockSave($this->document([$this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $asset]])]), 1, ['name' => 'Logo']))->assertOk();
        $template = $this->postJson(self::TEMPLATES, ['name' => 'Uses logo', 'width' => 1080, 'height' => 1080])->json('data.id');
        $this->putJson(self::TEMPLATES . "/{$template}", $this->templateSave($this->document([$this->layer('block', ['blockId' => $block])]), 1, ['name' => 'Uses logo']))->assertOk();

        $this->deleteJson(self::BASE . "/{$block}")->assertStatus(409)->assertJsonPath('error_code', 'in_use')
            ->assertJsonPath('used_by.0.name', 'Uses logo')->assertJsonPath('used_by.0.trashed', false);
        $this->deleteJson("/api/js-creator/library/assets/{$asset}")->assertStatus(409)
            ->assertJsonPath('used_by.0.kind', 'block')->assertJsonPath('used_by.0.name', 'Logo');
        $this->getJson('/api/js-creator/library/assets')->assertJsonPath('data.0.used_by.0.kind', 'block');

        $this->deleteJson(self::TEMPLATES . "/{$template}")->assertNoContent();
        $this->deleteJson(self::BASE . "/{$block}")->assertStatus(409)->assertJsonPath('used_by.0.trashed', true);
        $this->deleteJson(self::TEMPLATES . "/{$template}?force=1")->assertNoContent();

        $this->deleteJson(self::BASE . "/{$block}")->assertNoContent();
        $this->deleteJson(self::BASE . "/{$block}?force=1")->assertNoContent();
        $this->deleteJson("/api/js-creator/library/assets/{$asset}")->assertNoContent();
        $this->assertSame(0, CreatorUsage::count());
    }

    /**
     * @description Thumbnail (WebP behind a signed URL, quota), copy (also to another size), trash
     *   (restore, empty) and a block of the trash that cannot be opened or saved.
     * @input block with a thumbnail and an own image; copy; copy to 600×600; trash flow.
     * @output thumbnail 480 px wide; thumb bytes in the quota; copies with usages; trash works.
     */
    public function test_thumbnail_copy_and_trash(): void
    {
        $user = $this->signIn($this->creator());
        $asset = $this->uploadAsset();
        $id = $this->postJson(self::BASE, ['name' => 'Badge', 'width' => 960, 'height' => 600])->json('data.id');
        $this->putJson(self::BASE . "/{$id}", $this->blockSave($this->document([$this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $asset]])]), 1, ['width' => 960, 'height' => 600]))->assertOk();
        $url = $this->post(self::BASE . "/{$id}/thumbnail", ['thumb' => $this->png(960, 600, 'thumb.png')], ['Accept' => 'application/json'])
            ->assertOk()->json('data.thumb_url');
        $this->assertStringContainsString('/js-creator/files/blocks/', $url);
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/webp');
        $block = CreatorBlock::find($id);
        $info = getimagesizefromstring(Storage::disk('private')->get($block->thumb_path));
        $this->assertSame([480, 300], [$info[0], $info[1]]);
        $this->assertGreaterThanOrEqual($block->thumb_bytes, WorkspaceQuota::usedBytes($user->id));
        $this->getJson('/api/js-creator/usage')->assertJsonPath('data.used_bytes', WorkspaceQuota::usedBytes($user->id));

        $same = $this->postJson(self::BASE . "/{$id}/duplicate", ['name' => 'Badge (copy)'])->assertCreated()->json('data');
        $this->assertNotNull($same['thumb_url']);
        $this->postJson(self::BASE . "/{$id}/duplicate", ['name' => 'Square', 'width' => 600, 'height' => 600])->assertCreated()
            ->assertJsonPath('data.thumb_url', null)->assertJsonPath('data.width', 600);
        $this->assertSame(3, CreatorUsage::query()->where('target_type', 'asset')->where('target_id', $asset)->count());

        $this->deleteJson(self::BASE . "/{$id}")->assertNoContent();
        $this->getJson(self::BASE . "/{$id}")->assertNotFound();
        $this->putJson(self::BASE . "/{$id}", $this->blockSave($this->document(), 2))->assertNotFound();
        $this->getJson(self::BASE . '?only_trashed=1')->assertJsonCount(1, 'data');
        $this->postJson(self::BASE . "/{$id}/restore")->assertOk();
        $this->deleteJson(self::BASE . "/{$id}")->assertNoContent();
        $thumb = CreatorBlock::withTrashed()->find($id)->thumb_path;
        $this->deleteJson(self::BASE . '/trash')->assertNoContent();
        $this->assertNull(CreatorBlock::withTrashed()->find($id));
        Storage::disk('private')->assertMissing($thumb);
        $this->assertSame(2, CreatorBlock::count());
    }

    /**
     * @description Another account and the sysadmin never reach a block (404 everywhere, empty
     *   list); without the permissions the API refuses (403).
     * @input block of one account; two intruders; account with view only.
     * @output 404 / empty list; one block of the owner; 403 for create and save.
     */
    public function test_workspaces_are_isolated(): void
    {
        $owner = $this->signIn($this->creator());
        $id = $this->postJson(self::BASE, ['name' => 'Secret', 'width' => 300, 'height' => 300])->json('data.id');

        foreach ([$this->creator(), $this->sysadmin()] as $intruder) {
            $this->signIn($intruder);
            $this->getJson(self::BASE)->assertOk()->assertJsonCount(0, 'data');
            $this->getJson(self::BASE . "/{$id}")->assertNotFound();
            $this->putJson(self::BASE . "/{$id}", $this->blockSave($this->document(), 1))->assertNotFound();
            $this->post(self::BASE . "/{$id}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertNotFound();
            $this->postJson(self::BASE . "/{$id}/duplicate", ['name' => 'Mine'])->assertNotFound();
            $this->postJson(self::BASE . "/{$id}/restore")->assertNotFound();
            $this->deleteJson(self::BASE . "/{$id}")->assertNotFound();
            $this->deleteJson(self::BASE . "/{$id}?force=1")->assertNotFound();
        }
        $this->assertSame($owner->id, CreatorBlock::sole()->user_id);

        $this->signIn($this->creator(['view']));
        $this->postJson(self::BASE, ['name' => 'X', 'width' => 300, 'height' => 300])->assertForbidden();
        $this->putJson(self::BASE . "/{$id}", $this->blockSave($this->document(), 1))->assertForbidden();
        $this->get('/api/js-creator/files/blocks/' . $id)->assertForbidden();
    }

    /**
     * @description Retention deletes blocks of the trash after the period (with thumbnail and
     *   usages); the clean-up keeps the thumbnails of blocks.
     * @input block trashed 31 days ago with a thumbnail and an own image; active block with a thumbnail.
     * @output purge counts it; file and usages gone; the image can be deleted; the active thumbnail stays.
     */
    public function test_retention_of_trashed_blocks(): void
    {
        $this->signIn($this->creator());
        $asset = $this->uploadAsset();
        $old = $this->postJson(self::BASE, ['name' => 'Old', 'width' => 300, 'height' => 300])->json('data.id');
        $this->putJson(self::BASE . "/{$old}", $this->blockSave($this->document([$this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $asset]])]), 1))->assertOk();
        $this->post(self::BASE . "/{$old}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertOk();
        $active = $this->postJson(self::BASE, ['name' => 'Active', 'width' => 300, 'height' => 300])->json('data.id');
        $this->post(self::BASE . "/{$active}/thumbnail", ['thumb' => $this->png(100, 100, 'thumb.png')], ['Accept' => 'application/json'])->assertOk();
        $this->deleteJson(self::BASE . "/{$old}")->assertNoContent();
        CreatorBlock::withTrashed()->whereKey($old)->update(['deleted_at' => Carbon::now()->subDays(31)]);
        $oldThumb = CreatorBlock::withTrashed()->find($old)->thumb_path;
        $activeThumb = CreatorBlock::find($active)->thumb_path;

        $source = new JsCreatorRetentionSource();
        $this->assertSame(1, $source->purge('js_creator_trash', Carbon::now()->subDays(30)));
        $this->assertNull(CreatorBlock::withTrashed()->find($old));
        Storage::disk('private')->assertMissing($oldThumb);
        $this->assertSame(0, CreatorUsage::count());
        $this->deleteJson("/api/js-creator/library/assets/{$asset}")->assertNoContent();

        Carbon::setTestNow(Carbon::now()->addDays(2));
        $source->cleanUp();
        Carbon::setTestNow();
        Storage::disk('private')->assertExists($activeThumb);
    }

    /**
     * @description Body of a save of the block editor.
     * @param array<string, mixed> $document Document.
     * @param int $version Version the editor started from.
     * @param array<string, mixed> $overrides Further properties.
     * @return array<string, mixed>
     */
    private function blockSave(array $document, int $version, array $overrides = []): array
    {
        return array_replace(['name' => 'Block', 'width' => 400, 'height' => 200, 'version' => $version, 'document' => $document], $overrides);
    }

    /**
     * @description Body of a save of the template editor.
     * @param array<string, mixed> $document Document.
     * @param int $version Version the editor started from.
     * @param array<string, mixed> $overrides Further properties.
     * @return array<string, mixed>
     */
    private function templateSave(array $document, int $version, array $overrides = []): array
    {
        return array_replace([
            'name' => 'Post', 'width' => 1080, 'height' => 1350, 'output_format' => 'png', 'output_quality' => 90,
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
