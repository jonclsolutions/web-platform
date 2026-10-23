<?php

/**
 * @file TestCase.php
 * @path api/tests/TestCase.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Base class of every api test. Boots the application against a fresh
 *   SQLite in-memory database with the test schema (Tests\Support\TestSchema) and refuses
 *   to run against any other database.
 * @dependencies
 * - phpunit.xml forces DB_CONNECTION=sqlite and DB_DATABASE=:memory:.
 * - Tests\Support\TestSchema, Tests\Support\InteractsWithAccounts.
 */

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
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
        $this->registerMysqlFunctions($connection->getPdo());
    }

    /**
     * @description Adds the MySQL functions the production queries use and SQLite lacks:
     *   FIELD(value, a, b, …) = 1-based position of value in the list, 0 when missing
     *   (PageTitleController orders the areas with it).
     * @param \PDO $pdo SQLite connection.
     * @return void
     */
    private function registerMysqlFunctions(\PDO $pdo): void
    {
        $field = static function ($value, ...$list): int {
            $position = array_search($value, $list, true);

            return $position === false ? 0 : $position + 1;
        };

        // PHP 8.4+ has Pdo\Sqlite::createFunction(), older versions PDO::sqliteCreateFunction().
        $pdo instanceof \Pdo\Sqlite ? $pdo->createFunction('FIELD', $field) : $pdo->sqliteCreateFunction('FIELD', $field);
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
}
