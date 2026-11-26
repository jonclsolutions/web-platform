<?php

/**
 * @file TestCase.php
 * @path api/tests/TestCase.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Base class of every api test. Boots the application against a fresh
 *   SQLite in-memory database with the test schema (Tests\Support\TestSchema) and refuses
 *   to run against any other database. A checkout without the runtime translations (a new
 *   clone, CI - storage/app/public/translations is not in git) gets the base translations of
 *   the repository (resources/translations) copied there once per run.
 * @dependencies
 * - phpunit.xml forces DB_CONNECTION=sqlite and DB_DATABASE=:memory:.
 * - Tests\Support\TestSchema, Tests\Support\InteractsWithAccounts.
 */

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use App\Console\Commands\SyncTranslationsCommand;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;
use Tests\Support\InteractsWithAccounts;
use Tests\Support\TestSchema;

/**
 * @description Shared setup: in-memory database guard, schema, account helpers.
 * @note SAFETY: the tests create and drop data freely. setUp() stops the run unless the
 *   default connection is SQLite :memory:, so a misconfigured environment (e.g. a cached
 *   config pointing at the MariaDB dev database) can never touch real data.
 */
abstract class TestCase extends BaseTestCase
{
    use InteractsWithAccounts;

    /**
     * @description Boots the app, checks the database guard and creates the schema.
     * @return void
     * @throws RuntimeException When the default connection is not SQLite :memory:.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $connection = DB::connection();
        if ($connection->getDriverName() !== 'sqlite' || $connection->getConfig('database') !== ':memory:') {
            throw new RuntimeException(
                'Tests must run on SQLite :memory: (see phpunit.xml) - refusing to use connection "'
                . $connection->getName() . '" (' . $connection->getDriverName() . '). '
                . 'Run `php artisan config:clear` if a cached config overrides phpunit.xml.'
            );
        }

        TestSchema::create();
        self::ensureTranslations();
    }

    /** @var bool The runtime translations were checked in this run. */
    private static bool $translationsChecked = false;

    /**
     * @description Copies the base translations (resources/translations, *.json only) into the
     *   runtime folder when it has none yet - the state of a new installation after
     *   translations:sync. An existing folder (the texts of the local admin) is never touched.
     * @return void
     */
    private static function ensureTranslations(): void
    {
        if (self::$translationsChecked) {
            return;
        }
        self::$translationsChecked = true;
        $target = storage_path(SyncTranslationsCommand::TARGET);
        if (File::exists($target . '/languages.json')) {
            return;
        }
        $seed = SyncTranslationsCommand::defaultSeed();
        foreach (File::allFiles($seed) as $file) {
            if ($file->getExtension() === 'json') {
                File::ensureDirectoryExists($target . '/' . $file->getRelativePath());
                File::copy($file->getPathname(), $target . '/' . $file->getRelativePathname());
            }
        }
    }

    /**
     * @description A fake image upload WITHOUT the GD extension (UploadedFile::fake()->image()
     *   needs GD, which is not installed everywhere): a real 1×1 PNG, so the `image` / `mimes`
     *   rules and the MIME detection see a genuine image whatever the file name says.
     * @param string $name Client file name, e.g. 'logo.png'.
     * @return UploadedFile
     */
    protected function fakeImage(string $name = 'image.png'): UploadedFile
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

        return UploadedFile::fake()->createWithContent($name, $png);
    }

    /**
     * @description An upload whose MIME type is detected from its CONTENT, as in a real request -
     *   UploadedFile::fake() reports the type of the file name instead. For tests of uploads whose
     *   name lies about the content (a PNG called `photo.html`). The temporary file is removed
     *   with the application of the test.
     * @param string $name Client file name, e.g. 'photo.html'.
     * @param string $content Bytes of the file.
     * @return UploadedFile
     */
    protected function contentUpload(string $name, string $content): UploadedFile
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'upload');
        file_put_contents($path, $content);
        $this->beforeApplicationDestroyed(fn () => @unlink($path));

        return new UploadedFile($path, $name, null, null, true);
    }

    /**
     * @description A 1×1 PNG and a WebP header that is also valid JavaScript - the content of
     *   the uploads of contentUpload() in the upload security tests.
     * @return array{png: string, webp_js: string}
     */
    protected function polyglotSamples(): array
    {
        return [
            'png'     => base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
            'webp_js' => "RIFF=0;\nWEBP=1;alert(document.domain)//",
        ];
    }

    /**
     * @description Makes every INSERT, UPDATE or DELETE on a table fail with a database
     *   error (SQLite trigger) - to test the error handling (rollback, 500 answer, error
     *   log) of code that wraps its writes in try/catch.
     * @param string $table Table name, e.g. 'users'.
     * @param string $operation 'INSERT', 'UPDATE' or 'DELETE'.
     * @return void
     */
    protected function failOn(string $table, string $operation): void
    {
        $name = "fail_{$table}_" . strtolower($operation);
        DB::unprepared("CREATE TRIGGER {$name} BEFORE {$operation} ON {$table} BEGIN SELECT RAISE(ABORT, 'forced test failure'); END;");
    }

    /**
     * @description Sets or removes an environment variable everywhere env() reads it ($_SERVER,
     *   $_ENV, getenv) - putenv() alone is not enough when a .env file or the runner (CI) defines
     *   the variable, because env() reads $_SERVER / $_ENV first.
     * @param string $name Variable name, e.g. 'TRUSTED_PROXIES'.
     * @param string|null $value New value; null = unset.
     * @return void
     */
    protected function setEnvironment(string $name, ?string $value): void
    {
        if ($value === null) {
            putenv($name);
            unset($_ENV[$name], $_SERVER[$name]);

            return;
        }
        putenv("{$name}={$value}");
        $_ENV[$name] = $_SERVER[$name] = $value;
    }
}
