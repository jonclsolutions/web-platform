<?php
/**
 * @file 2026_11_28_000003_create_js_creator_outputs.php
 * @path app/Apps/JsCreator/Database/Migrations/2026_11_28_000003_create_js_creator_outputs.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Generated outputs of JS Creator (stage 3):
 *   - `js_creator_outputs` - one generated post: folder, section, name, the template it was made
 *     from (its name is kept - the template may be renamed or deleted later), the text of the
 *     post, size and format; trash: `deleted_at` + `trash_root_id` (the folder whose deletion
 *     moved the output to the trash; null = deleted by itself);
 *   - `js_creator_output_files` - the files of an output by page (one page now, carousels later)
 *     with their thumbnails.
 *   Every row belongs to one account: `user_id` → users ON DELETE CASCADE (deleting an account
 *   for good deletes its outputs; the files are removed by the clean-up of
 *   JsCreatorRetentionSource). A deleted folder / template leaves the output (folder → top
 *   level, template → only its kept name).
 * @note down() drops the tables (the files stay until the clean-up).
 * @dependencies users, js_creator_folders, js_creator_templates
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the tables of the outputs and their files.
     * @return void
     */
    public function up(): void
    {
        Schema::create('js_creator_outputs', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->unsignedBigInteger('folder_id')->nullable()->comment('Folder of the output (null = top level).');
            $table->string('section', 20)->comment('Section id (images; videos / gifs later).');
            $table->string('name', 150);
            $table->unsignedBigInteger('template_id')->nullable()->comment('Template it was generated from (null after the template was deleted for good).');
            $table->string('template_name', 120)->comment('Name of the template at the time of generating.');
            $table->text('caption')->nullable()->comment('Text of the post.');
            $table->unsignedSmallInteger('width');
            $table->unsignedSmallInteger('height');
            $table->string('format', 4)->comment('png | jpg.');
            $table->unsignedTinyInteger('page_count')->default(1);
            $table->unsignedBigInteger('size_bytes')->comment('Files and thumbnails (counts towards the quota).');
            $table->unsignedBigInteger('trash_root_id')->nullable()->comment('Folder whose deletion moved the output to the trash (null = deleted by itself).');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['user_id', 'folder_id'], 'idx_js_creator_outputs_user_folder');
            $table->foreign('user_id', 'fk_js_creator_outputs_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('folder_id', 'fk_js_creator_outputs_folder_id')->references('id')->on('js_creator_folders')->nullOnDelete();
            $table->foreign('template_id', 'fk_js_creator_outputs_template_id')->references('id')->on('js_creator_templates')->nullOnDelete();
        });

        Schema::create('js_creator_output_files', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('output_id');
            $table->unsignedTinyInteger('page')->comment('Page of the output (1 = the first).');
            $table->string('path', 255);
            $table->string('thumb_path', 255);
            $table->string('mime', 32);
            $table->unsignedBigInteger('size_bytes')->comment('File + thumbnail.');
            $table->timestamps();
            $table->unique(['output_id', 'page'], 'uq_js_creator_output_files_page');
            $table->foreign('output_id', 'fk_js_creator_output_files_output_id')->references('id')->on('js_creator_outputs')->cascadeOnDelete();
        });
    }

    /**
     * @description Drops the tables of the outputs.
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('js_creator_output_files');
        Schema::dropIfExists('js_creator_outputs');
    }
};
