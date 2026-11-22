<?php

/**
 * @file 2026_11_28_000004_create_js_creator_blocks_and_sets.php
 * @path app/Apps/JsCreator/Database/Migrations/2026_11_28_000004_create_js_creator_blocks_and_sets.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Blocks and sets of JS Creator (stage 4):
 *   - `js_creator_blocks` - reusable group of layers of one section (own canvas size, document of
 *     the editor without block layers, thumbnail, `version` against two tabs); a template uses
 *     it through block instances, so a change of the block shows in every template;
 *   - `js_creator_sets` - named group of templates of one section in different sizes with an
 *     optional caption pattern; one filling of the fields generates one output per template;
 *   - `js_creator_set_templates` - templates of a set in their order (a template deleted for good
 *     leaves its sets: ON DELETE CASCADE);
 *   - `js_creator_templates.thumb_stale` - a block used by the template changed after the
 *     thumbnail was drawn (the list of templates draws it again).
 *   Every row belongs to one account: `user_id` → users ON DELETE CASCADE (deleting an account
 *   for good deletes its blocks and sets; the thumbnails are removed by the clean-up of
 *   JsCreatorRetentionSource).
 * @note down() drops the tables and the column (thumbnail files stay until the clean-up).
 * @dependencies users, js_creator_templates
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the tables of blocks and sets and the stale flag of template thumbnails.
     * @return void
     */
    public function up(): void
    {
        Schema::create('js_creator_blocks', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('section', 20)->comment('Section id (images; videos / gifs later).');
            $table->string('name', 120);
            $table->unsignedSmallInteger('width');
            $table->unsignedSmallInteger('height');
            $table->unsignedTinyInteger('schema_version');
            $table->longText('document')->comment('Document of the editor (JSON, validated by TemplateDocument, no block layers).');
            $table->string('thumb_path', 255)->nullable();
            $table->unsignedBigInteger('thumb_bytes')->default(0)->comment('Size of the thumbnail (counts towards the quota).');
            $table->unsignedInteger('version')->default(1)->comment('Raised by every save; a save of an older version is refused (409).');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['user_id', 'section'], 'idx_js_creator_blocks_user_section');
            $table->foreign('user_id', 'fk_js_creator_blocks_user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('js_creator_sets', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('section', 20)->comment('Section id (images; videos / gifs later).');
            $table->string('name', 120);
            $table->text('caption_template')->nullable()->comment('Caption pattern of the set (null = the pattern of the first template).');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['user_id', 'section'], 'idx_js_creator_sets_user_section');
            $table->foreign('user_id', 'fk_js_creator_sets_user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('js_creator_set_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('set_id');
            $table->unsignedBigInteger('template_id');
            $table->unsignedSmallInteger('position');
            $table->unique(['set_id', 'template_id'], 'uq_js_creator_set_templates');
            $table->index('template_id', 'idx_js_creator_set_templates_template');
            $table->foreign('set_id', 'fk_js_creator_set_templates_set_id')->references('id')->on('js_creator_sets')->cascadeOnDelete();
            $table->foreign('template_id', 'fk_js_creator_set_templates_template_id')->references('id')->on('js_creator_templates')->cascadeOnDelete();
        });

        Schema::table('js_creator_templates', function (Blueprint $table) {
            $table->boolean('thumb_stale')->default(false)->after('thumb_bytes')
                ->comment('A block of the template changed after the thumbnail was drawn.');
        });
    }

    /**
     * @description Drops the tables of blocks and sets and the stale flag.
     * @return void
     */
    public function down(): void
    {
        Schema::table('js_creator_templates', function (Blueprint $table) {
            $table->dropColumn('thumb_stale');
        });
        Schema::dropIfExists('js_creator_set_templates');
        Schema::dropIfExists('js_creator_sets');
        Schema::dropIfExists('js_creator_blocks');
    }
};
