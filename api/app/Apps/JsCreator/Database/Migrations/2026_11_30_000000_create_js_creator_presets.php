<?php

/**
 * @file 2026_11_30_000000_create_js_creator_presets.php
 * @path app/Apps/JsCreator/Database/Migrations/2026_11_30_000000_create_js_creator_presets.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Saved fillings of the form of generating ("presets") of JS Creator: texts of the
 *   fields, images of the library chosen for image fields (never photos of the computer), crops
 *   and the text of the post - of one template or of one set of an account.
 *   The values are stored in `payload` (`values` is a reserved word of SQL). Exactly one of
 *   `template_id` / `set_id` is filled; a template or a set deleted for good takes
 *   its presets with it (foreign keys), the account too (user_id). Presets have no trash.
 * @note down() drops the table.
 * @dependencies users, js_creator_templates, js_creator_sets
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the table of presets.
     * @return void
     */
    public function up(): void
    {
        Schema::create('js_creator_presets', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('section', 20)->comment('Section id (images; videos / gifs later).');
            $table->unsignedBigInteger('template_id')->nullable()->comment('Preset of a template (or of a set - set_id).');
            $table->unsignedBigInteger('set_id')->nullable()->comment('Preset of a set (or of a template - template_id).');
            $table->string('name', 120);
            $table->text('payload')->comment('Values as JSON (PresetValues): texts, library images, crops, text of the post.');
            $table->timestamps();
            $table->index(['user_id', 'template_id'], 'idx_js_creator_presets_user_template');
            $table->index(['user_id', 'set_id'], 'idx_js_creator_presets_user_set');
            $table->foreign('user_id', 'fk_js_creator_presets_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('template_id', 'fk_js_creator_presets_template_id')->references('id')->on('js_creator_templates')->cascadeOnDelete();
            $table->foreign('set_id', 'fk_js_creator_presets_set_id')->references('id')->on('js_creator_sets')->cascadeOnDelete();
        });
    }

    /**
     * @description Drops the table.
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('js_creator_presets');
    }
};
