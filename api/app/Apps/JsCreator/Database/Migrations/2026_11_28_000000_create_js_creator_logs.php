<?php
/**
 * @file 2026_11_28_000000_create_js_creator_logs.php
 * @path app/Apps/JsCreator/Database/Migrations/2026_11_28_000000_create_js_creator_logs.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the application "JS Creator" (js_creator_logs, the shape of every
 *   audit log - AuditLogSchema). Its permissions are base data (JsCreatorBaseDataSeeder).
 * @dependencies users
 */

use App\Support\Database\AuditLogSchema;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the log table.
     */
    public function up(): void
    {
        Schema::create('js_creator_logs', fn (Blueprint $table) => AuditLogSchema::columns($table, 'js_creator_logs'));
    }

    /**
     * @description Drops the log table.
     */
    public function down(): void
    {
        Schema::dropIfExists('js_creator_logs');
    }
};
