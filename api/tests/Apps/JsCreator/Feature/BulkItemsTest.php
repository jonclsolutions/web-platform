<?php

/**
 * @file BulkItemsTest.php
 * @path api/tests/Apps/JsCreator/Feature/BulkItemsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the bulk actions of the lists (multiselect): templates, blocks
 *   and sets to the trash, back and deleted for good; foreign items are ignored, used blocks are
 *   skipped with their templates; the request is validated and needs `delete`.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorSet;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\CreatorUsage;
use App\Apps\JsCreator\Models\JsCreatorLog;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/images/{templates,blocks,sets}/bulk.
 */
class BulkItemsTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Base path of the section Images. */
    private const BASE = '/api/js-creator/images';

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description Templates: several to the trash (a foreign one untouched), back, and deleted
     *   for good with their usages; restore / destroy only reach the trash.
     * @input 3 own templates + 1 foreign; delete [a, b, foreign]; restore [a, c]; delete b again
     *   is ignored; destroy [b].
     * @output count 2 / 1 / 1; foreign stays; b gone with its usages; log soft_delete / restore / hard_delete.
     */
    public function test_templates_in_bulk(): void
    {
        $this->signIn($this->creator());
        $foreign = $this->template('Foreign');
        $this->signIn($this->creator());
        [$a, $b, $c] = [$this->template('A'), $this->template('B', true), $this->template('C')];

        $this->postJson(self::BASE . '/templates/bulk', ['action' => 'delete', 'ids' => [$a, $b, $foreign]])
            ->assertOk()->assertJsonPath('data.count', 2)->assertJsonPath('data.skipped', []);
        $this->assertFalse(CreatorTemplate::find($foreign)->trashed());
        $this->assertSame([$a, $b], CreatorTemplate::onlyTrashed()->orderBy('id')->pluck('id')->all());

        $this->postJson(self::BASE . '/templates/bulk', ['action' => 'restore', 'ids' => [$a, $c]])->assertOk()->assertJsonPath('data.count', 1);
        $this->postJson(self::BASE . '/templates/bulk', ['action' => 'destroy', 'ids' => [$a, $b]])->assertOk()->assertJsonPath('data.count', 1);
        $this->assertNull(CreatorTemplate::withTrashed()->find($b));
        $this->assertNotNull(CreatorTemplate::find($a));
        $this->assertSame(0, CreatorUsage::query()->where('owner_type', 'template')->where('owner_id', $b)->count());
        $this->assertSame(['soft_delete', 'restore', 'hard_delete'], JsCreatorLog::query()->where('module', 'Template')
            ->where('description', 'like', 'Templates in bulk%')->orderBy('id')->pluck('event_type')->all());
    }

    /**
     * @description Blocks used by a template are skipped (named with their templates); the others
     *   go to the trash and can be deleted for good.
     * @input block used by a template + free block; delete both; destroy both.
     * @output count 1, skipped [used block with used_by]; destroy count 1; the used block stays.
     */
    public function test_used_blocks_are_skipped(): void
    {
        $this->signIn($this->creator());
        $used = $this->block('Used');
        $free = $this->block('Free');
        $this->template('Post', false, [$this->layer('block', ['blockId' => $used])]);

        $response = $this->postJson(self::BASE . '/blocks/bulk', ['action' => 'delete', 'ids' => [$used, $free]])->assertOk()
            ->assertJsonPath('data.count', 1)->assertJsonPath('data.skipped.0.id', $used)->assertJsonPath('data.skipped.0.name', 'Used');
        $this->assertSame('Post', $response->json('data.skipped.0.used_by.0.name'));
        $this->postJson(self::BASE . '/blocks/bulk', ['action' => 'destroy', 'ids' => [$used, $free]])->assertOk()->assertJsonPath('data.count', 1);
        $this->assertNotNull(CreatorBlock::find($used));
        $this->assertNull(CreatorBlock::withTrashed()->find($free));
    }

    /**
     * @description Sets go to the trash, back and away for good; their templates stay.
     * @input two sets of one template; delete both, restore one, destroy the other.
     * @output counts 2, 1, 1; the template is untouched.
     */
    public function test_sets_in_bulk(): void
    {
        $this->signIn($this->creator());
        $template = $this->template('Post');
        $ids = array_map(fn (string $name) => (int) $this->postJson(self::BASE . '/sets', ['name' => $name, 'template_ids' => [$template]])
            ->assertCreated()->json('data.id'), ['One', 'Two']);

        $this->postJson(self::BASE . '/sets/bulk', ['action' => 'delete', 'ids' => $ids])->assertOk()->assertJsonPath('data.count', 2);
        $this->postJson(self::BASE . '/sets/bulk', ['action' => 'restore', 'ids' => [$ids[0]]])->assertOk()->assertJsonPath('data.count', 1);
        $this->postJson(self::BASE . '/sets/bulk', ['action' => 'destroy', 'ids' => $ids])->assertOk()->assertJsonPath('data.count', 1);
        $this->assertSame([$ids[0]], CreatorSet::withTrashed()->pluck('id')->all());
        $this->assertNotNull(CreatorTemplate::find($template));
    }

    /**
     * @description The request is validated and needs the permission `delete`.
     * @input unknown action; no ids; 201 ids; duplicate ids; account without delete.
     * @output 422 at action / ids / ids.1; 403.
     */
    public function test_validation_and_permission(): void
    {
        $this->signIn($this->creator());
        $this->postJson(self::BASE . '/templates/bulk', ['action' => 'move', 'ids' => [1]])->assertStatus(422)->assertJsonValidationErrors('action');
        $this->postJson(self::BASE . '/templates/bulk', ['action' => 'delete', 'ids' => []])->assertStatus(422)->assertJsonValidationErrors('ids');
        $this->postJson(self::BASE . '/blocks/bulk', ['action' => 'delete', 'ids' => range(1, 201)])->assertStatus(422)->assertJsonValidationErrors('ids');
        $this->postJson(self::BASE . '/sets/bulk', ['action' => 'delete', 'ids' => [1, 1]])->assertStatus(422)->assertJsonValidationErrors('ids.1');

        $this->signIn($this->creator(['view', 'create', 'update']));
        $this->postJson(self::BASE . '/templates/bulk', ['action' => 'delete', 'ids' => [1]])->assertForbidden();
    }

    /**
     * @description Creates a template of the signed-in account (optionally with an own image).
     * @param string $name
     * @param bool $withImage Uses an uploaded image (a usage row).
     * @param array<int, array<string, mixed>> $layers Further layers.
     * @return int Its id.
     */
    private function template(string $name, bool $withImage = false, array $layers = []): int
    {
        if ($withImage) {
            $asset = (int) $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->assertCreated()->json('data.0.id');
            $layers[] = $this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $asset]]);
        }
        $id = (int) $this->postJson(self::BASE . '/templates', ['name' => $name, 'width' => 1080, 'height' => 1080])->assertCreated()->json('data.id');
        if ($layers !== []) {
            $this->putJson(self::BASE . "/templates/{$id}", [
                'name' => $name, 'width' => 1080, 'height' => 1080, 'output_format' => 'png', 'output_quality' => 90,
                'caption_template' => null, 'version' => 1, 'document' => $this->document($layers),
            ])->assertOk();
        }

        return $id;
    }

    /**
     * @description Creates a block of the signed-in account.
     * @param string $name
     * @return int Its id.
     */
    private function block(string $name): int
    {
        return (int) $this->postJson(self::BASE . '/blocks', ['name' => $name, 'width' => 400, 'height' => 200])->assertCreated()->json('data.id');
    }
}
