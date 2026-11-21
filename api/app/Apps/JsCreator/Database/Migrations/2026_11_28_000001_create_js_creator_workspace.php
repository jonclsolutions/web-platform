<?php
/**
 * @file 2026_11_28_000001_create_js_creator_workspace.php
 * @path app/Apps/JsCreator/Database/Migrations/2026_11_28_000001_create_js_creator_workspace.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Private workspace of every account in JS Creator (stage 1):
 *   - `js_creator_folders` - tree of folders (parent_id, trash with the trash root of a deleted
 *     subtree);
 *   - `js_creator_assets` - images of the library (re-encoded file + thumbnail);
 *   - `js_creator_fonts` - own fonts of an account;
 *   - `js_creator_settings` - one row: default quota of an account (MB);
 *   - `js_creator_user_quotas` - individual quota of an account (MB).
 *   Every row belongs to one account: `user_id` → users ON DELETE CASCADE, so deleting an account
 *   for good deletes its workspace (its files are removed by the clean-up of
 *   JsCreatorRetentionSource).
 * @note down() drops the tables (the files stay until the clean-up / manual removal).
 * @dependencies users
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the workspace tables and the settings row.
     * @return void
     */
    public function up(): void
    {
        Schema::create('js_creator_folders', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('name', 120);
            $table->unsignedBigInteger('trash_root_id')->nullable()->comment('Folder whose deletion moved this one to the trash (itself for the folder deleted by the user).');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['user_id', 'parent_id'], 'idx_js_creator_folders_user_parent');
            $table->foreign('user_id', 'fk_js_creator_folders_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('parent_id', 'fk_js_creator_folders_parent_id')->references('id')->on('js_creator_folders')->cascadeOnDelete();
        });

        Schema::create('js_creator_assets', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('name', 150);
            $table->string('path', 255);
            $table->string('thumb_path', 255);
            $table->string('mime', 32);
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->unsignedBigInteger('size_bytes')->comment('Stored file + thumbnail (counts towards the quota).');
            $table->timestamps();
            $table->softDeletes();
            $table->index('user_id', 'idx_js_creator_assets_user');
            $table->foreign('user_id', 'fk_js_creator_assets_user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('js_creator_fonts', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('family', 80);
            $table->unsignedSmallInteger('weight');
            $table->string('style', 10);
            $table->string('format', 8);
            $table->string('path', 255);
            $table->unsignedBigInteger('size_bytes');
            $table->timestamps();
            $table->softDeletes();
            $table->index('user_id', 'idx_js_creator_fonts_user');
            $table->foreign('user_id', 'fk_js_creator_fonts_user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('js_creator_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('default_quota_mb')->default(1024);
            $table->timestamps();
        });

        Schema::create('js_creator_user_quotas', function (Blueprint $table) {
            $table->unsignedInteger('user_id')->primary();
            $table->unsignedInteger('quota_mb');
            $table->timestamps();
            $table->foreign('user_id', 'fk_js_creator_user_quotas_user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        DB::table('js_creator_settings')->insert(['default_quota_mb' => 1024, 'created_at' => now(), 'updated_at' => now()]);
    }

    /**
     * @description Drops the workspace tables.
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('js_creator_user_quotas');
        Schema::dropIfExists('js_creator_settings');
        Schema::dropIfExists('js_creator_fonts');
        Schema::dropIfExists('js_creator_assets');
        Schema::dropIfExists('js_creator_folders');
    }
};
