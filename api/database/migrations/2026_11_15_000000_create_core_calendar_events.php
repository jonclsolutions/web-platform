<?php
/**
 * @file 2026_11_15_000000_create_core_calendar_events.php
 * @path api/database/migrations/2026_11_15_000000_create_core_calendar_events.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Personal events of the admin calendar (core/calendar): own reminders and notes of
 *   one admin - date, optional time, title, optional note, done. Visible only to their owner
 *   (like the personal external links); deleted with the account.
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
        Schema::create('core_calendar_events', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->date('date');
            $table->time('time')->nullable()->comment('null = all day');
            $table->string('title', 150);
            $table->string('note', 1000)->nullable();
            $table->boolean('is_done')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'date']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    /**
     * @description Drops the table.
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('core_calendar_events');
    }
};
