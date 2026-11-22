<?php

/**
 * @file PresetTest.php
 * @path api/tests/Apps/JsCreator/Feature/PresetTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the presets of generating (PresetController, PresetValues):
 *   save / list / overwrite / delete of a template's and a set's presets with texts kept exactly
 *   as typed, the strict check of the values (keys, texts, images, crops of the templates of the
 *   preset, caption, size), unique names, the limit, ownership of the owner and of the library
 *   images, permissions, isolation of workspaces, presets gone with their template and the log
 *   without names or values.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorPreset;
use App\Apps\JsCreator\Models\JsCreatorLog;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/images/presets.
 */
class PresetTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Base path of the presets of the section Images. */
    private const BASE = '/api/js-creator/images/presets';

    /** @description Base path of the templates of the section Images. */
    private const TEMPLATES = '/api/js-creator/images/templates';

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description A preset of a template keeps texts exactly (spaces, line breaks, empty text),
     *   a library image and the crop; the list of the template has it; an overwrite replaces
     *   name and values; a delete removes it; empty maps come back as objects; the log has no
     *   name and no values.
     * @input template 7 with title + photo; library image; POST with "  Léto **50 %** \n", ""
     *   subtitle, image, crop and caption; list; PUT "Zima"; DELETE.
     * @output 201 with the exact texts; list [Léto]; 200 renamed with texts {}; 204; empty list;
     *   no log row mentions "Léto" or the text.
     */
    public function test_save_list_overwrite_and_delete(): void
    {
        $this->signIn($this->creator());
        $template = $this->template();
        $asset = $this->asset();
        $values = [
            'texts'   => ['title' => "  Léto **50 %** \n", 'subtitle' => ''],
            'images'  => ['photo' => $asset],
            'crops'   => [(string) $template => ['photo' => ['focusX' => 0.25, 'focusY' => 1, 'zoom' => 2.5]]],
            'caption' => "Text\npříspěvku",
        ];
        $id = $this->postJson(self::BASE, ['name' => ' Léto ', 'template_id' => $template, 'values' => $values])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Léto')
            ->assertJsonPath('data.template_id', $template)
            ->assertJsonPath('data.set_id', null)
            ->assertJsonPath('data.values.texts.title', "  Léto **50 %** \n")
            ->assertJsonPath('data.values.texts.subtitle', '')
            ->assertJsonPath('data.values.images.photo', $asset)
            ->assertJsonPath("data.values.crops.{$template}.photo.zoom", 2.5)
            ->assertJsonPath('data.values.caption', "Text\npříspěvku")
            ->json('data.id');

        $this->getJson(self::BASE . "?template_id={$template}")->assertOk()->assertJsonPath('data.0.id', $id)->assertJsonCount(1, 'data');
        $this->getJson(self::BASE)->assertStatus(422);

        $empty = ['texts' => [], 'images' => [], 'crops' => [], 'caption' => null];
        $response = $this->putJson(self::BASE . "/{$id}", ['name' => 'Zima', 'values' => $empty])->assertOk()->assertJsonPath('data.name', 'Zima');
        $this->assertStringContainsString('"texts":{}', $response->getContent());
        $this->assertStringContainsString('"crops":{}', $response->getContent());

        $this->deleteJson(self::BASE . "/{$id}")->assertNoContent();
        $this->getJson(self::BASE . "?template_id={$template}")->assertOk()->assertJsonCount(0, 'data');

        $logs = JsCreatorLog::query()->where('module', 'Preset')->get();
        $this->assertCount(3, $logs);
        $this->assertStringNotContainsString('Léto', $logs->toJson(JSON_UNESCAPED_UNICODE));
        $this->assertStringNotContainsString('příspěvku', $logs->toJson(JSON_UNESCAPED_UNICODE));
    }

    /**
     * @description The values are checked strictly; names are unique per template ignoring case;
     *   a template has at most 50 presets.
     * @input broken values (missing key, list, bad key, long text, control character, image not
     *   an id, foreign crop template, crop out of range, crop with an extra key, caption too
     *   long, too large); "léto" twice; 50 presets + one.
     * @output 422 with the path of each error; 422 name; 422 error_code preset_limit.
     */
    public function test_values_names_and_limit(): void
    {
        $this->signIn($this->creator());
        $template = $this->template();
        $ok = ['texts' => ['title' => 'A'], 'images' => [], 'crops' => [], 'caption' => null];
        $broken = [
            'values'                       => ['texts' => [], 'images' => [], 'crops' => []],
            'values.texts'                 => [...$ok, 'texts' => ['A', 'B']],
            'values.texts.Title!'          => [...$ok, 'texts' => ['Title!' => 'A']],
            'values.texts.title'           => [...$ok, 'texts' => ['title' => str_repeat('x', 2001)]],
            'values.texts.subtitle'        => [...$ok, 'texts' => ['subtitle' => "a\x07b"]],
            'values.images.photo'          => [...$ok, 'images' => ['photo' => 'logo.png']],
            'values.crops.999'             => [...$ok, 'crops' => ['999' => ['photo' => ['focusX' => 0.5, 'focusY' => 0.5, 'zoom' => 1]]]],
            "values.crops.{$template}.photo" => [...$ok, 'crops' => [(string) $template => ['photo' => ['focusX' => 1.5, 'focusY' => 0.5, 'zoom' => 1]]]],
            "values.crops.{$template}.logo"  => [...$ok, 'crops' => [(string) $template => ['logo' => ['focusX' => 0, 'focusY' => 0, 'zoom' => 1, 'x' => 1]]]],
            'values.caption'               => [...$ok, 'caption' => str_repeat('x', 5001)],
        ];
        foreach ($broken as $path => $values) {
            $this->postJson(self::BASE, ['name' => 'Broken', 'template_id' => $template, 'values' => $values])
                ->assertStatus(422)->assertJsonValidationErrors([$path]);
        }
        $large = [...$ok, 'texts' => array_combine(array_map(fn ($i) => "field_{$i}", range(1, 40)), array_fill(0, 40, str_repeat('ž', 1000)))];
        $this->postJson(self::BASE, ['name' => 'Large', 'template_id' => $template, 'values' => $large])->assertStatus(422)->assertJsonValidationErrors(['values']);

        $this->postJson(self::BASE, ['name' => 'Léto', 'template_id' => $template, 'values' => $ok])->assertCreated();
        $this->postJson(self::BASE, ['name' => 'léto', 'template_id' => $template, 'values' => $ok])->assertStatus(422)->assertJsonValidationErrors(['name']);

        for ($i = 2; $i <= CreatorPreset::MAX_PER_OWNER; $i++) {
            CreatorPreset::create(['user_id' => auth()->id(), 'section' => 'images', 'template_id' => $template, 'name' => "P{$i}", 'payload' => $ok]);
        }
        $this->postJson(self::BASE, ['name' => 'Too many', 'template_id' => $template, 'values' => $ok])
            ->assertStatus(422)->assertJsonPath('error_code', 'preset_limit');
    }

    /**
     * @description A preset of a set may store crops of the set's templates; the owner and the
     *   images must be own ones outside the trash; another account sees and changes nothing;
     *   permissions are needed; a template deleted for good takes its presets with it.
     * @input set of two templates; crops of both; foreign template / set / image; template in
     *   the trash; account B; view-only account; force delete of the template.
     * @output 201; 422 template_id / set_id / values.images.photo; B: empty list, 404 on PUT / DELETE;
     *   view-only: list 200, POST 403; presets of the template gone.
     */
    public function test_sets_ownership_permissions_and_cascade(): void
    {
        $owner = $this->creator();
        $other = $this->creator();
        $this->signIn($other);
        $foreignTemplate = $this->template();
        $foreignAsset = $this->asset();
        $foreignSet = $this->postJson('/api/js-creator/images/sets', ['name' => 'B', 'template_ids' => [$foreignTemplate]])->json('data.id');

        $this->signIn($owner);
        $a = $this->template();
        $b = $this->template();
        $set = $this->postJson('/api/js-creator/images/sets', ['name' => 'Kampaň', 'template_ids' => [$a, $b]])->assertCreated()->json('data.id');
        $crop = ['photo' => ['focusX' => 0.5, 'focusY' => 0.5, 'zoom' => 1]];
        $values = ['texts' => ['title' => 'A'], 'images' => [], 'crops' => [(string) $a => $crop, (string) $b => $crop], 'caption' => null];
        $id = $this->postJson(self::BASE, ['name' => 'Sada', 'set_id' => $set, 'values' => $values])->assertCreated()->assertJsonPath('data.set_id', $set)->json('data.id');
        $this->getJson(self::BASE . "?set_id={$set}")->assertOk()->assertJsonCount(1, 'data');

        $this->postJson(self::BASE, ['name' => 'X', 'template_id' => $foreignTemplate, 'values' => $values])->assertStatus(422)->assertJsonValidationErrors(['template_id']);
        $this->postJson(self::BASE, ['name' => 'X', 'set_id' => $foreignSet, 'values' => $values])->assertStatus(422)->assertJsonValidationErrors(['set_id']);
        $this->postJson(self::BASE, ['name' => 'X', 'template_id' => $a, 'set_id' => $set, 'values' => $values])->assertStatus(422);
        $foreignImage = ['texts' => [], 'images' => ['photo' => $foreignAsset], 'crops' => [], 'caption' => null];
        $this->postJson(self::BASE, ['name' => 'X', 'template_id' => $a, 'values' => $foreignImage])->assertStatus(422)->assertJsonValidationErrors(['values.images.photo']);
        $this->deleteJson(self::TEMPLATES . "/{$b}")->assertNoContent();
        $this->postJson(self::BASE, ['name' => 'X', 'template_id' => $b, 'values' => $values])->assertStatus(422)->assertJsonValidationErrors(['template_id']);

        $this->signIn($other);
        $this->getJson(self::BASE . "?set_id={$set}")->assertOk()->assertJsonCount(0, 'data');
        $this->putJson(self::BASE . "/{$id}", ['name' => 'Y', 'values' => $values])->assertNotFound();
        $this->deleteJson(self::BASE . "/{$id}")->assertNotFound();

        $this->signIn($this->creator(['view']));
        $this->getJson(self::BASE . "?set_id={$set}")->assertOk();
        $this->postJson(self::BASE, ['name' => 'X', 'set_id' => $set, 'values' => $values])->assertForbidden();

        $this->signIn($owner);
        $templatePreset = $this->postJson(self::BASE, ['name' => 'T', 'template_id' => $a, 'values' => ['texts' => [], 'images' => [], 'crops' => [], 'caption' => null]])
            ->assertCreated()->json('data.id');
        $this->deleteJson(self::TEMPLATES . "/{$a}")->assertNoContent();
        $this->deleteJson(self::TEMPLATES . "/{$a}?force=1")->assertNoContent();
        $this->assertNull(CreatorPreset::find($templatePreset));
        $this->assertNotNull(CreatorPreset::find($id));
    }

    /**
     * @description New template of the signed-in account with a text field and an image field.
     * @return int Template id.
     */
    private function template(): int
    {
        $id = (int) $this->postJson(self::TEMPLATES, ['name' => 'Post', 'width' => 1080, 'height' => 1080])->assertCreated()->json('data.id');
        $fields = [$this->textField('title'), $this->imageField('photo')];
        $this->putJson(self::TEMPLATES . "/{$id}", [
            'name' => 'Post', 'width' => 1080, 'height' => 1080, 'output_format' => 'png', 'output_quality' => 90, 'caption_template' => null, 'version' => 1,
            'document' => $this->document([$this->layer('text', ['field' => 'title']), $this->layer('image', ['source' => ['kind' => 'field', 'field' => 'photo']])], $fields),
        ])->assertOk();

        return $id;
    }

    /**
     * @description New library image of the signed-in account.
     * @return int Asset id.
     */
    private function asset(): int
    {
        return (int) $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.0.id');
    }
}
