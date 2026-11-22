<?php

/**
 * @file SetTest.php
 * @path api/tests/Apps/JsCreator/Feature/SetTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the sets (SetController): new / list / detail / save with the
 *   templates in their order, the check of the templates (own templates of the section; a
 *   template in the trash only when it already is in the set; at most 10) and of the kinds of
 *   their fields (block fields included - 422 `field_conflict`), a template deleted for good
 *   leaves its sets, trash, the isolation of workspaces and the retention.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorSet;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\JsCreatorRetentionSource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/images/sets.
 */
class SetTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Base path of the sets of the section Images. */
    private const BASE = '/api/js-creator/images/sets';

    /** @description Base path of the templates of the section Images. */
    private const TEMPLATES = '/api/js-creator/images/templates';

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description A set keeps its templates in the given order and its caption pattern; a save
     *   replaces them; the list searches names; the log never names a set.
     * @input templates portrait + story with the same fields; new set [story, portrait]; save
     *   [portrait, story] with an empty pattern.
     * @output 201 with the templates in order and their sizes; 200 with the new order and pattern
     *   null; list / search.
     */
    public function test_create_save_and_list(): void
    {
        $this->signIn($this->creator());
        $portrait = $this->template('Portrait', 1080, 1350, [$this->textField('title'), $this->imageField('photo')]);
        $story = $this->template('Story', 1080, 1920, [$this->textField('title')]);

        $id = $this->postJson(self::BASE, ['name' => ' Launch ', 'caption_template' => 'New: {{title}}', 'template_ids' => [$story, $portrait]])
            ->assertCreated()->assertJsonPath('data.name', 'Launch')->assertJsonPath('data.caption_template', 'New: {{title}}')
            ->assertJsonPath('data.templates.0.id', $story)->assertJsonPath('data.templates.0.height', 1920)
            ->assertJsonPath('data.templates.1.id', $portrait)->assertJsonPath('data.templates.1.trashed', false)->json('data.id');

        $this->putJson(self::BASE . "/{$id}", ['name' => 'Launch', 'caption_template' => '', 'template_ids' => [$portrait, $story]])->assertOk()
            ->assertJsonPath('data.caption_template', null)->assertJsonPath('data.templates.0.id', $portrait)->assertJsonPath('data.templates.1.id', $story);
        $this->getJson(self::BASE . "/{$id}")->assertOk()->assertJsonCount(2, 'data.templates');
        $this->getJson(self::BASE)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.templates.1.name', 'Story');
        $this->getJson(self::BASE . '?search=launch')->assertJsonCount(1, 'data');
        $this->getJson(self::BASE . '?search=none')->assertJsonCount(0, 'data');
        $this->postJson(self::BASE, ['name' => 'Empty', 'template_ids' => []])->assertCreated()->assertJsonPath('data.templates', []);

        $this->assertSame("Set #{$id} created", JsCreatorLog::query()->where('affected_entity_type', 'Set')->first()?->description);
        $this->assertStringNotContainsString('Launch', JsCreatorLog::query()->get()->toJson());
    }

    /**
     * @description Fields with the same key must have the same kind in every template of a set -
     *   also the fields of block instances (with their free keys).
     * @input template A: photo (image); template B: photo (text); template C: instance of a block
     *   with the field photo (text) next to its own photo (image) → its block field is photo_2.
     * @output A + B → 422 field_conflict naming photo; A + C → 201 (photo stays image, photo_2 is
     *   new); C + D where D has photo_2 as an image → 422.
     */
    public function test_fields_must_have_the_same_kind(): void
    {
        $this->signIn($this->creator());
        $a = $this->template('A', 1080, 1350, [$this->imageField('photo')]);
        $b = $this->template('B', 1080, 1920, [$this->textField('photo')]);
        $this->postJson(self::BASE, ['name' => 'Conflict', 'template_ids' => [$a, $b]])
            ->assertUnprocessable()->assertJsonPath('error_code', 'field_conflict')->assertJsonPath('conflict.key', 'photo')
            ->assertJsonPath('conflict.template_id', $b)->assertJsonPath('conflict.other_id', $a)
            ->assertJsonPath('conflict.type', 'text')->assertJsonPath('conflict.other_type', 'image')
            ->assertJsonValidationErrors(['template_ids.1']);

        $block = $this->postJson('/api/js-creator/images/blocks', ['name' => 'Tag', 'width' => 400, 'height' => 200,
            'document' => $this->document([$this->layer('text', ['field' => 'photo'])], [$this->textField('photo')])])->json('data.id');
        $c = $this->template('C', 1080, 1080, [$this->imageField('photo')], [$this->layer('block', ['blockId' => $block])]);
        $this->postJson(self::BASE, ['name' => 'OK', 'template_ids' => [$a, $c]])->assertCreated();

        $d = $this->template('D', 1200, 630, [$this->imageField('photo_2')]);
        $this->postJson(self::BASE, ['name' => 'Block conflict', 'template_ids' => [$c, $d]])
            ->assertUnprocessable()->assertJsonPath('conflict.key', 'photo_2');
        $this->assertSame(1, CreatorSet::count());
    }

    /**
     * @description The templates of a set: own templates of the section only, a template of the
     *   trash only when it already is in the set (generating skips it), at most 10, no repeats; a
     *   template deleted for good leaves the set.
     * @input foreign template; repeated id; 11 ids; template in the trash added / kept.
     * @output 422 for the foreign one, repeats and 11; 422 for a new trashed one; 200 for a kept
     *   one (trashed: true); after force delete the set has one template left.
     */
    public function test_templates_of_a_set_are_checked(): void
    {
        $this->signIn($this->creator());
        $foreign = $this->template('Foreign', 1080, 1080);
        $this->signIn($this->creator());
        $a = $this->template('A', 1080, 1350);
        $b = $this->template('B', 1080, 1920);

        $this->postJson(self::BASE, ['name' => 'X', 'template_ids' => [$a, $foreign]])->assertUnprocessable()->assertJsonValidationErrors(['template_ids.1']);
        $this->postJson(self::BASE, ['name' => 'X', 'template_ids' => [$a, $a]])->assertUnprocessable();
        $this->postJson(self::BASE, ['name' => 'X', 'template_ids' => range(1, 11)])->assertUnprocessable()->assertJsonValidationErrors(['template_ids']);
        $this->postJson(self::BASE, ['name' => 'X'])->assertUnprocessable();

        $id = $this->postJson(self::BASE, ['name' => 'Set', 'template_ids' => [$a, $b]])->assertCreated()->json('data.id');
        $this->deleteJson(self::TEMPLATES . "/{$b}")->assertNoContent();
        $this->getJson(self::BASE . "/{$id}")->assertJsonPath('data.templates.1.trashed', true);
        $this->putJson(self::BASE . "/{$id}", ['name' => 'Set 2', 'template_ids' => [$b, $a]])->assertOk()->assertJsonPath('data.templates.0.trashed', true);
        $this->postJson(self::BASE, ['name' => 'New', 'template_ids' => [$b]])->assertUnprocessable()->assertJsonValidationErrors(['template_ids.0']);

        $this->deleteJson(self::TEMPLATES . "/{$b}?force=1")->assertNoContent();
        $this->getJson(self::BASE . "/{$id}")->assertJsonCount(1, 'data.templates')->assertJsonPath('data.templates.0.id', $a);
        $this->assertSame(1, DB::table('js_creator_set_templates')->count());
    }

    /**
     * @description Trash of sets (the templates stay), isolation (another account and the sysadmin
     *   get 404), permissions (403) and the retention of the trash.
     * @input set with a template; trash flow; intruders; set trashed 31 days ago.
     * @output the flow works; 404 / empty lists for intruders; 403 without create; purge removes
     *   the old set, the template stays.
     */
    public function test_trash_isolation_and_retention(): void
    {
        $owner = $this->signIn($this->creator());
        $template = $this->template('A', 1080, 1080);
        $id = $this->postJson(self::BASE, ['name' => 'Set', 'template_ids' => [$template]])->json('data.id');
        $other = $this->postJson(self::BASE, ['name' => 'Other', 'template_ids' => []])->json('data.id');

        foreach ([$this->creator(), $this->sysadmin()] as $intruder) {
            $this->signIn($intruder);
            $this->getJson(self::BASE)->assertOk()->assertJsonCount(0, 'data');
            $this->getJson(self::BASE . "/{$id}")->assertNotFound();
            $this->putJson(self::BASE . "/{$id}", ['name' => 'Mine', 'template_ids' => []])->assertNotFound();
            $this->postJson(self::BASE . "/{$id}/restore")->assertNotFound();
            $this->deleteJson(self::BASE . "/{$id}")->assertNotFound();
        }
        $this->signIn($this->creator(['view']));
        $this->postJson(self::BASE, ['name' => 'X', 'template_ids' => []])->assertForbidden();

        $this->signIn($owner);
        $this->deleteJson(self::BASE . "/{$id}?force=1")->assertNotFound();
        $this->deleteJson(self::BASE . "/{$id}")->assertNoContent();
        $this->getJson(self::BASE . '?only_trashed=1')->assertJsonCount(1, 'data');
        $this->getJson(self::BASE . "/{$id}")->assertNotFound();
        $this->postJson(self::BASE . "/{$id}/restore")->assertOk()->assertJsonPath('data.templates.0.id', $template);
        $this->deleteJson(self::BASE . "/{$id}")->assertNoContent();
        $this->deleteJson(self::BASE . "/{$id}?force=1")->assertNoContent();
        $this->assertSame(0, DB::table('js_creator_set_templates')->count());
        $this->getJson(self::TEMPLATES . "/{$template}")->assertOk();

        $this->deleteJson(self::BASE . "/{$other}")->assertNoContent();
        CreatorSet::withTrashed()->whereKey($other)->update(['deleted_at' => Carbon::now()->subDays(31)]);
        (new JsCreatorRetentionSource())->purge('js_creator_trash', Carbon::now()->subDays(30));
        $this->assertSame(0, CreatorSet::withTrashed()->count());

        $this->postJson(self::BASE, ['name' => 'Again', 'template_ids' => [$template]])->assertCreated();
        $this->deleteJson(self::BASE . '/' . CreatorSet::sole()->id)->assertNoContent();
        $this->deleteJson(self::BASE . '/trash')->assertNoContent();
        $this->assertSame(0, CreatorSet::withTrashed()->count());
    }

    /**
     * @description Creates a template of the signed-in account with fields (each used by a layer) and further layers.
     * @param string $name Name.
     * @param int $width Width.
     * @param int $height Height.
     * @param array<int, array<string, mixed>> $fields Fields.
     * @param array<int, array<string, mixed>> $layers Further layers.
     * @return int Its id.
     */
    private function template(string $name, int $width, int $height, array $fields = [], array $layers = []): int
    {
        $id = (int) $this->postJson(self::TEMPLATES, ['name' => $name, 'width' => $width, 'height' => $height])->assertCreated()->json('data.id');
        $fieldLayers = array_map(fn (array $field) => $field['type'] === 'text'
            ? $this->layer('text', ['field' => $field['key']])
            : $this->layer('image', ['source' => ['kind' => 'field', 'field' => $field['key']]]), $fields);
        $this->putJson(self::TEMPLATES . "/{$id}", [
            'name' => $name, 'width' => $width, 'height' => $height, 'output_format' => 'png', 'output_quality' => 90,
            'caption_template' => null, 'version' => 1, 'document' => $this->document([...$fieldLayers, ...$layers], $fields),
        ])->assertOk();

        return $id;
    }
}
