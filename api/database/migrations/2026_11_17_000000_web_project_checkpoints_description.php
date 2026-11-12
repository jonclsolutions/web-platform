<?php
/**
 * @file 2026_11_17_000000_web_project_checkpoints_description.php
 * @path api/database/migrations/2026_11_17_000000_web_project_checkpoints_description.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Description of a project checkpoint (`web_project_checkpoints.description`): what
 *   the checkpoint covers, written by the administration and shown to the client in the project
 *   portal when the checkpoint is expanded. The existing `label` stays the checkpoint's title.
 * @dependencies web_project_checkpoints
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds the nullable description after the title.
     * @return void
     */
    public function up(): void
    {
        Schema::table('web_project_checkpoints', function (Blueprint $table) {
            $table->text('description')->nullable()->after('label');
        });
    }

    /**
     * @description Drops the column again.
     * @return void
     */
    public function down(): void
    {
        Schema::table('web_project_checkpoints', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};
