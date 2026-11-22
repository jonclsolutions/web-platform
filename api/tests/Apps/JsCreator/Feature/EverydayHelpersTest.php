<?php

/**
 * @file EverydayHelpersTest.php
 * @path api/tests/Apps/JsCreator/Feature/EverydayHelpersTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the helpers of everyday work: starred and recently used
 *   templates (personal marks that do not change the template), the default folder of a
 *   template, the filters of outputs by template and period, and the personal preferences
 *   (brand colours, hashtag sets) with their strict check and isolation.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorOutput;
use App\Apps\JsCreator\Models\JsCreatorLog;
use Illuminate\Support\Carbon;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description Favorites, last use, default folder, output filters, preferences.
 */
class EverydayHelpersTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Base path of the templates of the section Images. */
    private const TEMPLATES = '/api/js-creator/images/templates';

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description A star and the default folder are personal marks: version and time of change
     *   stay; the lists filter starred / used templates; a foreign folder is refused; generating
     *   sets the last use; a folder deleted for good clears the default; another account gets 404.
     * @input templates A, B; star A; default folder of A; foreign folder; output of B; force
     *   delete of the folder; account B
     * @output favorite=1 → [A]; used=1 → [B] with last_used_at; version 1 kept; 422 folder_id; default null
     */
    public function test_favorites_last_use_and_default_folder(): void
    {
        $owner = $this->creator();
        $other = $this->creator();
        $this->signIn($other);
        $foreignFolder = $this->postJson('/api/js-creator/folders', ['name' => 'Cizí'])->assertCreated()->json('data.id');

        $this->signIn($owner);
        $a = $this->postJson(self::TEMPLATES, ['name' => 'A', 'width' => 100, 'height' => 100])->json('data.id');
        $b = $this->postJson(self::TEMPLATES, ['name' => 'B', 'width' => 100, 'height' => 100])->json('data.id');
        $before = $this->getJson(self::TEMPLATES . "/{$a}")->json('data.updated_at');
        Carbon::setTestNow(now()->addMinute());
        $this->putJson(self::TEMPLATES . "/{$a}/favorite", ['favorite' => true])->assertOk()->assertJsonPath('data.favorite', true);
        $this->getJson(self::TEMPLATES . '?favorite=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $a)->assertJsonPath('data.0.favorite', true);
        $this->getJson(self::TEMPLATES . "/{$a}")->assertJsonPath('data.version', 1)->assertJsonPath('data.updated_at', $before);

        $folder = $this->postJson('/api/js-creator/folders', ['name' => 'Akce'])->assertCreated()->json('data.id');
        $this->putJson(self::TEMPLATES . "/{$a}/default-folder", ['folder_id' => $folder])->assertOk()->assertJsonPath('data.default_folder_id', $folder);
        $this->putJson(self::TEMPLATES . "/{$a}/default-folder", ['folder_id' => $foreignFolder])->assertStatus(422)->assertJsonValidationErrors(['folder_id']);
        $this->getJson(self::TEMPLATES . "/{$a}")->assertJsonPath('data.default_folder_id', $folder);

        $this->getJson(self::TEMPLATES . '?used=1')->assertJsonCount(0, 'data');
        $this->post("/api/js-creator/images/outputs", ['file' => $this->png(100, 100, 'o.png'), 'template_id' => $b, 'name' => 'Výstup'], ['Accept' => 'application/json'])->assertCreated();
        $this->getJson(self::TEMPLATES . '?used=1&sort_by=last_used_at')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $b)
            ->assertJsonPath('data.0.last_used_at', now()->format('Y-m-d H:i:s'));

        $this->deleteJson("/api/js-creator/folders/{$folder}")->assertNoContent();
        $this->deleteJson("/api/js-creator/folders/{$folder}?force=1")->assertNoContent();
        $this->getJson(self::TEMPLATES . "/{$a}")->assertJsonPath('data.default_folder_id', null);

        $this->signIn($other);
        $this->putJson(self::TEMPLATES . "/{$a}/favorite", ['favorite' => false])->assertNotFound();
        $this->putJson(self::TEMPLATES . "/{$a}/default-folder", ['folder_id' => null])->assertNotFound();
        Carbon::setTestNow();
    }

    /**
     * @description Outputs filtered by template or period come from every folder; the list of
     *   templates of the outputs has each template once.
     * @input outputs of A (in a folder, today), of B (top level, 10 days ago); filters
     * @output template_id=A → 1 (from the folder); period=week → 1 (A); month → 2; templates [A, B]
     */
    public function test_output_filters(): void
    {
        $this->signIn($this->creator());
        $a = $this->postJson(self::TEMPLATES, ['name' => 'A', 'width' => 100, 'height' => 100])->json('data.id');
        $b = $this->postJson(self::TEMPLATES, ['name' => 'B', 'width' => 100, 'height' => 100])->json('data.id');
        $folder = $this->postJson('/api/js-creator/folders', ['name' => 'Akce'])->json('data.id');
        $send = fn (int $template, ?int $folderId) => $this->post('/api/js-creator/images/outputs',
            ['file' => $this->png(100, 100, 'o.png'), 'template_id' => $template, 'folder_id' => $folderId, 'name' => "T{$template}"], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
        $send($a, $folder);
        $old = $send($b, null);
        CreatorOutput::query()->whereKey($old)->toBase()->update(['created_at' => now()->subDays(10)]);

        $this->getJson("/api/js-creator/outputs?template_id={$a}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.folder_id', $folder);
        $this->getJson('/api/js-creator/outputs?period=week')->assertJsonCount(1, 'data')->assertJsonPath('data.0.template_id', $a);
        $this->getJson('/api/js-creator/outputs?period=month')->assertJsonCount(2, 'data');
        $this->getJson('/api/js-creator/outputs')->assertJsonCount(1, 'data');
        $this->getJson('/api/js-creator/outputs/templates')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.name', 'A');
    }

    /**
     * @description Preferences: empty by default, saved whole with texts kept, checked strictly,
     *   per account, never in the log.
     * @input GET; PUT colours + two sets; broken values; account B GET
     * @output empty; saved; 422 paths; B empty; log without "#leto"
     */
    public function test_preferences(): void
    {
        $this->signIn($this->creator());
        $this->getJson('/api/js-creator/preferences')->assertOk()->assertExactJson(['data' => ['colors' => [], 'hashtag_sets' => []]]);
        $value = ['colors' => ['#1e1b4b', '#facc15'], 'hashtag_sets' => [['name' => 'Léto', 'tags' => '#leto #akce #sleva']]];
        $this->putJson('/api/js-creator/preferences', $value)->assertOk()->assertJsonPath('data.hashtag_sets.0.tags', '#leto #akce #sleva');
        $this->getJson('/api/js-creator/preferences')->assertJsonPath('data.colors', ['#1e1b4b', '#facc15']);

        $broken = [
            'preferences'           => ['colors' => []],
            'colors.0'              => ['colors' => ['red'], 'hashtag_sets' => []],
            'colors'                => ['colors' => ['#ffffff', '#ffffff'], 'hashtag_sets' => []],
            'hashtag_sets.0'        => ['colors' => [], 'hashtag_sets' => [['name' => 'A']]],
            'hashtag_sets.1.name'   => ['colors' => [], 'hashtag_sets' => [['name' => 'A', 'tags' => '#a'], ['name' => 'a', 'tags' => '#b']]],
            'hashtag_sets.0.tags'   => ['colors' => [], 'hashtag_sets' => [['name' => 'A', 'tags' => str_repeat('x', 501)]]],
        ];
        foreach ($broken as $path => $body) {
            $this->putJson('/api/js-creator/preferences', $body)->assertStatus(422)->assertJsonValidationErrors([$path]);
        }

        $this->signIn($this->creator());
        $this->getJson('/api/js-creator/preferences')->assertJsonPath('data.colors', []);
        $this->assertStringNotContainsString('#leto', JsCreatorLog::query()->get()->toJson());
    }
}
