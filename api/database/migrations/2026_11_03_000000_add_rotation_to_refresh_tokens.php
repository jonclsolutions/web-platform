<?php
/**
 * @file 2026_11_03_000000_add_rotation_to_refresh_tokens.php
 * @path api/database/migrations/2026_11_03_000000_add_rotation_to_refresh_tokens.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Refresh token families with reuse detection (AuthController::refresh()):
 *   - `family` - id shared by all tokens of one login (issued at login, inherited by every rotation);
 *   - `rotated_at` - when the token was used and replaced; a used token stays in the table until
 *     it expires, so a second use of it (a stolen copy) is recognised and ends the whole family.
 * @note Existing rows get their own family (their id) and stay valid - nobody is logged out.
 *   down() drops both columns.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds `family` and `rotated_at`; existing tokens become one-token families.
     * @return void
     */
    public function up(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table) {
            $table->string('family', 64)->nullable()->after('token');
            $table->timestamp('rotated_at')->nullable()->after('expires_at');
            $table->index('family', 'refresh_tokens_family_index');
        });

        DB::table('refresh_tokens')->whereNull('family')->update(['family' => DB::raw('CAST(id AS CHAR)')]);
    }

    /**
     * @description Drops the rotation columns.
     * @return void
     */
    public function down(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table) {
            $table->dropIndex('refresh_tokens_family_index');
            $table->dropColumn(['family', 'rotated_at']);
        });
    }
};
