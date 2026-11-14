<?php

/**
 * @file WebSchema.php
 * @path api/tests/Apps/Web/Support/WebSchema.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test tables of the web application (SQLite mirror of its migrations):
 *   site settings, FAQ, jobs, references and public form records (inquiries, job applications).
 * @dependencies Tests\Support\TestSchema (audit log shape); run by TestSchema::create() while
 *   the application is in config/apps.php.
 */

namespace Tests\Apps\Web\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\Support\TestSchema;

/**
 * @description Creates the tables of the application in the test database.
 */
final class WebSchema
{
    /**
     * @description Creates every table of the application.
     * @return void
     */
    public static function create(): void
    {
        TestSchema::auditLog('web_logs');

        // FAQ and open positions (migration 2026_11_11_000000_create_web_faq_and_jobs).
        Schema::create('web_faq_categories', function (Blueprint $t) {
            $t->id();
            $t->json('name_i18n')->nullable();
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('web_faq_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('category_id')->constrained('web_faq_categories')->cascadeOnDelete();
            $t->json('question_i18n')->nullable();
            $t->json('answer_i18n')->nullable();
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('web_jobs', function (Blueprint $t) {
            $t->id();
            $t->string('slug', 80)->unique();
            foreach (['title', 'summary', 'type', 'location'] as $field) {
                $t->json("{$field}_i18n")->nullable();
            }
            $t->boolean('is_active')->default(true);
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('web_job_sections', function (Blueprint $t) {
            $t->id();
            $t->foreignId('job_id')->constrained('web_jobs')->cascadeOnDelete();
            $t->json('heading_i18n')->nullable();
            $t->json('body_i18n')->nullable();
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });
        // References (migrations 2026_11_12_000000_create_web_references,
        // 2026_11_13_000000_web_references_category_text).

        Schema::create('web_references', function (Blueprint $t) {
            $t->id();
            $t->json('category_i18n')->nullable();
            $t->string('duration', 50)->nullable();
            $t->string('client', 150)->nullable();
            foreach (['name', 'size', 'role', 'description', 'result'] as $field) {
                $t->json("{$field}_i18n")->nullable();
            }
            $t->string('image_path')->nullable();
            $t->boolean('is_active')->default(true);
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('web_reference_features', function (Blueprint $t) {
            $t->id();
            $t->foreignId('reference_id')->constrained('web_references')->cascadeOnDelete();
            $t->json('text_i18n')->nullable();
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('web_reference_stack', function (Blueprint $t) {
            $t->id();
            $t->foreignId('reference_id')->constrained('web_references')->cascadeOnDelete();
            $t->json('label_i18n')->nullable();
            $t->json('value_i18n')->nullable();
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('web_site_settings', function (Blueprint $t) {
            $t->increments('id');
            $t->boolean('is_web_active')->default(true);
            $t->string('web_maintenance_message', 500)->nullable();
            $t->timestamp('created_at')->nullable()->useCurrent();
            $t->timestamp('updated_at')->nullable()->useCurrent();
            foreach (['title', 'intro', 'outro', 'labels', 'subject'] as $part) {
                $t->longText("raw_request_email_{$part}_i18n")->nullable();
            }
        });

        Schema::create('web_raw_request_commissions', function (Blueprint $t) {
            $t->id();
            $t->string('thema');
            $t->string('contact_email');
            $t->string('contact_phone')->nullable();
            $t->text('order_description');
            $t->string('status')->default('new');
            $t->string('priority')->default('neutral');
            $t->timestamps();
            $t->timestamp('deleted_at')->nullable();
            $t->text('note')->nullable();
            $t->string('lang', 5)->default('cz');
        });

        Schema::create('web_job_applications', function (Blueprint $t) {
            $t->id();
            $t->string('first_name', 100);
            $t->string('last_name', 100);
            $t->string('email', 150);
            $t->string('phone', 30)->nullable();
            $t->string('position_name', 150);
            $t->text('message')->nullable();
            $t->string('cv_path')->nullable();
            $t->string('cv_original_name')->nullable();
            $t->string('state', 50)->nullable()->default('new');
            $t->text('internal_note')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('updated_at')->useCurrent();
            $t->timestamp('deleted_at')->nullable();
        });

    }
}
