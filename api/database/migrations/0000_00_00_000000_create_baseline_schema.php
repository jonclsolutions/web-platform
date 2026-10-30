<?php
/**
 * @file 0000_00_00_000000_create_baseline_schema.php
 * @path api/database/migrations/0000_00_00_000000_create_baseline_schema.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-30
 * @description Baseline of the database: creates the WHOLE schema (database/schema/baseline.sql,
 *   structure of the database as of 2026-10-29) on an EMPTY database. On a database that already
 *   has the tables (every installation created from the former SQL dump - local copies and the
 *   production server) it does nothing and is only recorded as run, so nothing is dropped or
 *   changed there. Every later schema change is an ordinary Laravel migration after this one.
 * @note The SQL runs through PDO (DB::unprepared), not the `mysql` client - it works on shared
 *   hosting without shell tools. "Already has the tables" = the table `users` exists.
 * @refactor-note (2026-10-30) Replaces the import of database/db.sql in phpMyAdmin and the old
 *   partial migrations (users, cache, jobs, tokens, …) that never matched the real schema.
 * @dependencies
 * - database/schema/baseline.sql
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the schema on an empty database; no-op on an existing one.
     * @return void
     */
    public function up(): void
    {
        if (Schema::hasTable('users')) {
            return;
        }

        DB::unprepared((string) file_get_contents(database_path('schema/baseline.sql')));
    }

    /**
     * @description The baseline is never rolled back (it would drop every table with its data).
     * @return void
     * @throws RuntimeException Always.
     */
    public function down(): void
    {
        throw new RuntimeException('The baseline schema cannot be rolled back - restore a backup instead.');
    }
};
