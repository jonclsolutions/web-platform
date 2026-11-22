<?php
/**
 * @file 2026_11_28_000002_create_js_creator_templates.php
 * @path app/Apps/JsCreator/Database/Migrations/2026_11_28_000002_create_js_creator_templates.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Templates of JS Creator (stage 2):
 *   - `js_creator_templates` - template of one section in one size: the document (JSON of the
 *     editor, schema version), output format, caption pattern, thumbnail and `version` (a save
 *     based on an older version is refused - two browser tabs);
 *   - `js_creator_usages` - what a template uses (library image, own font), so the library
 *     refuses to delete a used file and lists where it is used. Blocks (stage 4) add their own
 *     owner / target type.
 *   Every row belongs to one account: `user_id` → users ON DELETE CASCADE (deleting an account
 *   for good deletes its templates; the thumbnails are removed by the clean-up of
 *   JsCreatorRetentionSource).
 * @note down() drops the tables (thumbnail files stay until the clean-up).
 * @dependencies users
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the tables of templates and usages.
     * @return void
     */
    public function up(): void
    {
        Schema::create('js_creator_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('section', 20)->comment('Section id (images; videos / gifs later).');
            $table->string('name', 120);
            $table->unsignedSmallInteger('width');
            $table->unsignedSmallInteger('height');
            $table->unsignedTinyInteger('schema_version');
            $table->longText('document')->comment('Document of the editor (JSON, validated by TemplateDocument).');
            $table->string('output_format', 4)->default('png');
            $table->unsignedTinyInteger('output_quality')->default(90);
            $table->text('caption_template')->nullable();
            $table->string('thumb_path', 255)->nullable();
            $table->unsignedBigInteger('thumb_bytes')->default(0)->comment('Size of the thumbnail (counts towards the quota).');
            $table->unsignedInteger('version')->default(1)->comment('Raised by every save; a save of an older version is refused (409).');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['user_id', 'section'], 'idx_js_creator_templates_user_section');
            $table->foreign('user_id', 'fk_js_creator_templates_user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('js_creator_usages', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('owner_type', 16)->comment('template (block later).');
            $table->unsignedBigInteger('owner_id');
            $table->string('target_type', 16)->comment('asset | font (block later).');
            $table->unsignedBigInteger('target_id');
            $table->unique(['owner_type', 'owner_id', 'target_type', 'target_id'], 'uq_js_creator_usages');
            $table->index(['target_type', 'target_id'], 'idx_js_creator_usages_target');
            $table->foreign('user_id', 'fk_js_creator_usages_user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    /**
     * @description Drops the tables of templates and usages.
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('js_creator_usages');
        Schema::dropIfExists('js_creator_templates');
    }
};
