<?php

/**
 * @file 2026_12_01_000000_add_js_creator_favorites_and_preferences.php
 * @path app/Apps/JsCreator/Database/Migrations/2026_12_01_000000_add_js_creator_favorites_and_preferences.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Helpers of everyday work in JS Creator:
 *   - `js_creator_templates.favorite` - the template is starred (shown above the list);
 *   - `js_creator_templates.last_used_at` - last output generated from it (recently used);
 *   - `js_creator_templates.default_folder_id` - folder its outputs go to by default (a folder
 *     deleted for good clears it - ON DELETE SET NULL);
 *   - `js_creator_preferences` - personal settings of an account: brand colours and hashtag sets
 *     (JSON in `payload`, validated by Preferences), one row per account.
 * @note down() drops the table and the three columns.
 * @dependencies users, js_creator_templates, js_creator_folders
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds the template columns and the table of preferences.
     * @return void
     */
    public function up(): void
    {
        Schema::table('js_creator_templates', function (Blueprint $table) {
            $table->boolean('favorite')->default(false)->after('version')->comment('Starred by the owner (shown above the list).');
            $table->timestamp('last_used_at')->nullable()->after('favorite')->comment('Last output generated from the template.');
            $table->unsignedBigInteger('default_folder_id')->nullable()->after('last_used_at')->comment('Default target folder of its outputs.');
            $table->index(['user_id', 'favorite'], 'idx_js_creator_templates_user_favorite');
            $table->foreign('default_folder_id', 'fk_js_creator_templates_default_folder')->references('id')->on('js_creator_folders')->nullOnDelete();
        });
        Schema::create('js_creator_preferences', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id')->unique('uq_js_creator_preferences_user');
            $table->text('payload')->comment('JSON (Preferences): brand colours and hashtag sets.');
            $table->timestamps();
            $table->foreign('user_id', 'fk_js_creator_preferences_user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    /**
     * @description Drops the table and the columns.
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('js_creator_preferences');
        Schema::table('js_creator_templates', function (Blueprint $table) {
            $table->dropForeign('fk_js_creator_templates_default_folder');
            $table->dropIndex('idx_js_creator_templates_user_favorite');
            $table->dropColumn(['favorite', 'last_used_at', 'default_folder_id']);
        });
    }
};
