<?php

/**
 * @file ProjectPortalSchema.php
 * @path api/tests/Apps/ProjectPortal/Support/ProjectPortalSchema.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test tables of the project portal (SQLite mirror of its migrations):
 *   settings, sales leads and orders, projects, checkpoints, client accounts, sessions, threads
 *   and messages, sign-in codes, updates, approvals and templates.
 * @dependencies Tests\Support\TestSchema (audit log shape); run by TestSchema::create() while
 *   the application is in config/apps.php.
 */

namespace Tests\Apps\ProjectPortal\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\Support\TestSchema;

/**
 * @description Creates the tables of the application in the test database.
 */
final class ProjectPortalSchema
{
    /**
     * @description Creates every table of the application.
     * @return void
     */
    public static function create(): void
    {
        TestSchema::auditLog('project_portal_logs');

        Schema::create('project_portal_settings', function (Blueprint $t) {
            $t->increments('id');
            foreach (['subject', 'title', 'intro', 'outro', 'labels'] as $column) {
                $t->json("sales_order_email_{$column}_i18n")->nullable();
            }
            $t->timestamps();
        });

        Schema::create('project_portal_sales_leads', function (Blueprint $t) {
            $t->increments('id');
            $t->string('public_token', 64)->nullable()->unique();
            $t->timestamp('public_token_used_at')->nullable();
            $t->timestamp('public_token_expires_at')->nullable();
            $t->unsignedInteger('user_id')->nullable();
            $t->string('salesman_name');
            $t->date('first_contact_date')->nullable();
            $t->string('subject_name');
            $t->string('contact_person')->nullable();
            $t->string('location', 100)->nullable();
            $t->string('source_channel');
            $t->string('source_url', 500)->nullable();
            $t->text('description')->nullable();
            $t->string('priority')->nullable()->default('neutral');
            $t->string('status')->nullable()->default('new');
            $t->date('last_contact_date')->nullable();
            $t->string('next_step')->nullable();
            $t->text('rejection_reason')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('updated_at')->useCurrent();
            $t->timestamp('deleted_at')->nullable();
            $t->string('contact_email')->nullable();
            $t->string('contact_phone')->nullable();
            $t->string('contact_other')->nullable();
            $t->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('project_portal_sales_orders', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('lead_id')->nullable();
            $t->string('salesman_name')->nullable();
            $t->string('ico', 20)->nullable();
            $t->string('client_name');
            $t->string('client_address', 500)->nullable();
            $t->string('client_phone')->nullable();
            $t->string('client_email')->nullable();
            $t->string('lang', 5)->nullable();
            $t->text('order_description')->nullable();
            $t->boolean('data_processing_agreement')->default(false);
            $t->boolean('tos_agreement')->default(false);
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('updated_at')->useCurrent();
            $t->timestamp('deleted_at')->nullable();
            $t->foreign('lead_id')->references('id')->on('project_portal_sales_leads')->nullOnDelete();
        });

        Schema::create('web_projects', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('lead_id')->nullable();
            $t->unsignedInteger('order_id')->nullable()->unique();
            $t->string('name');
            $t->text('description')->nullable();
            $t->string('platform', 100)->nullable();
            $t->string('project_lead')->nullable();
            $t->string('contact_phone')->nullable();
            $t->string('contact_email')->nullable();
            $t->text('technologies')->nullable();
            $t->date('estimated_completion_from')->nullable();
            $t->date('estimated_completion_to')->nullable();
            $t->string('visibility', 20)->default('private');
            $t->string('status', 20)->default('new');
            $t->string('access_token', 64)->unique();
            // Responsible administrator (migration 2026_11_18_000000_web_project_portal_accounts).
            $t->unsignedInteger('assignee_id')->nullable();
            $t->timestamps();
            $t->timestamp('deleted_at')->nullable();
            $t->foreign('assignee_id')->references('id')->on('users')->nullOnDelete();
            $t->foreign('lead_id')->references('id')->on('project_portal_sales_leads')->nullOnDelete();
            $t->foreign('order_id')->references('id')->on('project_portal_sales_orders')->nullOnDelete();
        });

        Schema::create('web_project_checkpoints', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('project_id');
            $t->string('label');
            $t->text('description')->nullable();
            $t->date('due_date')->nullable();
            $t->text('internal_note')->nullable();
            $t->string('status', 20)->default('new');
            $t->timestamp('status_changed_at')->nullable();
            $t->integer('sort_order')->default(0);
            $t->timestamps();
            $t->foreign('project_id')->references('id')->on('web_projects')->cascadeOnDelete();
        });

        // Client accounts of the portal (migration 2026_11_18_000000_web_project_portal_accounts).

        Schema::create('web_project_accounts', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('project_id');
            $t->string('username', 64);
            $t->string('display_name', 120);
            $t->string('email')->nullable();
            $t->timestamp('email_verified_at')->nullable();
            // Notification switches of migrations 2026_11_19_000000_web_project_account_notifications
            // and 2026_11_20_000000_web_project_portal_phase2.
            $t->boolean('notify_replies')->default(false);
            $t->boolean('notify_checkpoint_status')->default(false);
            $t->boolean('notify_checkpoint_dates')->default(false);
            $t->boolean('notify_updates')->default(false);
            $t->boolean('notify_approvals')->default(false);
            $t->string('language', 5)->default('cz');
            $t->string('password_hash')->nullable();
            $t->timestamp('password_set_at')->nullable();
            $t->timestamp('invited_at')->nullable();
            $t->timestamp('last_login_at')->nullable();
            $t->timestamp('news_seen_at')->nullable();
            $t->timestamps();
            $t->unique(['project_id', 'username']);
            $t->foreign('project_id')->references('id')->on('web_projects')->cascadeOnDelete();
        });

        Schema::create('web_project_sessions', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('project_id');
            $t->unsignedInteger('account_id');
            $t->string('session_token_hash', 64)->unique();
            $t->timestamp('expires_at');
            $t->timestamp('last_used_at')->nullable();
            $t->string('ip_address', 45)->nullable();
            $t->string('user_agent')->nullable();
            $t->timestamps();
            $t->foreign('project_id')->references('id')->on('web_projects')->cascadeOnDelete();
            $t->foreign('account_id')->references('id')->on('web_project_accounts')->cascadeOnDelete();
        });

        Schema::create('web_project_threads', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('project_id');
            $t->string('subject');
            $t->string('priority', 20);
            $t->string('status', 20)->default('active');
            $t->unsignedInteger('assignee_id')->nullable();
            $t->string('opened_by', 20);
            $t->string('last_public_author', 20)->nullable();
            $t->timestamp('last_message_at')->nullable();
            $t->timestamp('customer_last_read_at')->nullable();
            $t->timestamp('admin_last_read_at')->nullable();
            $t->timestamps();
            $t->foreign('project_id')->references('id')->on('web_projects')->cascadeOnDelete();
        });

        Schema::create('web_project_thread_messages', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('thread_id');
            $t->string('author_type', 20);
            $t->string('author_label')->nullable();
            $t->unsignedInteger('account_id')->nullable();
            $t->unsignedInteger('user_id')->nullable();
            $t->boolean('is_internal')->default(false);
            $t->text('body');
            $t->timestamps();
            $t->foreign('thread_id')->references('id')->on('web_project_threads')->cascadeOnDelete();
            $t->foreign('account_id')->references('id')->on('web_project_accounts')->nullOnDelete();
            $t->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        // Phase 2 of the client portal (migration 2026_11_20_000000_web_project_portal_phase2).

        Schema::create('web_project_login_codes', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('account_id');
            $t->string('purpose', 16);
            $t->string('code_hash', 64)->nullable();
            $t->string('link_hash', 64)->unique();
            $t->unsignedTinyInteger('attempts')->default(0);
            $t->timestamp('expires_at');
            $t->timestamp('used_at')->nullable();
            $t->string('created_ip', 45)->nullable();
            $t->timestamps();
            $t->foreign('account_id')->references('id')->on('web_project_accounts')->cascadeOnDelete();
        });

        Schema::create('web_project_updates', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('project_id');
            $t->string('title', 200);
            $t->text('body');
            $t->unsignedInteger('author_id')->nullable();
            $t->string('author_label', 120)->nullable();
            $t->timestamp('published_at')->nullable();
            $t->timestamp('first_published_at')->nullable();
            $t->timestamps();
            $t->foreign('project_id')->references('id')->on('web_projects')->cascadeOnDelete();
            $t->foreign('author_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('web_project_approvals', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('project_id');
            $t->unsignedInteger('checkpoint_id')->nullable();
            $t->string('title', 200);
            $t->text('description')->nullable();
            $t->string('status', 20)->default('pending');
            $t->date('due_date')->nullable();
            $t->unsignedInteger('requested_by')->nullable();
            $t->string('requested_by_label', 120)->nullable();
            $t->timestamp('requested_at')->nullable();
            $t->timestamp('decided_at')->nullable();
            $t->timestamps();
            $t->foreign('project_id')->references('id')->on('web_projects')->cascadeOnDelete();
            $t->foreign('checkpoint_id')->references('id')->on('web_project_checkpoints')->nullOnDelete();
            $t->foreign('requested_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('web_project_approval_decisions', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('approval_id');
            $t->string('decision', 20);
            $t->text('comment')->nullable();
            $t->unsignedInteger('account_id')->nullable();
            $t->string('author_label', 120)->nullable();
            $t->timestamp('created_at')->nullable();
            $t->foreign('approval_id')->references('id')->on('web_project_approvals')->cascadeOnDelete();
            $t->foreign('account_id')->references('id')->on('web_project_accounts')->nullOnDelete();
        });

        Schema::create('web_project_templates', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name', 160);
            $t->text('description')->nullable();
            $t->timestamps();
        });

        Schema::create('web_project_template_checkpoints', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('template_id');
            $t->string('label');
            $t->text('description')->nullable();
            $t->unsignedSmallInteger('offset_days')->nullable();
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();
            $t->foreign('template_id')->references('id')->on('web_project_templates')->cascadeOnDelete();
        });
    }
}
