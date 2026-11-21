<?php

/**
 * @file JsCreatorSchema.php
 * @path api/tests/Apps/JsCreator/Support/JsCreatorSchema.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test tables of the application "JS Creator" (SQLite mirror of its migrations):
 *   audit log, folders, library images, own fonts, settings and individual quotas - with the
 *   same foreign keys (ON DELETE CASCADE from users and from the parent folder).
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
    }
}
