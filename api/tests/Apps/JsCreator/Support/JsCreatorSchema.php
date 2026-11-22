<?php

/**
 * @file JsCreatorSchema.php
 * @path api/tests/Apps/JsCreator/Support/JsCreatorSchema.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test tables of the application "JS Creator" (SQLite mirror of its migrations):
 *   audit log, folders, library images, own fonts, settings, individual quotas, templates and
 *   their usages, outputs and their files - with the same foreign keys (ON DELETE CASCADE from
 *   users and from the parent folder / output, SET NULL from the folder and the template of an
 *   output).
 * @dependencies Tests\Support\TestSchema (audit log shape); run by TestSchema::create() while
 *   the application is in config/apps.php.
 */

namespace Tests\Apps\JsCreator\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\Support\TestSchema;

/**
 * @description Creates the tables of the application in the test database.
 */
final class JsCreatorSchema
{
    /**
     * @description Creates every table of the application.
     * @return void
     */
    public static function create(): void
    {
        TestSchema::auditLog('js_creator_logs');

        Schema::create('js_creator_folders', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id');
            $t->unsignedBigInteger('parent_id')->nullable();
            $t->string('name', 120);
            $t->unsignedBigInteger('trash_root_id')->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $t->foreign('parent_id')->references('id')->on('js_creator_folders')->cascadeOnDelete();
        });

        Schema::create('js_creator_assets', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id');
            $t->string('name', 150);
            $t->string('path', 255);
            $t->string('thumb_path', 255);
            $t->string('mime', 32);
            $t->unsignedInteger('width');
            $t->unsignedInteger('height');
            $t->unsignedBigInteger('size_bytes');
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('js_creator_fonts', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id');
            $t->string('family', 80);
            $t->unsignedSmallInteger('weight');
            $t->string('style', 10);
            $t->string('format', 8);
            $t->string('path', 255);
            $t->unsignedBigInteger('size_bytes');
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('js_creator_settings', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('default_quota_mb')->default(1024);
            $t->timestamps();
        });

        Schema::create('js_creator_user_quotas', function (Blueprint $t) {
            $t->unsignedInteger('user_id')->primary();
            $t->unsignedInteger('quota_mb');
            $t->timestamps();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('js_creator_templates', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id');
            $t->string('section', 20);
            $t->string('name', 120);
            $t->unsignedSmallInteger('width');
            $t->unsignedSmallInteger('height');
            $t->unsignedTinyInteger('schema_version');
            $t->longText('document');
            $t->string('output_format', 4)->default('png');
            $t->unsignedTinyInteger('output_quality')->default(90);
            $t->text('caption_template')->nullable();
            $t->string('thumb_path', 255)->nullable();
            $t->unsignedBigInteger('thumb_bytes')->default(0);
            $t->unsignedInteger('version')->default(1);
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('js_creator_usages', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id');
            $t->string('owner_type', 16);
            $t->unsignedBigInteger('owner_id');
            $t->string('target_type', 16);
            $t->unsignedBigInteger('target_id');
            $t->unique(['owner_type', 'owner_id', 'target_type', 'target_id']);
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('js_creator_outputs', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id');
            $t->unsignedBigInteger('folder_id')->nullable();
            $t->string('section', 20);
            $t->string('name', 150);
            $t->unsignedBigInteger('template_id')->nullable();
            $t->string('template_name', 120);
            $t->text('caption')->nullable();
            $t->unsignedSmallInteger('width');
            $t->unsignedSmallInteger('height');
            $t->string('format', 4);
            $t->unsignedTinyInteger('page_count')->default(1);
            $t->unsignedBigInteger('size_bytes');
            $t->unsignedBigInteger('trash_root_id')->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $t->foreign('folder_id')->references('id')->on('js_creator_folders')->nullOnDelete();
            $t->foreign('template_id')->references('id')->on('js_creator_templates')->nullOnDelete();
        });

        Schema::create('js_creator_output_files', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('output_id');
            $t->unsignedTinyInteger('page');
            $t->string('path', 255);
            $t->string('thumb_path', 255);
            $t->string('mime', 32);
            $t->unsignedBigInteger('size_bytes');
            $t->timestamps();
            $t->unique(['output_id', 'page']);
            $t->foreign('output_id')->references('id')->on('js_creator_outputs')->cascadeOnDelete();
        });
    }
}
