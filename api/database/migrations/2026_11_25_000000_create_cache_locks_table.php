<?php
/**
 * @file 2026_11_25_000000_create_cache_locks_table.php
 * @path api/database/migrations/2026_11_25_000000_create_cache_locks_table.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Table of the locks of the database cache store (CACHE_STORE=database) - Laravel's
 *   own `cache_locks` (key, owner, expiration). The baseline schema (baseline.sql) has the table
 *   `cache` but not this one, so on a database created from the baseline every Cache::lock()
 *   failed - above all the mutex of the scheduler: every job with withoutOverlapping() (the
 *   nightly GDPR retention, security events, auth and file clean-ups) stopped with "Table
 *   'cache_locks' doesn't exist" before it ran.
 * @note Created only when missing - installations from the former SQL dump may have it already.
 * @dependencies config/cache.php (stores.database.lock_table, default cache_locks)
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the lock table when it does not exist.
     * @return void
     */
    public function up(): void
    {
        if (Schema::hasTable('cache_locks')) {
            return;
        }

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration')->index();
        });
    }

    /**
     * @description Drops the lock table (only locks, no data).
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('cache_locks');
    }
};
