<?php

/**
 * @file ReferencesTest.php
 * @path api/tests/Apps/Web/Feature/ReferencesTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the references of the public website: the former Czech projects
 *   filled in by the migrations (the category code becomes its label as text), the admin API (web/references - permissions web-edit-website-view
 *   / -update, all references saved at once: create / update / delete / reorder, clean-up of the
 *   texts, stale ids refused), the image (upload re-encoded to WebP and scaled down, replace,
 *   remove, deleted with its reference, invalid files refused), the public API (shown references
 *   only, no admin fields) and the texts of a deleted language removed.
 * @dependencies
 * - Tests\TestCase (RefreshDatabase + InteractsWithAccounts); Storage fake of the public disk.
 */

namespace Tests\Apps\Web\Feature;

use App\Apps\Web\Models\WebLog;
use App\Apps\Web\Models\WebReference;
use App\Apps\Web\Models\WebReferenceFeature;
use App\Apps\Web\Models\WebReferenceStack;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * @description GET / PUT /api/web/references, POST / DELETE /api/web/references/{id}/image;
 *   GET /api/public/web/references.
 */
class ReferencesTest extends TestCase
{
    /** @var string Temporary storage directory of the test. */
    private string $storage;

    /**
     * @description Own storage with the web languages cz + en, the public disk faked and the
     *   content the migration creates on a new installation (the test schema has the tables
     *   already, so they are dropped and the migration runs again; during the tests it never
     *   reads or changes the translation files).
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->storage = sys_get_temp_dir() . '/references-test-' . bin2hex(random_bytes(6));
        mkdir($this->storage . '/app/public/translations/web', 0777, true);
        file_put_contents($this->storage . '/app/public/translations/languages.json', json_encode([
            ['code' => 'cz', 'module' => 'web', 'name' => 'Čeština', 'active' => true, 'isBuiltIn' => true],
            ['code' => 'en', 'module' => 'web', 'name' => 'English', 'active' => true],
        ]));
        file_put_contents($this->storage . '/app/public/translations/web/en.json', '{}');
        $this->app->useStoragePath($this->storage);
        Storage::fake('public');

        $create = require app_path('Apps/Web/Database/Migrations/2026_11_12_000000_create_web_references.php');
        $category = require app_path('Apps/Web/Database/Migrations/2026_11_13_000000_web_references_category_text.php');
        $create->down();
        $create->up();
        $category->up();
    }

    /**
     * @description Removes the temporary storage.
     * @return void
     */
    protected function tearDown(): void
    {
        File::deleteDirectory($this->storage);
        parent::tearDown();
    }

    /**
     * @description A reference as the admin sends it.
     * @param array<string, mixed> $overrides Fields to change.
     * @return array<string, mixed>
     */
    private function reference(array $overrides = []): array
    {
        return array_merge([
            'category_i18n' => ['cz' => 'Web'], 'duration' => '2026', 'client' => 'Klient', 'is_active' => true,
            'name_i18n' => ['cz' => 'Projekt'], 'size_i18n' => [], 'role_i18n' => [],
            'description_i18n' => ['cz' => 'Popis'], 'result_i18n' => [], 'features' => [], 'stack' => [],
        ], $overrides);
    }

    /**
     * @description The admin rows of the API as they are sent back (the fields of a save).
     * @param array $data Rows of GET / PUT web/references.
     * @return array
     */
    private function asPayload(array $data): array
    {
        return array_map(fn (array $row) => array_diff_key($row, ['image' => 1]), $data);
    }

    /**
     * @description A JPG of the given size.
     * @param int $width
     * @param int $height
     * @return UploadedFile
     */
    private function image(int $width, int $height): UploadedFile
    {
        return UploadedFile::fake()->image('photo.jpg', $width, $height);
    }

    /**
     * @description The migration filled in both former Czech projects with their features and
     *   stack; the public API returns them in the order of the website.
     * @input Fresh database; GET public/web/references.
     * @output 2 projects (E-shop …, Školní …), year / client, category 'Webový vývoj' (text of the
     *   former code 'web'), 8 + 7 features, 5 stack rows, the description as plain text, no image.
     */
    public function test_former_projects_are_filled_in(): void
    {
        $data = $this->getJson('/api/public/web/references')->assertOk()->json('data');

        $this->assertSame(['E-shop se zdravými produkty', 'Školní webové stránky'], array_column(array_column($data, 'name'), 'cz'));
        $this->assertSame(['2025', 'First Prague Company, s. r. o.', ['cz' => 'Webový vývoj'], null], [$data[0]['duration'], $data[0]['client'], $data[0]['category'], $data[0]['image']]);
        $this->assertCount(8, $data[0]['features']);
        $this->assertCount(7, $data[1]['features']);
        $this->assertSame('Katalog produktů s filtrováním a vyhledáváním', $data[0]['features'][0]['cz']);
        $this->assertSame(['label' => ['cz' => 'Databáze'], 'value' => ['cz' => 'MariaDB']], $data[0]['stack'][2]);
        $this->assertStringStartsWith('Navrhli jsme a vyvinuli', $data[0]['description']['cz']);
        $this->assertSame('E-shop na míru včetně administrace', $data[0]['size']['cz']);
    }

    /**
     * @description The admin API needs web-edit-website-view to read and -update to save or to
     *   change an image.
     * @input Account without permissions; account with view only.
     * @output 403; view: GET 200, PUT / POST image / DELETE image 403.
     */
    public function test_admin_api_needs_the_edit_website_permissions(): void
    {
        $id = WebReference::value('id');
        $this->signIn($this->user());
        $this->getJson('/api/web/references')->assertForbidden();

        $this->signIn($this->userWith(['web-edit-website-view']));
        $this->getJson('/api/web/references')->assertOk();
        $this->putJson('/api/web/references', ['references' => []])->assertForbidden();
        $this->post("/api/web/references/{$id}/image", ['image' => $this->image(20, 20)], ['Accept' => 'application/json'])->assertForbidden();
        $this->deleteJson("/api/web/references/{$id}/image")->assertForbidden();
    }

    /**
     * @description Saving: the sent order wins, existing rows are updated, new ones created,
     *   missing ones deleted; texts are cleaned (tags removed, empty languages dropped, line breaks
     *   of the description kept); year / client plain; hidden references not public.
     * @input A new reference first; the second former one hidden with its first feature kept, a
     *   new feature and its stack replaced by one new row; the first former one left out.
     * @output Order [new, kept]; kept ids; 1 + 1 features, 1 stack row; cleaned texts; public list
     *   with the new one only; log entry.
     */
    public function test_saves_the_references(): void
    {
        $this->signIn($this->userWith(['web-edit-website-update']));
        [, $kept] = WebReference::orderBy('sort_order')->get()->all();
        $keptFeature = $kept->features()->first();

        $data = $this->putJson('/api/web/references', ['references' => [
            $this->reference([
                'category_i18n' => ['cz' => ' Audit <i>bezpečnosti</i> ', 'en' => 'Security audit'], 'duration' => ' <b>2026</b> ', 'client' => "Firma\n a. s.",
                'name_i18n' => ['cz' => '<script>x</script>Nový', 'en' => ' '],
                'description_i18n' => ['cz' => "Řádek 1\nŘádek 2"],
                'features' => [['text_i18n' => ['cz' => 'Funkce', 'en' => 'Feature']]],
            ]),
            $this->reference([
                'id' => $kept->id, 'is_active' => false, 'name_i18n' => ['cz' => 'Škola'],
                'features' => [['id' => $keptFeature->id, 'text_i18n' => ['cz' => 'Rozvrhy']], ['text_i18n' => ['cz' => 'Nová']]],
                'stack' => [['label_i18n' => ['cz' => 'Frontend'], 'value_i18n' => ['cz' => 'Angular']]],
            ]),
        ]])->assertOk()->json('data');

        $this->assertNotSame($kept->id, $data[0]['id']);
        $this->assertSame($kept->id, $data[1]['id']);
        $this->assertSame([['cz' => 'Audit bezpečnosti', 'en' => 'Security audit'], '2026', 'Firma a. s.'], [$data[0]['category_i18n'], $data[0]['duration'], $data[0]['client']]);
        $this->assertSame(['cz' => 'xNový'], $data[0]['name_i18n']);
        $this->assertSame(['cz' => "Řádek 1\nŘádek 2"], $data[0]['description_i18n']);
        $this->assertSame($keptFeature->id, $data[1]['features'][0]['id']);
        $this->assertSame(['cz' => 'Rozvrhy'], $data[1]['features'][0]['text_i18n']);
        $this->assertSame(2, WebReference::count());
        $this->assertSame(3, WebReferenceFeature::count());
        $this->assertSame(1, WebReferenceStack::count());
        $this->assertSame([$data[0]['id']], array_column($this->getJson('/api/public/web/references')->json('data'), 'id'));
        $this->assertTrue(WebLog::where('description', 'Updated the references: 2 projects')->exists());
    }

    /**
     * @description Invalid or stale requests are refused and change nothing.
     * @input A category longer than 80 characters; unknown reference id; a feature of another reference; a stack row
     *   sent twice.
     * @output 422 each; still the 2 former references.
     */
    public function test_refuses_invalid_and_stale_data(): void
    {
        $this->signIn($this->userWith(['web-edit-website-view', 'web-edit-website-update']));
        $current = $this->asPayload($this->getJson('/api/web/references')->json('data'));

        $this->putJson('/api/web/references', ['references' => [array_merge($current[0], ['category_i18n' => ['cz' => str_repeat('x', 81)]])]])
            ->assertStatus(422)->assertJsonValidationErrors('references.0.category_i18n.cz');
        $this->putJson('/api/web/references', ['references' => [array_merge($current[0], ['id' => 999])]])->assertStatus(422);

        $foreign = $current[1];
        $foreign['features'][] = $current[0]['features'][0];
        $this->putJson('/api/web/references', ['references' => [$current[0], $foreign]])->assertStatus(422);

        $twice = $current[0];
        $twice['stack'][] = $twice['stack'][0];
        $this->putJson('/api/web/references', ['references' => [$twice, $current[1]]])->assertStatus(422);

        $this->assertSame(2, WebReference::count());
        $this->assertSame(15, WebReferenceFeature::count());
    }

    /**
     * @description Image: an upload is re-encoded to WebP and scaled down to 1600 px; a new one
     *   replaces (and deletes) the previous file; removal deletes it; a deleted reference deletes
     *   its image; a non-image, an oversized file and an unknown reference are refused.
     * @input 2400×1200 JPG; then 300×200; DELETE; a new upload and the reference left out of a
     *   save; a text file; a 6 MB file; reference 999.
     * @output image 'references/{id}-….webp' 1600×800, public path; replaced: old file gone,
     *   300×200; removed: null, no file; deleted with the reference; 422, 422, 404.
     */
    public function test_uploads_replaces_and_removes_the_image(): void
    {
        $this->signIn($this->userWith(['web-edit-website-view', 'web-edit-website-update']));
        [$first, $second] = WebReference::orderBy('sort_order')->get()->all();
        $upload = fn (UploadedFile $file, int $id = 0) => $this->post('/api/web/references/' . ($id ?: $first->id) . '/image', ['image' => $file], ['Accept' => 'application/json']);

        $path = $upload($this->image(2400, 1200))->assertOk()->json('data.image');
        $this->assertMatchesRegularExpression('/^references\/' . $first->id . '-[a-z0-9]{16}\.webp$/', $path);
        Storage::disk('public')->assertExists($path);
        $this->assertSame([1600, 800], array_slice(getimagesizefromstring(Storage::disk('public')->get($path)), 0, 2));
        $this->assertSame('image/webp', getimagesizefromstring(Storage::disk('public')->get($path))['mime']);
        $this->assertSame($path, $this->getJson('/api/public/web/references')->json('data.0.image'));

        $replaced = $upload($this->image(300, 200))->assertOk()->json('data.image');
        Storage::disk('public')->assertMissing($path);
        $this->assertSame([300, 200], array_slice(getimagesizefromstring(Storage::disk('public')->get($replaced)), 0, 2));

        $this->deleteJson("/api/web/references/{$first->id}/image")->assertOk()->assertJsonPath('data.image', null);
        Storage::disk('public')->assertMissing($replaced);
        $this->assertNull($first->fresh()->image_path);

        $orphan = $upload($this->image(50, 50), $second->id)->json('data.image');
        $current = $this->asPayload($this->getJson('/api/web/references')->json('data'));
        $this->putJson('/api/web/references', ['references' => [$current[0]]])->assertOk();
        Storage::disk('public')->assertMissing($orphan);

        $upload(UploadedFile::fake()->create('notes.txt', 1, 'text/plain'))->assertStatus(422);
        $upload(UploadedFile::fake()->create('huge.jpg', 6 * 1024, 'image/jpeg'))->assertStatus(422);
        $upload($this->image(10, 10), 999)->assertNotFound();
    }

    /**
     * @description The public API leaves out the admin fields and empty languages.
     * @input One shown reference with a cz name only and one hidden one.
     * @output One row without is_active / ids of features; size {} (JSON object).
     */
    public function test_public_references_have_no_admin_fields(): void
    {
        WebReference::query()->delete();
        WebReference::create(['category_i18n' => ['cz' => 'Mobilní vývoj'], 'name_i18n' => ['cz' => 'Appka'], 'size_i18n' => [], 'is_active' => true]);
        WebReference::create(['category_i18n' => ['cz' => 'Web'], 'name_i18n' => ['cz' => 'Skrytý'], 'is_active' => false]);

        $response = $this->getJson('/api/public/web/references')->assertOk();
        $row = $response->json('data.0');
        $this->assertCount(1, $response->json('data'));
        $this->assertSame(['id', 'category', 'duration', 'client', 'image', 'name', 'size', 'role', 'description', 'result', 'features', 'stack'], array_keys($row));
        $this->assertStringContainsString('"size":{}', $response->getContent());
    }

    /**
     * @description Texts are stored in the languages of the web module only; deleting a web
     *   language deletes its texts of the references (nothing of a deleted language stays).
     * @input Save with cz / en / fr texts; DELETE languages/web/en.
     * @output Saved {cz, en} (fr dropped); after the deletion only cz in the reference (name,
     *   category), its feature and its stack row.
     */
    public function test_languages_of_the_texts(): void
    {
        $this->signIn($this->userWith(['web-edit-website-view', 'web-edit-website-update']));

        $data = $this->putJson('/api/web/references', ['references' => [$this->reference([
            'category_i18n' => ['cz' => 'Audit', 'en' => 'Audit EN'],
            'name_i18n' => ['cz' => 'A', 'en' => 'B', 'fr' => 'C'],
            'features' => [['text_i18n' => ['cz' => 'F', 'en' => 'F EN']]],
            'stack' => [['label_i18n' => ['cz' => 'L', 'en' => 'L EN'], 'value_i18n' => ['en' => 'V EN']]],
        ])]])->assertOk()->json('data');
        $this->assertSame(['cz' => 'A', 'en' => 'B'], $data[0]['name_i18n']);

        $this->deleteJson('/api/languages/web/en')->assertNoContent();

        $reference = WebReference::with(['features', 'stack'])->first();
        $this->assertSame(['cz' => 'A'], $reference->name_i18n);
        $this->assertSame(['cz' => 'Audit'], $reference->category_i18n);
        $this->assertSame(['cz' => 'F'], $reference->features[0]->text_i18n);
        $this->assertSame(['cz' => 'L'], $reference->stack[0]->label_i18n);
        $this->assertSame([], $reference->stack[0]->value_i18n);
    }

    /**
     * @description The category migration turns a former code into its label in every language
     *   that has one and a code without label into its text; down() maps the Czech labels back.
     * @input References with the codes 'mobile' and 'x' before the migration; then down().
     * @output category_i18n {cz: 'Mobilní vývoj'} and {cz: 'x'}; after down() codes 'mobile', 'web'.
     */
    public function test_category_migration_turns_codes_into_text(): void
    {
        $migration = require app_path('Apps/Web/Database/Migrations/2026_11_13_000000_web_references_category_text.php');
        $migration->down();
        WebReference::query()->delete();
        $mobile = DB::table('web_references')->insertGetId(['category' => 'mobile', 'name_i18n' => '{}']);
        $other = DB::table('web_references')->insertGetId(['category' => 'x', 'name_i18n' => '{}']);

        $migration->up();
        $this->assertSame(['cz' => 'Mobilní vývoj'], WebReference::find($mobile)->category_i18n);
        $this->assertSame(['cz' => 'x'], WebReference::find($other)->category_i18n);

        $migration->down();
        $this->assertSame(['mobile', 'web'], DB::table('web_references')->orderBy('id')->pluck('category')->all());
        $migration->up();
    }
}
