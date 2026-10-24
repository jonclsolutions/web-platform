<?php

/**
 * @file TranslationTest.php
 * @path api/tests/Feature/Other/TranslationTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the translations (TranslationController): public language
 *   list and translation files, saving translations with a change summary, the language list
 *   per module with icons, deleting languages, and the path checks of module / language codes.
 * @dependencies
 * - Tests\TestCase; a temporary storage folder (useStoragePath) + Storage fake (public disk).
 */

namespace Tests\Feature\Other;

use App\Models\Web\WebLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

/**
 * @description /api/languages/*, /api/translations/*, /api/save_translations/*.
 */
class TranslationTest extends TestCase
{
    /** @var string Temporary storage folder of the test (translations are real files). */
    private string $storage;

    /** @var string[] Permission of the translation editors. */
    /** @var string[] Editor of both modules (each write checks the module's own permission, finding #32). */
    private const EDITOR = ['web-edit-website-update', 'shop-edit-eshop-update'];

    /**
     * @description Points storage_path() to an empty temporary folder and fakes the public disk.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->storage = sys_get_temp_dir() . '/rpsw-translations-' . uniqid();
        File::makeDirectory($this->storage . '/app/public', 0755, true);
        $this->app->useStoragePath($this->storage);
        Storage::fake('public');
    }

    /**
     * @description Removes the temporary storage folder.
     * @return void
     */
    protected function tearDown(): void
    {
        File::deleteDirectory($this->storage);
        parent::tearDown();
    }

    /**
     * @description Path of a file below the temporary translations folder.
     * @param string $relative Relative path, e.g. 'web/cz.json'.
     * @return string
     */
    private function file(string $relative): string
    {
        return $this->storage . '/app/public/translations/' . $relative;
    }

    /**
     * @description Writes languages.json.
     * @param array<int, array<string, mixed>> $languages Entries.
     * @return void
     */
    private function languages(array $languages): void
    {
        File::ensureDirectoryExists(dirname($this->file('languages.json')));
        File::put($this->file('languages.json'), json_encode($languages));
    }

    /**
     * @description Saving translations: creates the folder and file, logs a summary of new and
     *   changed keys (nested, cut at 200 chars), says when nothing changed; the public endpoint
     *   returns the file; validation of the language code.
     * @input POST web cz {home: {title: Domů}}; POST changed title + new keys (long); POST same again;
     *        POST en with 20 keys; GET translations/web/cz and /de; invalid lang values.
     * @output 200 detected 1 / 3 / 0; log "NEW:home(…" / "CHNG:home.title(Domů->Úvod)" /
     *   "no value changes"; 20 new keys → summary cut to 200 chars + '...'; GET returns the data /
     *   404; 422 for 'c', '../x', 'english'.
     */
    public function test_save_and_show_translations(): void
    {
        $this->signIn($this->userWith(self::EDITOR));

        $this->postJson('/api/save_translations/web', ['lang' => 'cz', 'data' => ['home' => ['title' => 'Domů']]])->assertOk()->assertJson(['data' => ['detected_changes' => 1]]);
        $this->assertSame(['home' => ['title' => 'Domů']], json_decode(File::get($this->file('web/cz.json')), true));
        $this->assertTrue(WebLog::where('description', 'like', 'Update cz.json: NEW:home([Array])%')->exists());

        $long = str_repeat('x', 300);
        $this->postJson('/api/save_translations/web', ['lang' => 'cz', 'data' => ['home' => ['title' => 'Úvod', 'text' => $long], 'footer' => $long]])
            ->assertOk()->assertJsonPath('data.detected_changes', 3);
        $description = WebLog::latest('id')->value('description');
        $this->assertStringContainsString('CHNG:home.title(Domů->Úvod)', $description);
        $this->assertStringContainsString('NEW:footer(xxxxxxxxxxxxxxx)', $description);
        $this->postJson('/api/save_translations/web', ['lang' => 'cz', 'data' => ['home' => ['title' => 'Úvod', 'text' => $long], 'footer' => $long]])->assertJsonPath('data.detected_changes', 0);
        $this->assertSame('Update cz.json (no value changes detected)', WebLog::latest('id')->value('description'));
        $many = array_fill_keys(array_map(fn ($i) => "key{$i}", range(1, 20)), 'value');
        $this->postJson('/api/save_translations/web', ['lang' => 'en', 'data' => $many])->assertJsonPath('data.detected_changes', 20);
        $summary = WebLog::latest('id')->value('description');
        $this->assertStringEndsWith('...', $summary);
        $this->assertSame(200, mb_strlen($summary) - mb_strlen('Update en.json: '));

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/translations/web/cz')->assertOk()->assertJsonPath('data.home.title', 'Úvod');
        $this->getJson('/api/translations/web/de')->assertStatus(404)->assertJson(['message' => 'Not found']);

        $this->signIn($this->userWith(self::EDITOR));
        foreach (['c', '../x', 'english'] as $lang) {
            $this->postJson('/api/save_translations/web', ['lang' => $lang, 'data' => ['a' => 'b']])->assertStatus(422)->assertJsonValidationErrors(['lang']);
        }
        $this->postJson('/api/save_translations/web', ['lang' => 'cz'])->assertStatus(422)->assertJsonValidationErrors(['data']);
    }

    /**
     * @description SECURITY: module / language codes cannot leave the translations folder - a
     *   module or code with dots never matches a route.
     * @input File storage/app/public/secret.json; '..' plain and URL-encoded (%2E%2E) as module / language
     *        in GET translations, POST save_translations, DELETE languages, POST icon; GET languages/WEB.
     * @output 404 / 405 every time (never 200 / 422 = controller reached; the old routes answered
     *   422 here); secret.json unchanged; nothing written outside translations/.
     */
    public function test_path_traversal_is_refused(): void
    {
        File::put($this->storage . '/app/public/secret.json', '{"secret":1}');
        $this->signIn($this->userWith(self::EDITOR));

        // A path with dots never reaches the controller: 404 (no route) or 405 (normalised
        // to another route) - never 200 / 422 (= the controller ran).
        $refused = fn ($response) => $this->assertContains($response->status(), [404, 405]);
        $refused($this->getJson('/api/translations/../secret'));
        $refused($this->getJson('/api/translations/%2E%2E/secret'));
        $refused($this->getJson('/api/translations/web/..'));
        $refused($this->postJson('/api/save_translations/..', ['lang' => 'cz', 'data' => ['x' => 1]]));
        $refused($this->postJson('/api/save_translations/%2E%2E', ['lang' => 'cz', 'data' => ['x' => 1]]));
        $refused($this->deleteJson('/api/languages/web/%2E%2E'));
        $refused($this->post('/api/languages/%2E%2E/en/icon', [], ['Accept' => 'application/json']));
        $this->getJson('/api/languages/WEB')->assertStatus(404);
        $this->assertSame('{"secret":1}', File::get($this->storage . '/app/public/secret.json'));
        $this->assertFalse(File::exists($this->storage . '/app/public/cz.json'));
    }

    /**
     * @description A failing write answers 500 without the server path in the message and is logged.
     * @input A folder exists where web/cz.json should be written.
     * @output 500 {message 'Saving translations failed.'}; Log::error.
     */
    public function test_save_failure(): void
    {
        $this->signIn($this->userWith(self::EDITOR));
        File::makeDirectory($this->file('web/cz.json'), 0755, true);
        Log::spy();

        $this->postJson('/api/save_translations/web', ['lang' => 'cz', 'data' => ['a' => 'b']])->assertStatus(500)
            ->assertExactJson(['message' => 'Saving translations failed.']);
        Log::shouldHaveReceived('error')->withArgs(fn ($m) => str_starts_with($m, 'Saving translations web/cz failed'))->once();
    }

    /**
     * @description Language lists: without languages.json the defaults belong to 'web'; with a
     *   file each module gets only its entries (entries without module = web) with an icon URL
     *   instead of the stored path.
     * @input No folder: POST shop [en] (creates translations/languages.json with the web defaults);
     *        no file: GET web / shop; file with web cz (icon), shop en, legacy entry de: GET web / shop.
     * @output web [cz, en] / shop []; web [cz with iconUrl, de] / shop [en]; no icon_path in the answer.
     */
    public function test_get_languages(): void
    {
        $this->signIn($this->userWith(self::EDITOR));
        $this->assertFalse(File::isDirectory($this->file('')));
        $this->postJson('/api/languages/shop', ['languages' => json_encode([['code' => 'en', 'name' => 'English']])])->assertNoContent();
        // The defaults (web) are kept next to the new shop list in the newly created folder.
        $this->assertSame([['cz', 'web'], ['en', 'web'], ['en', 'shop']], array_map(
            fn ($l) => [$l['code'], $l['module'] ?? 'web'],
            json_decode(File::get($this->file('languages.json')), true)
        ));
        File::deleteDirectory($this->file(''));

        $this->getJson('/api/languages/web')->assertOk()->assertJsonPath('data.*.code', ['cz', 'en']);
        $this->getJson('/api/languages/shop')->assertOk()->assertJsonPath('data', []);

        $this->languages([
            ['code' => 'cz', 'name' => 'Čeština', 'module' => 'web', 'icon_path' => 'translation_images/web/cz.png'],
            ['code' => 'en', 'name' => 'English', 'module' => 'shop', 'icon_path' => null],
            ['code' => 'de', 'name' => 'Deutsch'],
        ]);
        $web = $this->getJson('/api/languages/web')->assertOk()->assertJsonPath('data.*.code', ['cz', 'de'])->json('data');
        $this->assertStringEndsWith('/storage/translation_images/web/cz.png', $web[0]['iconUrl']);
        $this->assertNull($web[1]['iconUrl']);
        $this->assertArrayNotHasKey('icon_path', $web[0]);
        $this->getJson('/api/languages/shop')->assertJsonPath('data.*.code', ['en']);
    }

    /**
     * @description Saving a module's language list keeps the other modules, the stored icons
     *   and built-in flags (never taken from the client); an icon for one of the codes can be
     *   uploaded with the list; invalid lists are refused.
     * @input File: web cz (built-in, icon), shop en. POST shop [{en}, {de}] + icon for de; POST web
     *        [{cz isBuiltIn false}] ; invalid lists (no code, '../x', duplicate, not JSON).
     * @output shop [en, de] with de icon stored; web cz still built-in with its icon; log; 422s.
     */
    public function test_save_languages(): void
    {
        $this->signIn($this->userWith(self::EDITOR));
        Storage::disk('public')->put('translation_images/web/cz.png', 'png');
        $this->languages([
            ['code' => 'cz', 'name' => 'Čeština', 'module' => 'web', 'isBuiltIn' => true, 'icon_path' => 'translation_images/web/cz.png'],
            ['code' => 'en', 'name' => 'English', 'module' => 'shop'],
        ]);

        $this->post('/api/languages/shop', [
            'languages' => json_encode([['code' => 'en', 'name' => 'English', 'active' => true], ['code' => 'de', 'name' => 'Deutsch', 'active' => false]]),
            'icon' => $this->fakeImage('de.png'), 'target_code' => 'de',
        ], ['Accept' => 'application/json'])->assertNoContent();
        $this->postJson('/api/languages/web', ['languages' => json_encode([['code' => 'cz', 'name' => 'Česky', 'isBuiltIn' => false]])])->assertNoContent();

        $meta = collect(json_decode(File::get($this->file('languages.json')), true));
        $de = $meta->firstWhere('code', 'de');
        $this->assertSame('shop', $de['module']);
        Storage::disk('public')->assertExists($de['icon_path']);
        $this->assertSame(['Česky', true, 'translation_images/web/cz.png'], [$meta->firstWhere('code', 'cz')['name'], $meta->firstWhere('code', 'cz')['isBuiltIn'], $meta->firstWhere('code', 'cz')['icon_path']]);
        $this->assertSame(3, $meta->count());
        $this->assertTrue(WebLog::where('module', 'Languages:shop')->exists());

        $this->post('/api/languages/shop', ['languages' => json_encode([['code' => 'en', 'name' => 'English']]), 'icon' => $this->fakeImage('x.png'), 'target_code' => 'xx'], ['Accept' => 'application/json'])->assertNoContent();
        foreach ([[['name' => 'No code']], [['code' => '../x', 'name' => 'X']], [['code' => 'en', 'name' => 'A'], ['code' => 'en', 'name' => 'B']], []] as $invalid) {
            $this->postJson('/api/languages/shop', ['languages' => json_encode($invalid)])->assertStatus(422)->assertJson(['message' => 'Invalid language list.']);
        }
        $this->postJson('/api/languages/shop', ['languages' => 'not json'])->assertStatus(422)->assertJsonValidationErrors(['languages']);
    }

    /**
     * @description Icon upload replaces the icon of the language in THIS module only (the same
     *   code in another module keeps its icon); unknown code 404; validation; raster only (finding #34).
     * @input web en (icon web.png) + shop en (icon shop.png); POST languages/shop/en/icon; shop/xx; no file;
     *        an SVG flag (with a script).
     * @output shop en new icon, shop.png deleted, web en still web.png; iconUrl; 404; 422; 422 icon (SVG).
     */
    public function test_store_language_icon(): void
    {
        $this->signIn($this->userWith(self::EDITOR));
        Storage::disk('public')->put('translation_images/web/en.png', 'w');
        Storage::disk('public')->put('translation_images/shop/en.png', 's');
        $this->languages([
            ['code' => 'en', 'name' => 'English', 'module' => 'web', 'icon_path' => 'translation_images/web/en.png'],
            ['code' => 'en', 'name' => 'English', 'module' => 'shop', 'icon_path' => 'translation_images/shop/en.png'],
        ]);

        $url = $this->post('/api/languages/shop/en/icon', ['icon' => $this->fakeImage('flag.png')], ['Accept' => 'application/json'])
            ->assertOk()->json('data.iconUrl');
        $this->assertStringContainsString('/storage/translation_images/shop/en_', $url);

        $meta = json_decode(File::get($this->file('languages.json')), true);
        $this->assertSame('translation_images/web/en.png', $meta[0]['icon_path']);
        $this->assertStringStartsWith('translation_images/shop/en_', $meta[1]['icon_path']);
        Storage::disk('public')->assertExists('translation_images/web/en.png');
        Storage::disk('public')->assertMissing('translation_images/shop/en.png');

        $this->post('/api/languages/shop/xx/icon', ['icon' => $this->fakeImage('x.png')], ['Accept' => 'application/json'])->assertStatus(404);
        $this->postJson('/api/languages/shop/en/icon', [])->assertStatus(422)->assertJsonValidationErrors(['icon']);
        $svg = UploadedFile::fake()->createWithContent('flag.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        $this->post('/api/languages/shop/en/icon', ['icon' => $svg], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors(['icon']);
    }

    /**
     * @description Deleting a language removes its entry, icon and translation file of that
     *   module; built-in languages and unknown codes are refused; a failing icon delete is only
     *   logged as a warning.
     * @input web cz (built-in), web de (icon + de.json), shop de; DELETE web/de; web/cz; web/xx;
     *        shop de with an icon whose delete throws.
     * @output 204, de.json / icon gone, shop de kept; 403; 404; 204 + Log::warning.
     */
    public function test_destroy_language(): void
    {
        $this->signIn($this->userWith(self::EDITOR));
        Storage::disk('public')->put('translation_images/web/de.png', 'd');
        File::ensureDirectoryExists($this->file('web'));
        File::put($this->file('web/de.json'), '{}');
        $this->languages([
            ['code' => 'cz', 'name' => 'Čeština', 'module' => 'web', 'isBuiltIn' => true],
            ['code' => 'de', 'name' => 'Deutsch', 'module' => 'web', 'icon_path' => 'translation_images/web/de.png'],
            ['code' => 'de', 'name' => 'Deutsch', 'module' => 'shop', 'icon_path' => 'translation_images/shop/de.png'],
        ]);

        $this->deleteJson('/api/languages/web/de')->assertNoContent();
        $this->assertFalse(File::exists($this->file('web/de.json')));
        Storage::disk('public')->assertMissing('translation_images/web/de.png');
        $this->assertSame([['cz', 'web'], ['de', 'shop']], array_map(fn ($l) => [$l['code'], $l['module']], json_decode(File::get($this->file('languages.json')), true)));
        $this->assertTrue(WebLog::where('description', 'Deleted language: de')->exists());

        $this->deleteJson('/api/languages/web/cz')->assertStatus(403)->assertJson(['message' => 'Built-in languages cannot be deleted.']);
        $this->deleteJson('/api/languages/web/xx')->assertStatus(404);

        $disk = Mockery::mock(\Illuminate\Contracts\Filesystem\Filesystem::class);
        $disk->shouldReceive('exists')->andThrow(new \RuntimeException('disk offline'));
        Storage::set('public', $disk);
        Log::spy();
        $this->deleteJson('/api/languages/shop/de')->assertNoContent();
        Log::shouldHaveReceived('warning')->withArgs(fn ($m) => $m === 'Failed to delete icon: disk offline')->once();
    }

    /**
     * @description The language editor needs one of the translation permissions.
     * @input Account without permission: POST save_translations/web, POST languages/web, DELETE languages/web/de.
     * @output 403 each.
     */
    public function test_permission(): void
    {
        $this->signIn($this->user());

        $this->postJson('/api/save_translations/web', ['lang' => 'cz', 'data' => ['a' => 1]])->assertStatus(403);
        $this->postJson('/api/languages/web', ['languages' => '[]'])->assertStatus(403);
        $this->deleteJson('/api/languages/web/de')->assertStatus(403);
    }

    /**
     * @description SECURITY (finding #32): each write checks the permission of the module in the URL -
     *   a web editor cannot change the shop translations / languages and vice versa; an unknown module
     *   is sysadmin-only; the denial is logged.
     * @input Web editor: save shop / save web; shop editor: languages web, icon web, delete web language,
     *        save shop; editor of both: save module 'blog'; sysadmin: save 'blog'.
     * @output 403 / 200; 403 ×3 / 200; 403 'blog'; 200 for sysadmin; web log 'update_denied'.
     */
    public function test_module_permission(): void
    {
        $this->signIn($this->userWith(['web-edit-website-update']));
        $this->postJson('/api/save_translations/shop', ['lang' => 'cz', 'data' => ['a' => 1]])->assertStatus(403)
            ->assertJson(['message' => 'You do not have permission to edit the translations of this module.']);
        $this->postJson('/api/save_translations/web', ['lang' => 'cz', 'data' => ['a' => 1]])->assertOk();
        $this->assertSame('Denied change of the shop translations (missing shop-edit-eshop-update).',
            \App\Models\Web\WebLog::where('event_type', 'update_denied')->value('description'));

        $this->signIn($this->userWith(['shop-edit-eshop-update']));
        $this->postJson('/api/languages/web', ['languages' => json_encode([['code' => 'cz', 'name' => 'Čeština']])])->assertStatus(403);
        $this->postJson('/api/languages/web/cz/icon', [])->assertStatus(403);
        $this->deleteJson('/api/languages/web/de')->assertStatus(403);
        $this->postJson('/api/save_translations/shop', ['lang' => 'cz', 'data' => ['a' => 1]])->assertOk();

        $this->signIn($this->userWith(self::EDITOR));
        $this->postJson('/api/save_translations/blog', ['lang' => 'cz', 'data' => ['a' => 1]])->assertStatus(403);
        $this->signIn($this->sysadmin());
        $this->postJson('/api/save_translations/blog', ['lang' => 'cz', 'data' => ['a' => 1]])->assertOk();
    }
}
