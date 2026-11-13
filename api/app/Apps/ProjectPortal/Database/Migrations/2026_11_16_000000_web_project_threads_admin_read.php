<?php
/**
 * @file 2026_11_16_000000_web_project_threads_admin_read.php
 * @path api/app/Apps/ProjectPortal/Database/Migrations/2026_11_16_000000_web_project_threads_admin_read.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description When the administration last read a client portal thread
 *   (`web_project_threads.admin_last_read_at`): messages of the client written after it are "new"
 *   for the admin - the projects table and the project page show them (unread badges). Set when an
 *   admin opens the thread or replies; shared by all admins (one team inbox).
 * @note Existing threads are marked read up to their last message - after the deploy nothing old
 *   shows up as new.
 * @dependencies web_project_threads
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds the column and marks the existing threads read.
     * @return void
     */
    public function up(): void
    {
        Schema::table('web_project_threads', function (Blueprint $table) {
            $table->timestamp('admin_last_read_at')->nullable()->after('customer_last_read_at');
        });

        DB::table('web_project_threads')->update(['admin_last_read_at' => DB::raw('COALESCE(last_message_at, created_at)')]);
    }

    /**
     * @description Drops the column again.
     * @return void
     */
    public function down(): void
    {
        Schema::table('web_project_threads', function (Blueprint $table) {
            $table->dropColumn('admin_last_read_at');
        });
    }
};
