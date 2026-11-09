<?php
/**
 * @file 2026_11_09_000000_add_remember_to_refresh_tokens.php
 * @path api/database/migrations/2026_11_09_000000_add_remember_to_refresh_tokens.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description "Remember me" of the admin login: `refresh_tokens.remember`, inherited by every
 *   rotation of the family. Remembered = persistent cookie, REFRESH_TTL_DAYS of inactivity;
 *   not remembered = browser-session cookie (gone when the browser closes) and a short idle
 *   limit (AuthCookies::SESSION_IDLE_HOURS). The absolute limit applies to both.
 * @note Existing sessions count as remembered - nobody is logged out by the migration.
 *   down() drops the column.
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds `remember` (existing rows: true).
     * @return void
     */
    public function up(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table) {
            $table->boolean('remember')->default(true)->after('session_expires_at');
        });
    }

    /**
     * @description Drops the column.
     * @return void
     */
    public function down(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table) {
            $table->dropColumn('remember');
        });
    }
};
