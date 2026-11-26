<?php

/**
 * @file TranslationSyncTest.php
 * @path api/tests/Unit/Core/TranslationSyncTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the release sync of the base translations: the three-way merge
 *   (App\Support\I18n\TranslationSeedMerger) and the command `translations:sync` on a temporary
 *   storage folder and a temporary seed folder (as resources/translations of the release); the
 *   default seed is resources/translations.
 * @dependencies
 * - Tests\TestCase; a temporary storage folder (useStoragePath).
 */

namespace Tests\Unit\Core;

use App\Console\Commands\SyncTranslationsCommand;
use App\Support\I18n\TranslationSeedMerger;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * @description TranslationSeedMerger and SyncTranslationsCommand.
 */
class TranslationSyncTest extends TestCase
{
    /** @var string Temporary storage folder. */
    private string $storage;

    /** @var string Temporary seed folder (base translations of the "release"). */
    private string $seed;

    /**
     * @description Points storage_path() to an empty temporary folder and creates the seed folder.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $root = sys_get_temp_dir() . '/rpsw-translation-sync-' . uniqid();
        $this->storage = $root . '/storage';
        $this->seed = $root . '/seed';
        File::makeDirectory($this->storage . '/app/public', 0755, true);
        File::makeDirectory($this->seed, 0755, true);
        $this->app->useStoragePath($this->storage);
    }

    /**
     * @description Removes the temporary folders.
     * @return void
     */
    protected function tearDown(): void
    {
        File::deleteDirectory(dirname($this->storage));
        parent::tearDown();
    }

    /**
     * @description Writes a JSON file of the seed.
     * @param string $relative E.g. 'shop/cz.json'.
     * @param array<string, mixed>|list<mixed> $data Content.
     * @return void
     */
    private function seedFile(string $relative, array $data): void
    {
        File::ensureDirectoryExists(dirname($this->seed . '/' . $relative));
        File::put($this->seed . '/' . $relative, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @description Writes a translation file of the server (as the admin saves it).
     * @param string $relative E.g. 'shop/cz.json'.
     * @param array<string, mixed> $data Content.
     * @return void
     */
    private function serverFile(string $relative, array $data): void
    {
        $path = $this->storage . '/' . SyncTranslationsCommand::TARGET . '/' . $relative;
        File::ensureDirectoryExists(dirname($path));
        File::put($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @description Reads a translation file of the server.
     * @param string $relative E.g. 'shop/cz.json'.
     * @return mixed Decoded content.
     */
    private function server(string $relative): mixed
    {
        return json_decode(File::get($this->storage . '/' . SyncTranslationsCommand::TARGET . '/' . $relative), true);
    }

    /**
     * @description Runs the command against the temporary seed.
     * @param array<string, mixed> $options Extra options.
     * @return \Illuminate\Testing\PendingCommand
     */
    private function sync(array $options = [])
    {
        return $this->artisan('translations:sync', ['--seed' => $this->seed] + $options);
    }

    /**
     * @description New keys are added, texts nobody edited follow the release, edited texts stay,
     *   keys removed by the release disappear unless they were edited.
     * @input Base {a, b, c, d, old, edited_old}; server = base with b and edited_old edited;
     *   seed: a and b changed, d removed... (see the arrays).
     * @output a updated, b kept (edited), c unchanged, new added, old removed, edited_old kept.
     */
    public function test_merge_follows_the_release_and_keeps_edited_texts(): void
    {
        $base = ['g' => ['a' => 'A1', 'b' => 'B1', 'c' => 'C'], 'old' => 'O', 'edited_old' => 'E1'];
        $server = ['g' => ['a' => 'A1', 'b' => 'B (admin)', 'c' => 'C'], 'old' => 'O', 'edited_old' => 'E (admin)'];
        $seed = ['g' => ['a' => 'A2', 'b' => 'B2', 'c' => 'C', 'new' => 'N']];

        $merge = TranslationSeedMerger::merge($server, $seed, $base);

        $this->assertSame(
            ['g' => ['a' => 'A2', 'b' => 'B (admin)', 'c' => 'C', 'new' => 'N'], 'edited_old' => 'E (admin)'],
            $merge['data']
        );
        $this->assertSame([1, 1, 1, 2], [$merge['added'], $merge['updated'], $merge['removed'], $merge['kept']]);
    }

    /**
     * @description Without the previous seed (first sync) only the missing keys are added -
     *   different texts and extra keys of the server stay (an edit cannot be told from an old text).
     * @input Server {a: 'mine', extra}; seed {a: 'A2', new}; base null.
     * @output {a: 'mine', new, extra}; 1 added, 0 updated, 0 removed, 2 kept.
     */
    public function test_first_merge_only_adds_missing_keys(): void
    {
        $merge = TranslationSeedMerger::merge(['a' => 'mine', 'extra' => 'X'], ['a' => 'A2', 'new' => 'N'], null);

        $this->assertSame(['a' => 'mine', 'new' => 'N', 'extra' => 'X'], $merge['data']);
        $this->assertSame([1, 0, 0, 2], [$merge['added'], $merge['updated'], $merge['removed'], $merge['kept']]);
    }

    /**
     * @description Lists are one text (compared and replaced as a whole); a key that changed its
     *   structure follows the seed.
     * @input Base/server list ['x','y'] → seed ['x','y','z']; server 'k' text → seed 'k' group.
     * @output The list from the seed; 'k' becomes the group of the seed.
     */
    public function test_lists_are_one_text_and_the_seed_structure_wins(): void
    {
        $base = ['items' => ['x', 'y'], 'k' => 'text'];
        $seed = ['items' => ['x', 'y', 'z'], 'k' => ['child' => 'C']];

        $merge = TranslationSeedMerger::merge($base, $seed, $base);

        $this->assertSame(['items' => ['x', 'y', 'z'], 'k' => ['child' => 'C']], $merge['data']);
    }

    /**
     * @description prune() removes from a client language only the keys Czech no longer has and
     *   adds nothing; a key whose structure changed in Czech is removed too.
     * @input de {a, old, g: 'text'}; Czech {a, b, g: {x}}.
     * @output de {a}; 2 removed.
     */
    public function test_prune_removes_only_keys_czech_no_longer_has(): void
    {
        $prune = TranslationSeedMerger::prune(
            ['a' => 'A de', 'old' => 'O de', 'g' => 'text'],
            ['a' => 'A', 'b' => 'B', 'g' => ['x' => 'X']]
        );

        $this->assertSame(['a' => 'A de'], $prune['data']);
        $this->assertSame(2, $prune['removed']);
    }

    /**
     * @description A release that removes a key from Czech removes it from the languages of the
     *   client too; their translations stay and new keys are not added (the editor shows them as
     *   missing). A dry run reports the removal and writes nothing.
     * @input Server cz {title, old}, de {title, old}; applied seed = server cz; release: old
     *   removed, alert added.
     * @output Dry run: "1 removed (no longer in Czech)" for de, files unchanged. Sync: cz {title,
     *   alert}, de {title} with its German text.
     */
    public function test_release_removes_dropped_keys_from_client_languages(): void
    {
        $this->seedFile('shop/cz.json', ['checkout' => ['title' => 'Pokladna', 'old' => 'Staré']]);
        $this->serverFile('shop/cz.json', ['checkout' => ['title' => 'Pokladna', 'old' => 'Staré']]);
        $this->serverFile('shop/de.json', ['checkout' => ['title' => 'Kasse', 'old' => 'Alt']]);
        $this->sync()->assertExitCode(0);

        $this->seedFile('shop/cz.json', ['checkout' => ['title' => 'Pokladna', 'alert' => 'Chyba']]);
        $this->sync(['--dry-run' => true])
            ->expectsOutputToContain('[dry run] translations shop/de.json: 1 removed (no longer in Czech)')
            ->assertExitCode(0);
        $this->assertSame(['checkout' => ['title' => 'Kasse', 'old' => 'Alt']], $this->server('shop/de.json'));

        $this->sync()
            ->expectsOutputToContain('translations shop/cz.json: 1 added, 0 updated, 1 removed, 0 kept as edited in the admin')
            ->expectsOutputToContain('translations shop/de.json: 1 removed (no longer in Czech)')
            ->assertExitCode(0);

        $this->assertSame(['checkout' => ['title' => 'Pokladna', 'alert' => 'Chyba']], $this->server('shop/cz.json'));
        $this->assertSame(['checkout' => ['title' => 'Kasse']], $this->server('shop/de.json'));
    }

    /**
     * @description A new installation gets the whole seed and the applied copy is stored.
     * @input Empty storage; seed languages.json + shop/cz.json + README.md.
     * @output Both JSON files on the server, the applied copy of shop/cz.json in the private
     *   storage; the README stays in the seed only.
     */
    public function test_new_installation_gets_the_whole_seed(): void
    {
        $this->seedFile('languages.json', [['code' => 'cz', 'module' => 'shop', 'isBuiltIn' => true]]);
        $this->seedFile('shop/cz.json', ['checkout' => ['title' => 'Pokladna']]);
        File::put($this->seed . '/README.md', '# Guide');

        $this->sync()->expectsOutputToContain('translations shop/cz.json: created')->assertExitCode(0);
        $this->assertFileDoesNotExist($this->storage . '/' . SyncTranslationsCommand::TARGET . '/README.md');

        $this->assertSame(['checkout' => ['title' => 'Pokladna']], $this->server('shop/cz.json'));
        $this->assertSame('cz', $this->server('languages.json')[0]['code']);
        $this->assertFileExists($this->storage . '/' . SyncTranslationsCommand::APPLIED . '/shop/cz.json');
    }

    /**
     * @description Two releases in a row: the first sync of an existing server adds the new key,
     *   the next one also updates an untouched text and keeps the one edited in the admin; the
     *   texts of the admin languages (en.json) and languages.json are not touched.
     * @input Server shop/cz.json {title, button (edited)}, en.json, own languages.json;
     *   release 1 adds alert; release 2 changes title and button.
     * @output After release 2: title of the release, button of the admin, alert kept; en.json and
     *   languages.json unchanged.
     */
    public function test_release_adds_and_updates_keys_and_keeps_admin_edits(): void
    {
        $languages = [['code' => 'cz', 'module' => 'shop', 'isBuiltIn' => true], ['code' => 'en', 'module' => 'shop', 'isBuiltIn' => false]];
        $this->serverFile('languages.json', $languages);
        $this->serverFile('shop/cz.json', ['checkout' => ['title' => 'Pokladna', 'button' => 'Zaplatit teď']]);
        $this->serverFile('shop/en.json', ['checkout' => ['title' => 'Checkout']]);
        $this->seedFile('languages.json', [['code' => 'cz', 'module' => 'shop', 'isBuiltIn' => true]]);

        // Release 1: one new key; the server has no applied seed yet.
        $this->seedFile('shop/cz.json', ['checkout' => ['title' => 'Pokladna', 'button' => 'Zaplatit', 'alert' => 'Chyba']]);
        $this->sync()
            ->expectsOutputToContain('translations shop/cz.json: 1 added, 0 updated, 0 removed, 1 kept as edited in the admin')
            ->assertExitCode(0);

        // Release 2: the title and the button change in the repository.
        $this->seedFile('shop/cz.json', ['checkout' => ['title' => 'Objednávka', 'button' => 'Odeslat', 'alert' => 'Chyba']]);
        $this->sync()
            ->expectsOutputToContain('translations shop/cz.json: 0 added, 1 updated, 0 removed, 1 kept as edited in the admin')
            ->assertExitCode(0);

        $this->assertSame(
            ['checkout' => ['title' => 'Objednávka', 'button' => 'Zaplatit teď', 'alert' => 'Chyba']],
            $this->server('shop/cz.json')
        );
        $this->assertSame(['checkout' => ['title' => 'Checkout']], $this->server('shop/en.json'));
        $this->assertSame($languages, $this->server('languages.json'));
    }

    /**
     * @description A release without text changes changes nothing; --dry-run reports and writes
     *   nothing (not even the applied copy).
     * @input Server = seed; then a seed with a new key and --dry-run.
     * @output "up to date"; dry run reports "1 added" but the server file and the applied copy stay.
     */
    public function test_no_change_and_dry_run_write_nothing(): void
    {
        $this->serverFile('web/cz.json', ['a' => 'A']);
        $this->seedFile('web/cz.json', ['a' => 'A']);
        $this->sync()->expectsOutputToContain('translations: up to date')->assertExitCode(0);

        $this->seedFile('web/cz.json', ['a' => 'A', 'b' => 'B']);
        $applied = File::get($this->storage . '/' . SyncTranslationsCommand::APPLIED . '/web/cz.json');
        $this->sync(['--dry-run' => true])->expectsOutputToContain('[dry run] translations web/cz.json: 1 added')->assertExitCode(0);

        $this->assertSame(['a' => 'A'], $this->server('web/cz.json'));
        $this->assertSame($applied, File::get($this->storage . '/' . SyncTranslationsCommand::APPLIED . '/web/cz.json'));
    }

    /**
     * @description A broken file on the server is left as it is (and its applied copy too); a
     *   broken seed file fails the command without touching the server.
     * @input Server web/cz.json = "{broken"; seed shop/cz.json = "[1,"; seed web/cz.json valid.
     * @output Warning for web, error and exit 1 for shop; the server file unchanged, no applied copies.
     */
    public function test_invalid_json_is_never_overwritten(): void
    {
        $path = $this->storage . '/' . SyncTranslationsCommand::TARGET . '/web/cz.json';
        File::ensureDirectoryExists(dirname($path));
        File::put($path, '{broken');
        $this->seedFile('web/cz.json', ['a' => 'A']);
        File::ensureDirectoryExists($this->seed . '/shop');
        File::put($this->seed . '/shop/cz.json', '[1,');

        $this->sync()
            ->expectsOutputToContain('web/cz.json: the file on the server is not valid JSON - left as it is')
            ->expectsOutputToContain('shop/cz.json: the base file of the release is not valid JSON - skipped')
            ->assertExitCode(1);

        $this->assertSame('{broken', File::get($path));
        $this->assertDirectoryDoesNotExist($this->storage . '/' . SyncTranslationsCommand::APPLIED);
    }

    /**
     * @description The real base translations of the repository merge into themselves unchanged
     *   (valid JSON objects, no structure collisions).
     * @input resources/translations of the repository (the seed) as both the seed and the server;
     *   the default seed of the command.
     * @output For every module file: nothing added, updated, removed or kept; data identical.
     */
    public function test_repository_translations_merge_cleanly(): void
    {
        $this->assertSame(base_path('resources/translations'), SyncTranslationsCommand::defaultSeed());
        $files = File::glob(SyncTranslationsCommand::defaultSeed() . '/*/*.json');
        $this->assertNotEmpty($files);

        foreach ($files as $file) {
            $data = json_decode(File::get($file), true);
            $this->assertIsArray($data, $file);
            $merge = TranslationSeedMerger::merge($data, $data, $data);
            $this->assertSame($data, $merge['data'], $file);
            $this->assertSame([0, 0, 0, 0], [$merge['added'], $merge['updated'], $merge['removed'], $merge['kept']], $file);
        }
    }
}
