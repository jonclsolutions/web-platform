<?php
/**
 * @file 2026_11_10_000000_add_avatar_to_users.php
 * @path api/database/migrations/2026_11_10_000000_add_avatar_to_users.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Profile photo of an admin account: `users.avatar_path` - path of the processed
 *   photo (256×256 WebP without metadata) on the private disk; null = the default image.
 * @note down() drops the column (the files stay - delete storage/app/private/avatars by hand).
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds `avatar_path`.
     * @return void
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('full_name');
        });
    }

    /**
     * @description Drops the column.
     * @return void
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar_path');
        });
    }
};
