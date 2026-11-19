<?php

/**
 * @file KnowledgeBaseTest.php
 * @path api/tests/Apps/Web/Feature/KnowledgeBaseTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the public knowledge base: the former Czech texts filled in by the
 *   migration (introduction + 10 blocks with 4 sub-blocks each), the admin API (web/knowledge-base
 *   - permissions web-edit-website-view / -update, everything saved at once: create / update /
 *   delete / reorder, clean-up of the texts, the introduction first and only once, stale ids
 *   refused), the image of a block (upload re-encoded to WebP and scaled down, replace, remove,
 *   deleted with its block, invalid files and the introduction refused), the public API (the
 *   introduction and the shown blocks only, no admin fields) and the texts of a deleted language
 *   removed.
 * @dependencies
 * - Tests\TestCase (RefreshDatabase + InteractsWithAccounts); Storage fake of the public disk.
 */

namespace Tests\Apps\Web\Feature;

use App\Apps\Web\Models\WebKbItem;
use App\Apps\Web\Models\WebKbSection;
use App\Apps\Web\Models\WebLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * @description GET / PUT /api/web/knowledge-base, POST / DELETE /api/web/knowledge-base/{id}/image;
 *   GET /api/public/web/knowledge-base.
 */
class KnowledgeBaseTest extends TestCase
{
    /** @var string Temporary storage directory of the test. */
    private string $storage;

    /**
     * @description Own storage with the web languages cz + en, the public disk faked and the
     *   content the migration creates on a new installation (the tables are dropped and the
     *   migration runs again; during the tests it never reads or changes the translation files).
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->storage = sys_get_temp_dir() . '/kb-test-' . bin2hex(random_bytes(6));
        mkdir($this->storage . '/app/public/translations/web', 0777, true);
        file_put_contents($this->storage . '/app/public/translations/languages.json', json_encode([
            ['code' => 'cz', 'module' => 'web', 'name' => 'Čeština', 'active' => true, 'isBuiltIn' => true],
            ['code' => 'en', 'module' => 'web', 'name' => 'English', 'active' => true],
        ]));
        file_put_contents($this->storage . '/app/public/translations/web/en.json', '{}');
        $this->app->useStoragePath($this->storage);
        Storage::fake('public');

        $migration = require app_path('Apps/Web/Database/Migrations/2026_11_20_000000_create_web_knowledge_base.php');
        $migration->down();
        $migration->up();
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
     * @description A block as the admin sends it.
     * @param array<string, mixed> $overrides Fields to change.
     * @return array<string, mixed>
     */
    private function block(array $overrides = []): array
    {
        return array_merge([
            'is_intro' => false, 'is_active' => true,
            'heading_i18n' => ['cz' => 'Blok'], 'text_i18n' => ['cz' => 'Text'], 'items' => [],
        ], $overrides);
    }

    /**
     * @description The admin rows of the API as they are sent back (the fields of a save).
     * @param array $data Rows of GET / PUT web/knowledge-base.
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
     * @description The migration filled in the former Czech texts: the introduction first, then
     *   the 10 chapters as blocks with their 4 sub-blocks, no glossary, no image.
     * @input Fresh database; GET public/web/knowledge-base.
     * @output 11 rows; intro 'Co všechno váš systém obsahuje' without items; 'Zabezpečení a ochrana
     *   dat' with 4 items, the first 'Zabezpečené přihlašování'; the last block 'Podpora…'; image null.
     */
    public function test_former_texts_are_filled_in(): void
    {
        $data = $this->getJson('/api/public/web/knowledge-base')->assertOk()->json('data');

        $this->assertCount(11, $data);
        $this->assertSame([true, 'Co všechno váš systém obsahuje', []], [$data[0]['intro'], $data[0]['heading']['cz'], $data[0]['items']]);
        $this->assertStringStartsWith('Tato stránka srozumitelně vysvětluje', $data[0]['text']['cz']);
        $this->assertSame([false, 'Zabezpečení a ochrana dat', null], [$data[1]['intro'], $data[1]['heading']['cz'], $data[1]['image']]);
        $this->assertCount(4, $data[1]['items']);
        $this->assertSame('Zabezpečené přihlašování', $data[1]['items'][0]['title']['cz']);
        $this->assertSame(10, WebKbSection::where('is_intro', false)->count());
        $this->assertSame(40, WebKbItem::count());
    }

    /**
     * @description The admin API needs web-edit-website-view to read and -update to save or to
     *   change an image.
     * @input Account without permissions; account with view only.
     * @output 403; view: GET 200, PUT / POST image / DELETE image 403.
     */
    public function test_admin_api_needs_the_edit_website_permissions(): void
    {
        $id = WebKbSection::where('is_intro', false)->value('id');
        $this->signIn($this->user());
        $this->getJson('/api/web/knowledge-base')->assertForbidden();

        $this->signIn($this->userWith(['web-edit-website-view']));
        $this->getJson('/api/web/knowledge-base')->assertOk();
        $this->putJson('/api/web/knowledge-base', ['sections' => []])->assertForbidden();
        $this->post("/api/web/knowledge-base/{$id}/image", ['image' => $this->image(20, 20)], ['Accept' => 'application/json'])->assertForbidden();
        $this->deleteJson("/api/web/knowledge-base/{$id}/image")->assertForbidden();
    }

    /**
     * @description Saving: the introduction is updated, the sent order wins, existing blocks and
     *   sub-blocks are kept by id, new ones created, missing ones deleted; texts are cleaned (tags
     *   removed, empty languages dropped, line breaks of a text kept); a hidden block is not public.
     * @input The introduction with a new heading; a new block (2 sub-blocks) first; the second
     *   former block hidden with its first sub-block kept and one new; the other blocks left out.
     * @output Order [intro, new, kept]; kept ids; cleaned texts; 3 sections, 4 items; public list
     *   intro + new; log entry.
     */
    public function test_saves_the_knowledge_base(): void
    {
        $this->signIn($this->userWith(['web-edit-website-view', 'web-edit-website-update']));
        $current = $this->asPayload($this->getJson('/api/web/knowledge-base')->json('data'));
        $intro = $current[0];
        $kept = $current[2];

        $data = $this->putJson('/api/web/knowledge-base', ['sections' => [
            array_merge($intro, ['heading_i18n' => ['cz' => ' Vše o <b>systému</b> ', 'en' => 'All about it']]),
            $this->block([
                'heading_i18n' => ['cz' => '<script>x</script>E-maily', 'en' => ' '],
                'text_i18n' => ['cz' => "Řádek 1\nŘádek 2"],
                'items' => [
                    ['title_i18n' => ['cz' => 'Počet schránek'], 'text_i18n' => ['cz' => '5 schránek']],
                    ['title_i18n' => ['cz' => 'Velikost'], 'text_i18n' => ['cz' => '10 GB']],
                ],
            ]),
            array_merge($kept, ['is_active' => false, 'items' => [$kept['items'][0], ['title_i18n' => ['cz' => 'Nový'], 'text_i18n' => ['cz' => 'Text']]]]),
        ]])->assertOk()->json('data');

        $this->assertSame($intro['id'], $data[0]['id']);
        $this->assertSame(['cz' => 'Vše o systému', 'en' => 'All about it'], $data[0]['heading_i18n']);
        $this->assertSame(['cz' => 'xE-maily'], $data[1]['heading_i18n']);
        $this->assertSame(['cz' => "Řádek 1\nŘádek 2"], $data[1]['text_i18n']);
        $this->assertSame(['Počet schránek', 'Velikost'], array_column(array_column($data[1]['items'], 'title_i18n'), 'cz'));
        $this->assertSame([$kept['id'], false], [$data[2]['id'], $data[2]['is_active']]);
        $this->assertSame($kept['items'][0]['id'], $data[2]['items'][0]['id']);
        $this->assertSame(3, WebKbSection::count());
        $this->assertSame(4, WebKbItem::count());
        $this->assertSame([$intro['id'], $data[1]['id']], array_column($this->getJson('/api/public/web/knowledge-base')->json('data'), 'id'));
        $this->assertTrue(WebLog::where('description', 'Updated the knowledge base: 2 blocks')->exists());
    }

    /**
     * @description Invalid or stale requests are refused and change nothing: no / second /
     *   not-first introduction, sub-blocks of the introduction, a too long heading, an unknown id,
     *   a sub-block of another block, a block sent as the introduction.
     * @input The requests above.
     * @output 422 each; still 11 sections and 40 items.
     */
    public function test_refuses_invalid_and_stale_data(): void
    {
        $this->signIn($this->userWith(['web-edit-website-view', 'web-edit-website-update']));
        $current = $this->asPayload($this->getJson('/api/web/knowledge-base')->json('data'));
        $put = fn (array $sections) => $this->putJson('/api/web/knowledge-base', ['sections' => $sections]);

        $put([])->assertStatus(422);
        $put([$current[1]])->assertStatus(422);
        $put([$current[1], $current[0]])->assertStatus(422);
        $put([$current[0], $this->block(['is_intro' => true])])->assertStatus(422);
        $put([array_merge($current[0], ['items' => [['title_i18n' => ['cz' => 'x'], 'text_i18n' => []]]])])->assertStatus(422);
        $put([$current[0], array_merge($current[1], ['heading_i18n' => ['cz' => str_repeat('x', 151)]])])
            ->assertStatus(422)->assertJsonValidationErrors('sections.1.heading_i18n.cz');
        $put([$current[0], array_merge($current[1], ['id' => 999])])->assertStatus(422);

        $foreign = $current[2];
        $foreign['items'][] = $current[1]['items'][0];
        $put([$current[0], $current[1], $foreign])->assertStatus(422);
        $put([array_merge($current[1], ['is_intro' => true])])->assertStatus(422);

        $this->assertSame(11, WebKbSection::count());
        $this->assertSame(40, WebKbItem::count());
    }

    /**
     * @description Image of a block: an upload is re-encoded to WebP and scaled down to 1600 px; a
     *   new one replaces (and deletes) the previous file; removal deletes it; a deleted block
     *   deletes its image; a non-image, a video, an oversized file, the introduction and an unknown
     *   block are refused.
     * @input 2400×1200 JPG; 300×200; DELETE; an upload and the block left out of a save; a text
     *   file; an MP4; a 6 MB file; the introduction; block 999.
     * @output 'knowledge-base/{id}-….webp' 1600×800 WebP, public path; old file gone; null, no
     *   file; orphan deleted; 422 ×4; 404.
     */
    public function test_uploads_replaces_and_removes_the_image(): void
    {
        $this->signIn($this->userWith(['web-edit-website-view', 'web-edit-website-update']));
        [$intro, $first, $second] = WebKbSection::orderByDesc('is_intro')->orderBy('sort_order')->take(3)->get()->all();
        $upload = fn (UploadedFile $file, int $id = 0) => $this->post('/api/web/knowledge-base/' . ($id ?: $first->id) . '/image', ['image' => $file], ['Accept' => 'application/json']);

        $path = $upload($this->image(2400, 1200))->assertOk()->json('data.image');
        $this->assertMatchesRegularExpression('/^knowledge-base\/' . $first->id . '-[a-z0-9]{16}\.webp$/', $path);
        $stored = getimagesizefromstring(Storage::disk('public')->get($path));
        $this->assertSame([1600, 800, 'image/webp'], [$stored[0], $stored[1], $stored['mime']]);
        $this->assertSame($path, $this->getJson('/api/public/web/knowledge-base')->json('data.1.image'));

        $replaced = $upload($this->image(300, 200))->assertOk()->json('data.image');
        Storage::disk('public')->assertMissing($path);

        $this->deleteJson("/api/web/knowledge-base/{$first->id}/image")->assertOk()->assertJsonPath('data.image', null);
        Storage::disk('public')->assertMissing($replaced);
        $this->assertNull($first->fresh()->image_path);

        $orphan = $upload($this->image(50, 50), $second->id)->json('data.image');
        $current = $this->asPayload($this->getJson('/api/web/knowledge-base')->json('data'));
        $this->putJson('/api/web/knowledge-base', ['sections' => [$current[0], $current[1]]])->assertOk();
        Storage::disk('public')->assertMissing($orphan);

        $upload(UploadedFile::fake()->create('notes.txt', 1, 'text/plain'))->assertStatus(422);
        $upload(UploadedFile::fake()->create('clip.mp4', 100, 'video/mp4'))->assertStatus(422);
        $upload(UploadedFile::fake()->create('huge.jpg', 6 * 1024, 'image/jpeg'))->assertStatus(422);
        $upload($this->image(10, 10), $intro->id)->assertStatus(422);
        $upload($this->image(10, 10), 999)->assertNotFound();
    }

    /**
     * @description The public API leaves out the admin fields, the hidden blocks and the ids of the
     *   sub-blocks; the introduction is always shown.
     * @input A hidden introduction row, one shown block with an empty text, one hidden block.
     * @output 2 rows (intro + shown); keys id, intro, heading, text, image, items; text {} (object).
     */
    public function test_public_knowledge_base_has_no_admin_fields(): void
    {
        WebKbSection::query()->delete();
        WebKbSection::create(['is_intro' => true, 'heading_i18n' => ['cz' => 'Úvod'], 'is_active' => false, 'sort_order' => 0]);
        $shown = WebKbSection::create(['heading_i18n' => ['cz' => 'Vidět'], 'text_i18n' => [], 'is_active' => true, 'sort_order' => 1]);
        WebKbSection::create(['heading_i18n' => ['cz' => 'Skrytý'], 'is_active' => false, 'sort_order' => 2]);
        WebKbItem::create(['section_id' => $shown->id, 'title_i18n' => ['cz' => 'T'], 'text_i18n' => ['cz' => 'X']]);

        $response = $this->getJson('/api/public/web/knowledge-base')->assertOk();
        $this->assertSame(['Úvod', 'Vidět'], array_column(array_column($response->json('data'), 'heading'), 'cz'));
        $this->assertSame(['id', 'intro', 'heading', 'text', 'image', 'items'], array_keys($response->json('data.1')));
        $this->assertSame([['title' => ['cz' => 'T'], 'text' => ['cz' => 'X']]], $response->json('data.1.items'));
        $this->assertStringContainsString('"text":{}', $response->getContent());
    }

    /**
     * @description Texts are stored in the languages of the web module only; deleting a web
     *   language deletes its texts of the knowledge base.
     * @input Save with cz / en / fr texts; DELETE languages/web/en.
     * @output Saved {cz, en}; after the deletion only cz in the block and its sub-block.
     */
    public function test_languages_of_the_texts(): void
    {
        $this->signIn($this->userWith(['web-edit-website-view', 'web-edit-website-update']));
        $current = $this->asPayload($this->getJson('/api/web/knowledge-base')->json('data'));

        $data = $this->putJson('/api/web/knowledge-base', ['sections' => [$current[0], $this->block([
            'heading_i18n' => ['cz' => 'A', 'en' => 'B', 'fr' => 'C'],
            'items' => [['title_i18n' => ['cz' => 'T', 'en' => 'T EN'], 'text_i18n' => ['en' => 'X EN']]],
        ])]])->assertOk()->json('data');
        $this->assertSame(['cz' => 'A', 'en' => 'B'], $data[1]['heading_i18n']);

        $this->deleteJson('/api/languages/web/en')->assertNoContent();

        $block = WebKbSection::with('items')->where('is_intro', false)->first();
        $this->assertSame(['cz' => 'A'], $block->heading_i18n);
        $this->assertSame(['cz' => 'T'], $block->items[0]->title_i18n);
        $this->assertSame([], $block->items[0]->text_i18n);
    }
}
