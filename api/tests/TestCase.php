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
