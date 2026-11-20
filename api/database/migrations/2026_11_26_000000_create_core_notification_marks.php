<?php
/**
 * @file 2026_11_26_000000_create_core_notification_marks.php
 * @path api/database/migrations/2026_11_26_000000_create_core_notification_marks.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notification marks of the administration (core/notifications): when one admin
 *   last looked at one kind of records (new inquiries, orders …) - the numbers in the side menu
 *   count only what came after it. One row per account and kind; deleted with the account.
 * @dependencies users
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the table.
     * @return void
     */
    public function up(): void
    {
        Schema::create('core_notification_marks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->string('kind', 64)->comment('Kind of records, e.g. web_inquiries (NotificationSource)');
            $table->timestamp('seen_at')->comment('Last look at the kind - newer records are unread');
            $table->unique(['user_id', 'kind']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    /**
     * @description Drops the table.
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('core_notification_marks');
    }
};
