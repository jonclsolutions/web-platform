<?php
/**
 * @file AuditLogSchema.php
 * @path app/Support/Database/AuditLogSchema.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Columns of an audit log table (the shape of AuditLog: core_logs and the log of
 *   every application) - one definition for the migration of a new application and the test
 *   schema, so a new log never drifts from the shared controller / resource / LogsActivity.
 * @usage `Schema::create('blog_logs', fn (Blueprint $t) => AuditLogSchema::columns($t, 'blog_logs'));`
 * @dependencies users (foreign key of the author).
 */

namespace App\Support\Database;

use Illuminate\Database\Schema\Blueprint;

final class AuditLogSchema
{
    /**
     * @description Adds the columns of an audit log.
     * @param Blueprint $table Table being created.
     * @param string $name Table name (name of the foreign key).
     * @return void
     */
    public static function columns(Blueprint $table, string $name): void
    {
        $table->increments('id');
        $table->dateTime('created_at')->useCurrent();
        $table->string('origin')->nullable();
        $table->string('event_type', 50);
        $table->string('module', 100);
        $table->string('description', 1000);
        $table->string('affected_entity_type', 50)->nullable();
        $table->unsignedBigInteger('affected_entity_id')->nullable();
        $table->unsignedInteger('user_id')->nullable();
        $table->text('context_data')->nullable();
        $table->string('user_id_plain')->nullable();
        $table->string('user_plain')->nullable();
        $table->foreign('user_id', "fk_{$name}_user_id")->references('id')->on('users')->nullOnDelete();
    }
}
