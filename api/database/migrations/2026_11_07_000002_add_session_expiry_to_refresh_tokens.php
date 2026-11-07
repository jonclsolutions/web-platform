<?php
/**
 * @file 2026_11_07_000002_add_session_expiry_to_refresh_tokens.php
 * @path api/database/migrations/2026_11_07_000002_add_session_expiry_to_refresh_tokens.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Absolute limit of an admin login: `session_expires_at` - set at login
 *   (AuthCookies::SESSION_MAX_DAYS after it) and inherited by every rotation of the family. No
 *   refresh token outlives it, so after the limit the user must log in again (with 2FA when it is on),
 *   however active the session was.
 * @note Existing rows get the limit counted from the deployment - nobody is logged out by it.
 *   down() drops the column.
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds `session_expires_at`; existing tokens get the full limit from now.
     * @return void
     */
    public function up(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table) {
            $table->timestamp('session_expires_at')->nullable()->after('expires_at');
        });

        DB::table('refresh_tokens')->whereNull('session_expires_at')->update(['session_expires_at' => now()->addDays(30)]);
    }

    /**
     * @description Drops the column.
     * @return void
     */
    public function down(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table) {
            $table->dropColumn('session_expires_at');
        });
    }
};
