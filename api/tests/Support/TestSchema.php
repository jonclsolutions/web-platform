<?php

/**
 * @file TestSchema.php
 * @path api/tests/Support/TestSchema.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Database schema of the unit/feature tests (SQLite in-memory). Mirrors the
 *   production tables (MariaDB) that the tested code reads and writes - same table names,
 *   columns, defaults, unique keys and foreign keys - built with the Laravel schema
 *   builder so it runs on SQLite.
 * @note Why not the migrations: the schema is the MariaDB SQL of the baseline migration
 *   (api/database/schema/baseline.sql) plus later Laravel migrations - SQLite cannot load
 *   that SQL. Keep this file in sync with the migrations whenever a tested table changes.
 *   This file holds the tables of the core; every application mirrors its own tables in
 *   tests/Apps/<App>/Support/<App>Schema.php (create()), run here for each application of
 *   config/apps.php - a removed application takes its tables with it.
 */

namespace Tests\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * @description Creates the test schema on the default connection. Called once per test by
 *   Tests\TestCase::setUp() - the in-memory database is new for every test.
 */
final class TestSchema
{
    /**
     * @description Creates every table of the test schema.
     * @return void
     */
    public static function create(): void
    {
        self::auth();
        self::core();
        self::logs();
        self::legal();
        foreach (config('apps.apps', []) as $manifest) {
            $schema = self::applicationSchema((string) $manifest);
            if ($schema !== null && class_exists($schema)) {
                $schema::create();
            }
        }
    }

    /**
     * @description Test schema class of an application: App\Apps\<App>\<Manifest> =>
     *   Tests\Apps\<App>\Support\<App>Schema.
     * @param string $manifest Manifest class of config/apps.php.
     * @return string|null Null for a class outside app/Apps.
     */
    private static function applicationSchema(string $manifest): ?string
    {
        return preg_match('/^App\\\\Apps\\\\(\w+)\\\\\w+$/', $manifest, $match)
            ? "Tests\\Apps\\{$match[1]}\\Support\\{$match[1]}Schema"
            : null;
    }

    /**
     * @description Accounts, roles, permissions and the token tables of the login flow.
     * @return void
     */
    private static function auth(): void
    {
        Schema::create('users', function (Blueprint $t) {
            $t->increments('id');
            $t->string('user_email')->unique();
            $t->string('full_name');
            $t->string('avatar_path')->nullable();
            $t->integer('dpp_hours_spent')->default(0);
            $t->boolean('enable_2fa')->default(false);
            $t->boolean('is_blocked')->default(false);
            $t->timestamp('activated_at')->nullable();
            $t->boolean('two_fa_forced_by_admin')->default(false);
            $t->text('internal_note')->nullable();
            $t->string('user_password_hash')->nullable();
            $t->string('user_password_salt')->nullable();
            $t->dateTime('last_login_at')->nullable();
            $t->dateTime('created_at')->useCurrent();
            $t->dateTime('updated_at')->useCurrent();
            $t->dateTime('deleted_at')->nullable();
            $t->boolean('is_deleted')->default(false);
        });

        Schema::create('core_roles', function (Blueprint $t) {
            $t->increments('id');
            $t->string('role_name', 50)->unique();
            $t->string('description')->nullable();
            $t->boolean('forces_2fa')->default(false);
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('updated_at')->useCurrent();
            $t->timestamp('deleted_at')->nullable();
        });

        Schema::create('core_permissions', function (Blueprint $t) {
            $t->increments('id');
            $t->string('permission_key', 100)->unique();
            $t->string('description')->nullable();
            $t->string('module', 50)->nullable()->default('core');
            $t->timestamp('created_at')->useCurrent();
        });

        Schema::create('core_role_permissions', function (Blueprint $t) {
            $t->unsignedInteger('role_id');
            $t->unsignedInteger('permission_id');
            $t->primary(['role_id', 'permission_id']);
            $t->foreign('role_id')->references('id')->on('core_roles')->cascadeOnDelete();
            $t->foreign('permission_id')->references('id')->on('core_permissions')->cascadeOnDelete();
        });

        Schema::create('user_roles', function (Blueprint $t) {
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('role_id');
            $t->primary(['user_id', 'role_id']);
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $t->foreign('role_id')->references('id')->on('core_roles')->cascadeOnDelete();
        });

        // Explicit per-user grants on top of the role (User::explicitPermissions()).
        Schema::create('user_permissions', function (Blueprint $t) {
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('permission_id');
            $t->unsignedInteger('granted_by')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->primary(['user_id', 'permission_id']);
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $t->foreign('permission_id')->references('id')->on('core_permissions')->cascadeOnDelete();
        });

        // Laravel Sanctum access tokens.
        Schema::create('personal_access_tokens', function (Blueprint $t) {
            $t->id();
            $t->morphs('tokenable');
            $t->string('name');
            $t->string('token', 64)->unique();
            $t->text('abilities')->nullable();
            $t->timestamp('last_used_at')->nullable();
            $t->timestamp('expires_at')->nullable();
            $t->timestamps();
        });

        Schema::create('refresh_tokens', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id');
            $t->string('token', 64)->unique();
            $t->string('family', 64)->nullable()->index();
            $t->timestamp('expires_at')->nullable();
            $t->timestamp('session_expires_at')->nullable();
            $t->boolean('remember')->default(true);
            $t->timestamp('rotated_at')->nullable();
            $t->timestamps();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('two_factor_codes', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id');
            $t->string('login_token_hash', 64)->unique();
            $t->string('code_hash', 64);
            $t->unsignedTinyInteger('attempts')->default(0);
            $t->unsignedTinyInteger('resend_count')->default(0);
            $t->timestamp('expires_at')->useCurrent();
            $t->timestamp('last_sent_at')->useCurrent();
            $t->timestamp('used_at')->nullable();
            $t->string('ip_address', 45)->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('account_activation_tokens', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id')->index();
            $t->string('token_hash', 64)->unique();
            $t->timestamp('expires_at')->useCurrent();
            $t->timestamp('created_at')->nullable()->useCurrent();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('password_reset_tokens', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id');
            $t->string('token_hash', 64)->unique();
            $t->timestamp('expires_at')->useCurrent();
            $t->timestamp('used_at')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    /**
     * @description Core administration: security monitoring, e-mail access policy,
     *   import batches and the personal external links.
     * @return void
     */
    private static function core(): void
    {
        Schema::create('core_security_events', function (Blueprint $t) {
            $t->increments('id');
            $t->char('fingerprint', 64)->unique();
            $t->string('event_type', 50)->index();
            $t->string('severity', 10)->default('warning');
            $t->string('ip_address', 45)->nullable();
            $t->string('user_agent')->nullable();
            $t->string('route')->nullable();
            $t->string('method', 10)->nullable();
            $t->unsignedInteger('user_id')->nullable();
            $t->unsignedInteger('occurrences')->default(1);
            $t->dateTime('first_seen_at');
            $t->dateTime('last_seen_at')->index();
            $t->string('status', 20)->default('new');
            $t->string('notes', 1000)->nullable();
            $t->text('context_data')->nullable();
            $t->dateTime('created_at')->useCurrent();
            $t->dateTime('updated_at')->useCurrent();
            $t->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('core_security_settings', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedSmallInteger('retention_days')->default(90);
            $t->string('primary_email_domain')->nullable();
            $t->dateTime('created_at')->useCurrent();
            $t->dateTime('updated_at')->useCurrent();
        });

        Schema::create('core_retention_settings', function (Blueprint $t) {
            $t->increments('id');
            $t->string('data_key', 50)->unique();
            $t->unsignedInteger('retention_days')->nullable();
            $t->timestamp('last_run_at')->nullable();
            $t->unsignedInteger('last_deleted_count')->nullable();
            $t->timestamps();
        });

        Schema::create('web_cookie_consents', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->char('consent_id', 36)->index();
            $t->unsignedSmallInteger('version');
            $t->boolean('functional');
            $t->boolean('analytics');
            $t->boolean('marketing');
            $t->timestamp('created_at')->useCurrent()->index();
        });

        Schema::create('core_email_access_rules', function (Blueprint $t) {
            $t->increments('id');
            $t->string('type', 10);
            $t->string('value');
            $t->dateTime('created_at')->useCurrent();
            $t->dateTime('updated_at')->useCurrent();
            $t->unique(['type', 'value']);
        });

        Schema::create('core_import_batches', function (Blueprint $t) {
            $t->increments('id');
            $t->string('resource', 100)->index();
            $t->unsignedInteger('user_id')->nullable();
            $t->string('original_filename')->nullable();
            $t->string('format', 10);
            $t->string('temp_path', 500)->nullable();
            $t->string('status', 20)->default('validated')->index();
            $t->unsignedInteger('total_rows')->default(0);
            $t->unsignedInteger('valid_rows')->default(0);
            $t->unsignedInteger('invalid_rows')->default(0);
            $t->unsignedInteger('imported_count')->default(0);
            $t->unsignedInteger('skipped_count')->default(0);
            $t->text('error_summary')->nullable();
            $t->dateTime('created_at')->useCurrent();
            $t->dateTime('updated_at')->useCurrent();
            $t->dateTime('completed_at')->nullable();
            $t->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        // Personal events of the calendar (migration 2026_11_15_000000_create_core_calendar_events).
        Schema::create('core_calendar_events', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('user_id');
            $t->date('date');
            $t->time('time')->nullable();
            $t->string('title', 150);
            $t->string('note', 1000)->nullable();
            $t->boolean('is_done')->default(false);
            $t->timestamps();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
        Schema::create('core_external_links', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('user_id');
            $t->string('name', 150);
            $t->string('url', 500);
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('updated_at')->useCurrent();
            $t->timestamp('deleted_at')->nullable();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('web_attachments', function (Blueprint $t) {
            $t->id();
            $t->string('attachable_type', 191);
            $t->unsignedBigInteger('attachable_id');
            $t->string('disk', 50)->default('public');
            $t->string('path', 500);
            $t->string('original_filename');
            $t->string('mime_type', 150)->nullable();
            $t->unsignedBigInteger('size_bytes')->default(0);
            $t->timestamp('created_at')->nullable();
            $t->index(['attachable_type', 'attachable_id']);
        });
    }

    /**
     * @description The audit log of the core (core_logs).
     * @return void
     */
    private static function logs(): void
    {
        self::auditLog('core_logs');
    }

    /**
     * @description One audit log table - all logs have the same shape (LogsActivity); also used
     *   by the schemas of the applications.
     * @param string $table Table name.
     * @return void
     */
    public static function auditLog(string $table): void
    {
        Schema::create($table, function (Blueprint $t) {
            $t->increments('id');
            $t->dateTime('created_at')->useCurrent();
            $t->string('origin')->nullable();
            $t->string('event_type', 50);
            $t->string('module', 100);
            $t->string('description', 1000);
            $t->string('affected_entity_type', 50)->nullable();
            $t->unsignedBigInteger('affected_entity_id')->nullable();
            $t->unsignedInteger('user_id')->nullable();
            $t->text('context_data')->nullable();
            $t->string('user_id_plain')->nullable();
            $t->string('user_plain')->nullable();
            $t->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * @description Legal / site configuration: company details (also e-mail footers via
     *   CompanyContactInfo), social links, page titles, legal documents (GDPR, TOS, cookies).
     * @return void
     */
    private static function legal(): void
    {
        Schema::create('legal_site_settings', function (Blueprint $t) {
            $t->increments('id');
            $t->string('company_name');
            $t->string('ico', 20)->nullable();
            $t->string('dic', 20)->nullable();
            $t->string('google_analytics_id', 20)->nullable();
            $t->string('brand_tagline')->nullable();
            $t->longText('brand_tagline_i18n')->nullable();
            $t->string('copyright_text')->nullable();
            $t->longText('copyright_text_i18n')->nullable();
            $t->string('contact_email');
            $t->string('contact_phone', 20)->nullable();
            $t->text('address')->nullable();
            $t->string('footer_text')->nullable();
            $t->string('logo_path')->nullable();
            $t->longText('hidden_fields')->nullable();
            $t->timestamp('updated_at')->useCurrent();
        });

        Schema::create('legal_social_links', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name', 50);
            $t->string('url');
            $t->string('icon_path');
            $t->integer('position')->default(0);
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('updated_at')->nullable();
        });

        // Not in database/db.sql (added later) - columns follow the PageTitle model / controller.
        Schema::create('legal_page_titles', function (Blueprint $t) {
            $t->increments('id');
            $t->string('area', 20);
            $t->string('page_key', 100);
            $t->string('route_path')->nullable();
            $t->longText('title_i18n')->nullable();
            $t->integer('sort_order')->default(0);
            $t->timestamp('updated_at')->nullable();
            $t->unique(['area', 'page_key']);
        });

        Schema::create('document_types', function (Blueprint $t) {
            $t->increments('id');
            $t->string('slug', 100)->unique();
            $t->string('title');
            $t->timestamps();
        });

        Schema::create('document_sections', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('document_type_id');
            $t->integer('position')->default(0);
            $t->string('heading')->nullable();
            $t->text('content');
            $t->string('lang', 5)->default('cz');
            $t->timestamps();
            $t->foreign('document_type_id')->references('id')->on('document_types')->cascadeOnDelete();
        });
    }


}
