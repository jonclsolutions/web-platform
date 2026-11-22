<?php

/**
 * @file TransferTest.php
 * @path api/tests/Apps/JsCreator/Feature/TransferTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the export and import of templates, blocks and sets
 *   (TransferController, TransferExport, TransferImport, TransferPackage): a set exported by one
 *   account and imported by another with everything it needs, names taken by own items
 *   (` (2)`, ` (3)`), reused and renamed fonts, refused files (nothing stored), the selection of
 *   an export, the quota, the permissions and the audit log.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorSet;
use App\Apps\JsCreator\Models\CreatorSetting;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\CreatorUsage;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Support\TransferPackage;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/images/export and /api/js-creator/images/import.
 */
class TransferTest extends TestCase
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
     * @description A set exported by one account is imported by another with its templates, the
     *   block, the image, the own icon and the font they use; the ids in the documents point to the
     *   new items, usages are synced, thumbnails are to be drawn; the package holds nothing about
     *   the exporting account; both actions are in the audit log.
     * @input account A: image, icon, font, block with the icon, template 1 (image + font + block),
     *   template 2 (trashed, in the set too), set of both; export of the set; import as account B.
     * @output package with 1 template (the trashed one left out), 1 block, 2 assets, 1 font, the
     *   set with one template; B owns new rows with remapped ids, thumb_stale, the set in order,
     *   files on the disk; log events export / import of module Transfer.
     */
    public function test_set_exported_by_one_account_is_imported_by_another(): void
    {
        $owner = $this->signIn($this->creator());
        $fixture = $this->fixture();
        $package = $this->postJson(self::BASE . '/export', ['set_ids' => [$fixture['set']]])->assertOk()->json('data');

        $this->assertSame('js-creator', $package['format']);
        $this->assertSame(1, $package['version']);
        $this->assertSame([$fixture['template']], array_column($package['templates'], 'id'));
        $this->assertSame([$fixture['block']], array_column($package['blocks'], 'id'));
        $this->assertEqualsCanonicalizing([$fixture['image'], $fixture['icon']], array_column($package['assets'], 'id'));
        $this->assertSame([[$fixture['template']]], array_column($package['sets'], 'template_ids'));
        $this->assertSame('Brand', $package['fonts'][0]['family']);
        $json = json_encode($package);
        $this->assertStringNotContainsString('email', $json);
        $this->assertStringNotContainsString('user_id', $json);

        $other = $this->signIn($this->creator());
        $summary = $this->importPackage($package)->assertCreated()
            ->assertJsonPath('data.templates', 1)->assertJsonPath('data.blocks', 1)->assertJsonPath('data.sets', 1)
            ->assertJsonPath('data.assets', 2)->assertJsonPath('data.fonts', 1)->assertJsonPath('data.renamed', [])->json('data');

        $template = CreatorTemplate::query()->where('user_id', $other->id)->sole();
        $block = CreatorBlock::query()->where('user_id', $other->id)->sole();
        $image = CreatorAsset::query()->where('user_id', $other->id)->where('kind', 'image')->sole();
        $icon = CreatorAsset::query()->where('user_id', $other->id)->where('kind', 'icon')->sole();
        $font = CreatorFont::query()->where('user_id', $other->id)->sole();
        $this->assertSame([$template->id], $summary['template_ids']);
        $this->assertSame('Post', $template->name);
        $this->assertTrue($template->thumb_stale);
        $this->assertNull($template->thumb_path);
        $this->assertTrue($block->thumb_stale);
        $layers = $template->document['pages'][0]['layers'];
        $this->assertSame($image->id, $layers[0]['source']['assetId']);
        $this->assertSame("user:{$font->id}", $layers[1]['font']['family']);
        $this->assertSame($block->id, $layers[2]['blockId']);
        $this->assertSame($icon->id, $block->document['pages'][0]['layers'][0]['source']['assetId']);
        $this->assertSame([[$template->id]], CreatorSet::query()->where('user_id', $other->id)->get()->map(fn ($s) => $s->templates->pluck('id')->all())->all());
        $this->assertEqualsCanonicalizing(
            [['template', 'asset', $image->id], ['template', 'font', $font->id], ['template', 'block', $block->id], ['block', 'asset', $icon->id]],
            CreatorUsage::query()->where('user_id', $other->id)->get()->map(fn ($u) => [$u->owner_type, $u->target_type, $u->target_id])->all(),
        );
        foreach ([$image->path, $image->thumb_path, $icon->path, $font->path] as $path) {
            $this->assertStringStartsWith("js-creator/{$other->id}/", $path);
            Storage::disk('private')->assertExists($path);
        }
        $this->assertSame(1, JsCreatorLog::query()->where('module', 'Transfer')->where('event_type', 'export')->where('user_id', $owner->id)->count());
        $this->assertSame(1, JsCreatorLog::query()->where('module', 'Transfer')->where('event_type', 'import')->where('user_id', $other->id)->count());
        $this->assertStringNotContainsString('Post', (string) JsCreatorLog::query()->where('event_type', 'import')->value('description'));
    }

    /**
     * @description Taken names get ` (2)`, ` (3)` (also against the trash and within the import,
     *   a name already ending with ` (n)` counts on); the same font is reused, another font of a
     *   taken face gets a free family name.
     * @input export of template + block + set; imported twice by the owner; a package with two
     *   templates "Post" and "Post (2)"; a font of the same face with another content.
     * @output Post (2), Post (3); block and set renamed alike; fonts_reused 1; then Post (4), Post (5);
     *   family "Brand 2".
     */
    public function test_names_get_a_number_and_fonts_are_reused(): void
    {
        $this->signIn($this->creator());
        $fixture = $this->fixture();
        $package = $this->postJson(self::BASE . '/export', ['set_ids' => [$fixture['set']]])->assertOk()->json('data');

        $this->importPackage($package)->assertCreated()->assertJsonPath('data.fonts', 0)->assertJsonPath('data.fonts_reused', 1)
            ->assertJsonFragment(['type' => 'template', 'from' => 'Post', 'to' => 'Post (2)'])
            ->assertJsonFragment(['type' => 'block', 'from' => 'Badge', 'to' => 'Badge (2)'])
            ->assertJsonFragment(['type' => 'set', 'from' => 'Launch', 'to' => 'Launch (2)'])
            ->assertJsonFragment(['type' => 'asset', 'from' => 'logo', 'to' => 'logo (2)']);
        CreatorTemplate::query()->where('name', 'Post (2)')->sole()->delete();
        $this->importPackage($package)->assertCreated()->assertJsonFragment(['to' => 'Post (3)']);
        $this->assertSame(1, CreatorFont::query()->count());

        $twice = $package;
        $second = $package['templates'][0];
        $second['id'] = 999;
        $second['name'] = 'Post (2)';
        $twice['templates'][] = $second;
        $twice['sets'] = [];
        $this->importPackage($twice)->assertCreated()
            ->assertJsonFragment(['from' => 'Post', 'to' => 'Post (4)'])->assertJsonFragment(['from' => 'Post (2)', 'to' => 'Post (5)']);

        $other = $package;
        $other['fonts'][0]['data'] = base64_encode('wOF2' . str_repeat("\x01", 100));
        $this->importPackage($other)->assertCreated()->assertJsonPath('data.fonts', 1)
            ->assertJsonFragment(['type' => 'font', 'from' => 'Brand', 'to' => 'Brand 2']);
        $this->assertSame(['Brand', 'Brand 2'], CreatorFont::query()->orderBy('id')->pluck('family')->all());
        $template = CreatorTemplate::query()->latest('id')->first();
        $this->assertSame('user:' . CreatorFont::query()->where('family', 'Brand 2')->value('id'), $template->document['pages'][0]['layers'][1]['font']['family']);
    }

    /**
     * @description A file that is not a valid package is refused and nothing is stored.
     * @input not JSON; a .txt file; another format; another section; an unknown key; an empty
     *   package; an image reference outside the package; a broken document; an image that is not
     *   an image; a WebP as an icon; a font of another format; a set of a missing template.
     * @output 422 (`file` validation or `invalid_package` with the path); no row, no file.
     */
    public function test_invalid_packages_are_refused(): void
    {
        $this->signIn($this->creator());
        $fixture = $this->fixture();
        $package = $this->postJson(self::BASE . '/export', ['set_ids' => [$fixture['set']]])->assertOk()->json('data');
        CreatorTemplate::query()->forceDelete();
        CreatorSet::query()->forceDelete();
        $before = $this->counts();
        $files = Storage::disk('private')->allFiles();

        $this->post(self::BASE . '/import', ['file' => UploadedFile::fake()->createWithContent('pack.json', '{"format": ')], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('error_code', 'invalid_package')->assertJsonPath('errors.package.0', 'The file is not valid JSON.');
        $this->post(self::BASE . '/import', ['file' => UploadedFile::fake()->createWithContent('pack.txt', json_encode($package))], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('file');

        $cases = [
            'format'                                     => fn (array $p) => ['format' => 'other'] + $p,
            'section'                                    => fn (array $p) => ['section' => 'videos'] + $p,
            'package.extra'                              => fn (array $p) => $p + ['extra' => true],
            'package'                                    => fn (array $p) => ['templates' => [], 'blocks' => [], 'sets' => []] + $p,
            'templates.0.document.pages.0.layers.0.source.assetId' => fn (array $p) => ['assets' => array_values(array_filter($p['assets'], fn ($a) => $a['kind'] === 'icon'))] + $p,
            'templates.0.document.pages.0.layers.1.size' => function (array $p) {
                $p['templates'][0]['document']['pages'][0]['layers'][1]['size'] = -5;

                return $p;
            },
            'assets.0.data'                              => function (array $p) {
                $p['assets'][0]['data'] = base64_encode('not an image');

                return $p;
            },
            'assets.1.mime'                              => function (array $p) {
                $p['assets'][1]['mime'] = 'image/webp';

                return $p;
            },
            'fonts.0.data'                               => function (array $p) {
                $p['fonts'][0]['data'] = base64_encode('OTTO' . str_repeat("\x00", 10));

                return $p;
            },
            'sets.0.template_ids.0'                      => function (array $p) {
                $p['sets'][0]['template_ids'] = [12345];

                return $p;
            },
        ];
        $package['assets'] = array_values(collect($package['assets'])->sortBy(fn ($a) => $a['kind'] === 'icon' ? 1 : 0)->all());
        foreach ($cases as $path => $change) {
            $response = $this->importPackage($change($package))->assertStatus(422)->assertJsonPath('error_code', 'invalid_package');
            $this->assertArrayHasKey($path, $response->json('errors'), $path . ' → ' . json_encode($response->json('errors')));
        }
        $this->assertSame($before, $this->counts());
        $this->assertSame($files, Storage::disk('private')->allFiles());
    }

    /**
     * @description An export needs a selection of own items; trashed templates of a set stay out;
     *   templates alone take their blocks along.
     * @input empty selection; a template of another account; a trashed template id; one template.
     * @output 422 validation; 422 invalid_package; 422 invalid_package; package with the template
     *   and its block, no sets.
     */
    public function test_selection_of_an_export(): void
    {
        $this->signIn($this->creator());
        $foreign = $this->fixture();
        $this->signIn($this->creator());
        $fixture = $this->fixture();

        $this->postJson(self::BASE . '/export', [])->assertStatus(422)->assertJsonValidationErrors('template_ids');
        $this->postJson(self::BASE . '/export', ['template_ids' => [$foreign['template']]])->assertStatus(422)->assertJsonPath('error_code', 'invalid_package');
        $this->postJson(self::BASE . '/export', ['template_ids' => [$fixture['trashed']]])->assertStatus(422);
        $package = $this->postJson(self::BASE . '/export', ['template_ids' => [$fixture['template']]])->assertOk()->json('data');
        $this->assertSame([$fixture['block']], array_column($package['blocks'], 'id'));
        $this->assertSame([], $package['sets']);
        $blocks = $this->postJson(self::BASE . '/export', ['block_ids' => [$fixture['block']]])->assertOk()->json('data');
        $this->assertSame([], $blocks['templates']);
        $this->assertSame(['icon'], array_column($blocks['assets'], 'kind'));
        $this->assertSame([], $blocks['fonts']);
    }

    /**
     * @description An import that does not fit into the quota stores nothing.
     * @input quota 1 MB, used bytes forced to 1 MB; import of a package with images.
     * @output 422 quota_exceeded; no new row or file.
     */
    public function test_import_respects_the_quota(): void
    {
        $this->signIn($this->creator());
        $fixture = $this->fixture();
        $package = $this->postJson(self::BASE . '/export', ['set_ids' => [$fixture['set']]])->assertOk()->json('data');
        CreatorSetting::query()->create(['default_quota_mb' => 1]);
        CreatorAsset::query()->whereKey($fixture['image'])->update(['size_bytes' => 1024 * 1024]);
        $before = $this->counts();
        $files = Storage::disk('private')->allFiles();

        $this->importPackage($package)->assertStatus(422)->assertJsonPath('error_code', 'quota_exceeded');
        $this->assertSame($before, $this->counts());
        $this->assertSame($files, Storage::disk('private')->allFiles());
    }

    /**
     * @description Export needs `view`, import needs `create` of the section.
     * @input account with view only; account without any action.
     * @output view-only: export of an own block 200, of a foreign set 422, import 403; no actions: export 403.
     */
    public function test_permissions(): void
    {
        $this->signIn($this->creator());
        $fixture = $this->fixture();
        $package = $this->postJson(self::BASE . '/export', ['set_ids' => [$fixture['set']]])->assertOk()->json('data');

        $viewer = $this->signIn($this->creator(['view']));
        $block = CreatorBlock::query()->create([
            'user_id' => $viewer->id, 'section' => 'images', 'name' => 'Mine', 'width' => 400, 'height' => 200, 'schema_version' => 1,
            'document' => $this->document(), 'thumb_bytes' => 0, 'version' => 1,
        ]);
        $this->postJson(self::BASE . '/export', ['block_ids' => [$block->id]])->assertOk()->assertJsonPath('data.blocks.0.name', 'Mine');
        $this->postJson(self::BASE . '/export', ['set_ids' => [$fixture['set']]])->assertStatus(422);
        $this->importPackage($package)->assertForbidden();

        $this->signIn($this->creator([]));
        $this->postJson(self::BASE . '/export', ['set_ids' => [$fixture['set']]])->assertForbidden();
    }

    /**
     * @description Builds the workspace of the signed-in account: an image, an own icon, a font,
     *   a block with the icon, a template using the image, the font and the block, a trashed
     *   template and a set of both templates.
     * @return array{image: int, icon: int, font: int, block: int, template: int, trashed: int, set: int}
     */
    private function fixture(): array
    {
        $image = (int) $this->post('/api/js-creator/library/assets', ['files' => [$this->png(30, 20, 'logo.png')]], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.0.id');
        $icon = (int) $this->post('/api/js-creator/library/assets', ['kind' => 'icon', 'files' => [$this->png(64, 64, 'arrow.png')]], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.0.id');
        $font = (int) $this->post('/api/js-creator/library/fonts', ['file' => $this->font(), 'family' => 'Brand', 'weight' => 400, 'style' => 'normal'], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.id');

        $block = (int) $this->postJson(self::BASE . '/blocks', ['name' => 'Badge', 'width' => 400, 'height' => 200])->assertCreated()->json('data.id');
        $this->putJson(self::BASE . "/blocks/{$block}", [
            'name' => 'Badge', 'width' => 400, 'height' => 200, 'version' => 1,
            'document' => $this->document([$this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $icon]])]),
        ])->assertOk();

        $template = $this->template('Post', [
            $this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $image]]),
            $this->layer('text', ['font' => ['family' => "user:{$font}", 'weight' => 400, 'style' => 'normal']]),
            $this->layer('block', ['blockId' => $block]),
        ]);
        $trashed = $this->template('Old', []);
        $set = (int) $this->postJson(self::BASE . '/sets', ['name' => 'Launch', 'caption_template' => "Line 1\nLine 2", 'template_ids' => [$template, $trashed]])
            ->assertCreated()->json('data.id');
        $this->deleteJson(self::BASE . "/templates/{$trashed}")->assertNoContent();

        return compact('image', 'icon', 'font', 'block', 'template', 'trashed', 'set');
    }

    /**
     * @description Creates and saves a template of the signed-in account.
     * @param string $name
     * @param array<int, array<string, mixed>> $layers
     * @return int Its id.
     */
    private function template(string $name, array $layers): int
    {
        $id = (int) $this->postJson(self::BASE . '/templates', ['name' => $name, 'width' => 1080, 'height' => 1350])->assertCreated()->json('data.id');
        $this->putJson(self::BASE . "/templates/{$id}", [
            'name' => $name, 'width' => 1080, 'height' => 1350, 'output_format' => 'jpg', 'output_quality' => 80,
            'caption_template' => 'Hi {{title}}', 'version' => 1, 'document' => $this->document($layers),
        ])->assertOk();

        return $id;
    }

    /**
     * @description Uploads a package as a JSON file.
     * @param array<string, mixed> $package
     * @return TestResponse
     */
    private function importPackage(array $package): TestResponse
    {
        $file = UploadedFile::fake()->createWithContent('js-creator-export.json', (string) json_encode($package, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return $this->post(self::BASE . '/import', ['file' => $file], ['Accept' => 'application/json']);
    }

    /**
     * @description Rows of every kind of item.
     * @return array<string, int>
     */
    private function counts(): array
    {
        return [
            'templates' => CreatorTemplate::withTrashed()->count(), 'blocks' => CreatorBlock::withTrashed()->count(),
            'sets' => CreatorSet::withTrashed()->count(), 'assets' => CreatorAsset::withTrashed()->count(),
            'fonts' => CreatorFont::query()->count(), 'usages' => CreatorUsage::query()->count(),
        ];
    }
}
