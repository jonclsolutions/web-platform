<?php
/**
 * @file __DATE___000000_create___app_snake___logs.php
 * @path app/Apps/__APP__/Database/Migrations/__DATE___000000_create___app_snake___logs.php
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Audit log of the application "__NAME__" (__app_snake___logs, the shape of every
 *   audit log - AuditLogSchema). Its permissions are base data (__APP__BaseDataSeeder).
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
        Schema::create('__app_snake___logs', fn (Blueprint $table) => AuditLogSchema::columns($table, '__app_snake___logs'));
    }

    /**
     * @description Drops the log table.
     */
    public function down(): void
    {
        Schema::dropIfExists('__app_snake___logs');
    }
};
