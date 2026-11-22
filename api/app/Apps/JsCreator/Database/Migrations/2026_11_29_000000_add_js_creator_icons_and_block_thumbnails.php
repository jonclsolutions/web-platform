<?php

/**
 * @file 2026_11_29_000000_add_js_creator_icons_and_block_thumbnails.php
 * @path app/Apps/JsCreator/Database/Migrations/2026_11_29_000000_add_js_creator_icons_and_block_thumbnails.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Own icons and redrawn block thumbnails of JS Creator:
 *   - `js_creator_assets.kind` - an image of the library (`image`) or an own icon (`icon`, PNG /
 *     JPG uploaded on the tab Icons); both are used by templates the same way (image layers);
 *   - `js_creator_blocks.thumb_stale` - the thumbnail has to be drawn again (an imported block
 *     has none yet; the list of blocks draws it).
 * @note down() drops both columns (icons become images of the library).
 * @dependencies js_creator_assets, js_creator_blocks
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds the kind of library files and the stale flag of block thumbnails.
     * @return void
     */
    public function up(): void
    {
        Schema::table('js_creator_assets', function (Blueprint $table) {
            $table->string('kind', 10)->default('image')->after('user_id')->comment('image = image of the library, icon = own icon (PNG / JPG).');
            $table->index(['user_id', 'kind'], 'idx_js_creator_assets_user_kind');
        });
        Schema::table('js_creator_blocks', function (Blueprint $table) {
            $table->boolean('thumb_stale')->default(false)->after('thumb_bytes')->comment('The thumbnail has to be drawn again (imported block).');
        });
    }

    /**
     * @description Drops both columns.
     * @return void
     */
    public function down(): void
    {
        Schema::table('js_creator_assets', function (Blueprint $table) {
            $table->dropIndex('idx_js_creator_assets_user_kind');
            $table->dropColumn('kind');
        });
        Schema::table('js_creator_blocks', function (Blueprint $table) {
            $table->dropColumn('thumb_stale');
        });
    }
};
