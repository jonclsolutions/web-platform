<?php
/**
 * @file 2026_11_20_000000_web_project_portal_phase2.php
 * @path api/database/migrations/2026_11_20_000000_web_project_portal_phase2.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Client project portal, phase 2:
 *   - personal access by invitation: `web_project_login_codes` (one-time sign-in codes and links
 *     sent by e-mail - invitation, "send me a code"); accounts get `invited_at`,
 *     `email_verified_at` (the e-mail proved by a code / link) and `news_seen_at` ("what is new
 *     since your last visit"); the password becomes optional (an invited account may have none);
 *   - updates from the supplier: `web_project_updates` (title, text, files; draft / published);
 *   - approvals: `web_project_approvals` (title, description, files, optional checkpoint, due date,
 *     state) with the history of decisions `web_project_approval_decisions`;
 *   - thread assignment: `web_project_threads.assignee_id`;
 *   - project templates: `web_project_templates` + `web_project_template_checkpoints`;
 *   - new notification switches of the client: `notify_updates`, `notify_approvals`.
 * @dependencies web_projects, web_project_accounts, web_project_threads, web_project_checkpoints, users
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the tables and columns of phase 2.
     * @return void
     */
    public function up(): void
    {
        Schema::table('web_project_accounts', function (Blueprint $table) {
            $table->string('password_hash')->nullable()->change();
            $table->boolean('notify_updates')->default(false)->after('notify_checkpoint_dates');
            $table->boolean('notify_approvals')->default(false)->after('notify_updates');
            $table->timestamp('email_verified_at')->nullable()->after('email');
            $table->timestamp('invited_at')->nullable()->after('password_set_at');
            $table->timestamp('news_seen_at')->nullable()->after('last_login_at');
        });

        Schema::create('web_project_login_codes', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('account_id');
            $table->string('purpose', 16);
            $table->string('code_hash', 64)->nullable();
            $table->string('link_hash', 64)->unique();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->string('created_ip', 45)->nullable();
            $table->timestamps();
            $table->index(['account_id', 'used_at'], 'idx_web_project_login_codes_account');
            $table->foreign('account_id', 'fk_web_project_login_codes_account_id')
                ->references('id')->on('web_project_accounts')->cascadeOnDelete();
        });

        Schema::create('web_project_updates', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('project_id');
            $table->string('title', 200);
            $table->text('body');
            $table->unsignedInteger('author_id')->nullable();
            $table->string('author_label', 120)->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('first_published_at')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'published_at'], 'idx_web_project_updates_published');
            $table->foreign('project_id', 'fk_web_project_updates_project_id')
                ->references('id')->on('web_projects')->cascadeOnDelete();
            $table->foreign('author_id', 'fk_web_project_updates_author_id')
                ->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('web_project_approvals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('project_id');
            $table->unsignedInteger('checkpoint_id')->nullable();
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->string('status', 20)->default('pending');
            $table->date('due_date')->nullable();
            $table->unsignedInteger('requested_by')->nullable();
            $table->string('requested_by_label', 120)->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'status'], 'idx_web_project_approvals_status');
            $table->foreign('project_id', 'fk_web_project_approvals_project_id')
                ->references('id')->on('web_projects')->cascadeOnDelete();
            $table->foreign('checkpoint_id', 'fk_web_project_approvals_checkpoint_id')
                ->references('id')->on('web_project_checkpoints')->nullOnDelete();
            $table->foreign('requested_by', 'fk_web_project_approvals_requested_by')
                ->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('web_project_approval_decisions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('approval_id');
            $table->string('decision', 20);
            $table->text('comment')->nullable();
            $table->unsignedInteger('account_id')->nullable();
            $table->string('author_label', 120)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->foreign('approval_id', 'fk_web_project_approval_decisions_approval_id')
                ->references('id')->on('web_project_approvals')->cascadeOnDelete();
            $table->foreign('account_id', 'fk_web_project_approval_decisions_account_id')
                ->references('id')->on('web_project_accounts')->nullOnDelete();
        });

        Schema::table('web_project_threads', function (Blueprint $table) {
            $table->unsignedInteger('assignee_id')->nullable()->after('status');
            $table->foreign('assignee_id', 'fk_web_project_threads_assignee_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('web_project_templates', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name', 160);
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('web_project_template_checkpoints', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('template_id');
            $table->string('label');
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('offset_days')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->foreign('template_id', 'fk_web_project_template_checkpoints_template_id')
                ->references('id')->on('web_project_templates')->cascadeOnDelete();
        });
    }

    /**
     * @description Drops everything of phase 2 (accounts without a password get an unusable one).
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('web_project_template_checkpoints');
        Schema::dropIfExists('web_project_templates');

        Schema::table('web_project_threads', function (Blueprint $table) {
            $table->dropForeign('fk_web_project_threads_assignee_id');
            $table->dropColumn('assignee_id');
        });

        Schema::dropIfExists('web_project_approval_decisions');
        Schema::dropIfExists('web_project_approvals');
        Schema::dropIfExists('web_project_updates');
        Schema::dropIfExists('web_project_login_codes');

        \Illuminate\Support\Facades\DB::table('web_project_accounts')->whereNull('password_hash')->update(['password_hash' => '']);
        Schema::table('web_project_accounts', function (Blueprint $table) {
            $table->dropColumn(['notify_updates', 'notify_approvals', 'email_verified_at', 'invited_at', 'news_seen_at']);
            $table->string('password_hash')->nullable(false)->change();
        });
    }
};
