<?php

/**
 * @file TestSchema.php
 * @path api/tests/Support/TestSchema.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Database schema of the unit/feature tests (SQLite in-memory). Mirrors the
 *   production tables (MariaDB) that the tested code reads and writes - same table names,
 *   columns, defaults, unique keys and foreign keys - built with the Laravel schema
 *   builder so it runs on SQLite.
 * @note Why not the migrations: the production database is maintained through SQL
 *   (database/db.sql + manual ALTER scripts). database/migrations is out of date - it
 *   contains duplicate migrations (two create_roles_table, two create_user_logins_table)
 *   and lacks most core_*, web_*, shop_* and legal_* tables, so `migrate` fails on an
 *   empty database. Keep this file in sync with the production schema whenever a
 *   tested table changes. Tables are added per test round (Core + Auth, Web, Shop; Other
 *   with its tests). The web_project* tables are not in database/db.sql (added
 *   later) - their columns follow the models and controllers.
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
        self::web();
        self::shop();
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
            $t->timestamp('expires_at')->nullable();
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
    }

    /**
     * @description The three audit log tables (core_logs, web_logs, shop_logs) - same shape,
     *   written by the LogsActivity trait.
     * @return void
     */
    private static function logs(): void
    {
        foreach (['core_logs', 'web_logs', 'shop_logs'] as $table) {
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
    }

    /**
     * @description Company details used in e-mail footers (CompanyContactInfo).
     * @return void
     */
    private static function legal(): void
    {
        Schema::create('legal_site_settings', function (Blueprint $t) {
            $t->increments('id');
            $t->string('company_name');
            $t->string('ico', 20);
            $t->string('dic', 20)->nullable();
            $t->string('google_analytics_id', 20)->nullable();
            $t->string('brand_tagline');
            $t->longText('brand_tagline_i18n')->nullable();
            $t->string('copyright_text');
            $t->longText('copyright_text_i18n')->nullable();
            $t->string('contact_email');
            $t->string('contact_phone', 20)->nullable();
            $t->text('address');
            $t->string('footer_text')->nullable();
            $t->string('logo_path')->nullable();
            $t->timestamp('updated_at')->useCurrent();
        });
    }

    /**
     * @description Web section: site settings, public form records (requests, orders, job
     *   applications, tickets), sales leads, news, attachments and the project portal.
     * @return void
     */
    private static function web(): void
    {
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

        // Polymorphic file attachments (requests, orders, tickets, CVs, project messages).
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

        Schema::create('web_support_tickets', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('user_id')->nullable();
            $t->string('user_name_plain');
            $t->string('user_plain');
            $t->string('category', 100);
            $t->string('priority', 50)->nullable()->default('medium');
            $t->string('state', 50)->nullable()->default('new');
            $t->string('subject');
            $t->text('description');
            $t->timestamps();
            $t->timestamp('deleted_at')->nullable();
            $t->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('web_news', function (Blueprint $t) {
            $t->increments('id');
            $t->string('title');
            $t->string('message', 10000);
            $t->string('author');
            $t->string('thema');
            foreach ([1, 2, 3, 4] as $n) {
                $t->string("bullet_{$n}")->nullable();
            }
            $t->timestamps();
            $t->timestamp('deleted_at')->nullable();
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

        Schema::create('web_sales_leads', function (Blueprint $t) {
            $t->increments('id');
            $t->string('public_token', 64)->nullable()->unique();
            $t->timestamp('public_token_used_at')->nullable();
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

        Schema::create('web_sales_orders', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('lead_id')->nullable();
            $t->string('salesman_name')->nullable();
            $t->string('ico', 20)->nullable();
            $t->string('client_name');
            $t->string('client_address', 500)->nullable();
            $t->string('client_phone')->nullable();
            $t->string('client_email')->nullable();
            $t->text('order_description')->nullable();
            $t->boolean('data_processing_agreement')->default(false);
            $t->boolean('tos_agreement')->default(false);
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('updated_at')->useCurrent();
            $t->timestamp('deleted_at')->nullable();
            $t->foreign('lead_id')->references('id')->on('web_sales_leads')->nullOnDelete();
        });

        // Customer project portal (WebProject*), see CheckProjectSession.
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
            $t->string('access_password_hash');
            $t->timestamp('password_generated_at')->nullable();
            $t->timestamps();
            $t->timestamp('deleted_at')->nullable();
            $t->foreign('lead_id')->references('id')->on('web_sales_leads')->nullOnDelete();
            $t->foreign('order_id')->references('id')->on('web_sales_orders')->nullOnDelete();
        });

        Schema::create('web_project_checkpoints', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('project_id');
            $t->string('label');
            $t->string('status', 20)->default('new');
            $t->timestamp('status_changed_at')->nullable();
            $t->integer('sort_order')->default(0);
            $t->timestamps();
            $t->foreign('project_id')->references('id')->on('web_projects')->cascadeOnDelete();
        });

        Schema::create('web_project_sessions', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('project_id');
            $t->string('session_token_hash', 64)->unique();
            $t->timestamp('expires_at');
            $t->timestamp('last_used_at')->nullable();
            $t->string('ip_address', 45)->nullable();
            $t->string('user_agent')->nullable();
            $t->timestamps();
            $t->foreign('project_id')->references('id')->on('web_projects')->cascadeOnDelete();
        });

        Schema::create('web_project_threads', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('project_id');
            $t->string('subject');
            $t->string('priority', 20);
            $t->string('status', 20)->default('active');
            $t->string('opened_by', 20);
            $t->timestamp('last_message_at')->nullable();
            $t->timestamp('customer_last_read_at')->nullable();
            $t->timestamps();
            $t->foreign('project_id')->references('id')->on('web_projects')->cascadeOnDelete();
        });

        Schema::create('web_project_thread_messages', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('thread_id');
            $t->string('author_type', 20);
            $t->string('author_label')->nullable();
            $t->text('body');
            $t->timestamps();
            $t->foreign('thread_id')->references('id')->on('web_project_threads')->cascadeOnDelete();
        });
    }

    /**
     * @description E-shop section (database/db.sql): settings, catalogue (categories,
     *   suppliers, products with prices / variants / images), coupons, customers, payment and
     *   shipping methods, orders with items. Foreign keys with the production ON DELETE
     *   behaviour (order items keep their product: no cascade).
     * @return void
     */
    private static function shop(): void
    {
        Schema::create('shop_site_settings', function (Blueprint $t) {
            $t->increments('id');
            $t->boolean('is_shop_active')->default(true);
            $t->string('maintenance_message')->nullable();
            $t->timestamps();
        });

        Schema::create('shop_categories', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name', 150);
            $t->string('slug', 150);
            $t->text('description')->nullable();
            $t->unsignedInteger('parent_id')->nullable();
            $t->string('image_path')->nullable();
            $t->boolean('is_active')->default(true);
            $t->integer('sort_order')->default(0);
            $t->timestamps();
            $t->unique(['slug', 'parent_id']);
            $t->foreign('parent_id')->references('id')->on('shop_categories');
        });

        Schema::create('shop_suppliers', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name', 200);
            $t->string('ico', 20)->nullable()->unique();
            $t->string('contact_person', 150)->nullable();
            $t->string('email', 100)->nullable();
            $t->string('phone', 20)->nullable();
            $t->string('address')->nullable();
            $t->string('city', 100)->nullable();
            $t->string('postal_code', 10)->nullable();
            $t->string('country', 50)->nullable();
            $t->string('payment_terms', 100)->nullable();
            $t->boolean('is_active')->default(true);
            $t->text('notes')->nullable();
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('shop_products', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('category_id')->nullable();
            $t->unsignedInteger('supplier_id')->nullable();
            $t->string('name', 200);
            $t->string('name_en', 200)->nullable();
            $t->string('slug', 200)->unique();
            $t->text('description')->nullable();
            $t->text('description_en')->nullable();
            $t->string('short_description', 500)->nullable();
            $t->string('short_description_en', 500)->nullable();
            $t->string('sku', 50)->nullable()->unique();
            $t->integer('stock_quantity')->default(0);
            $t->integer('stock_warning_level')->default(10);
            $t->boolean('is_active')->default(true);
            $t->boolean('is_featured')->default(false);
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('category_id')->references('id')->on('shop_categories')->nullOnDelete();
            $t->foreign('supplier_id')->references('id')->on('shop_suppliers')->nullOnDelete();
        });

        Schema::create('shop_product_categories', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedInteger('product_id');
            $t->unsignedInteger('category_id');
            $t->boolean('is_primary')->default(false);
            $t->integer('sort_order')->default(0);
            $t->timestamps();
            $t->unique(['product_id', 'category_id']);
            $t->foreign('product_id')->references('id')->on('shop_products')->cascadeOnDelete();
            $t->foreign('category_id')->references('id')->on('shop_categories')->cascadeOnDelete();
        });

        Schema::create('shop_product_variants', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('product_id');
            $t->string('variant_name', 100);
            $t->string('attribute_1_name', 50)->nullable();
            $t->string('attribute_1_value', 100)->nullable();
            $t->string('attribute_2_name', 50)->nullable();
            $t->string('attribute_2_value', 100)->nullable();
            $t->string('sku_variant', 50)->nullable()->unique();
            $t->integer('stock_quantity')->default(0);
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('product_id')->references('id')->on('shop_products')->cascadeOnDelete();
        });

        Schema::create('shop_product_prices', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedInteger('product_id');
            $t->unsignedInteger('variant_id')->nullable();
            $t->decimal('vat_rate', 5, 2)->default(21);
            $t->decimal('price_eur_without_vat', 10, 2)->nullable();
            $t->decimal('cost_price_eur', 12, 4)->nullable();
            $t->decimal('price_eur_with_vat', 10, 2)->nullable();
            $t->timestamps();
            $t->foreign('product_id')->references('id')->on('shop_products')->cascadeOnDelete();
            $t->foreign('variant_id')->references('id')->on('shop_product_variants')->cascadeOnDelete();
        });

        Schema::create('shop_product_images', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('product_id');
            $t->unsignedInteger('variant_id')->nullable();
            $t->string('image_path');
            $t->string('alt_text', 200)->nullable();
            $t->boolean('is_primary')->default(false);
            $t->integer('sort_order')->default(0);
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('deleted_at')->nullable();
            $t->foreign('product_id')->references('id')->on('shop_products')->cascadeOnDelete();
            $t->foreign('variant_id')->references('id')->on('shop_product_variants')->cascadeOnDelete();
        });

        Schema::create('shop_coupons', function (Blueprint $t) {
            $t->increments('id');
            $t->string('code', 50)->unique();
            $t->string('description')->nullable();
            $t->string('discount_type', 20);
            $t->decimal('discount_value', 10, 2);
            $t->integer('max_usage')->nullable();
            $t->integer('usage_count')->default(0);
            $t->decimal('min_order_amount', 10, 2)->nullable();
            $t->string('applies_to', 50)->default('all');
            $t->dateTime('valid_from')->nullable();
            $t->dateTime('valid_until')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('shop_customers', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('user_id')->nullable();
            $t->string('email', 150)->unique();
            $t->string('first_name', 100);
            $t->string('last_name', 100);
            $t->string('phone', 20)->nullable();
            $t->string('company', 150)->nullable();
            $t->string('address')->nullable();
            $t->string('city', 100)->nullable();
            $t->string('postal_code', 10)->nullable();
            $t->string('country', 50)->nullable();
            $t->boolean('is_active')->default(true);
            $t->decimal('total_spent', 12, 2)->default(0);
            $t->text('notes')->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('shop_payment_methods', function (Blueprint $t) {
            $t->increments('id');
            $t->string('code', 50)->unique();
            $t->string('name', 100);
            $t->string('image_path')->nullable();
            $t->text('description')->nullable();
            $t->decimal('price', 10, 2)->default(0);
            $t->string('provider', 50)->default('manual');
            $t->boolean('is_external')->default(false);
            $t->string('bank_account_number', 50)->nullable();
            $t->string('bank_account_code', 10)->nullable();
            $t->string('bank_iban', 34)->nullable();
            $t->string('bank_swift_bic', 11)->nullable();
            $t->string('variable_symbol_type', 20)->default('order_number');
            $t->longText('config')->default('{}');
            $t->boolean('is_active')->default(true);
            $t->integer('sort_order')->default(0);
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('shop_shipping_methods', function (Blueprint $t) {
            $t->increments('id');
            $t->string('code', 50)->unique();
            $t->string('name', 100);
            $t->text('description')->nullable();
            $t->string('shipping_type', 30)->default('address');
            $t->decimal('base_price', 8, 2)->default(0);
            $t->decimal('free_shipping_threshold', 10, 2)->nullable();
            $t->decimal('max_weight', 8, 2)->nullable();
            $t->boolean('requires_pickup_point')->default(false);
            $t->boolean('allows_cod')->default(false);
            $t->decimal('cod_price', 8, 2)->default(0);
            $t->string('tracking_url')->nullable();
            $t->string('logo_path')->nullable();
            $t->integer('delivery_days_min')->nullable();
            $t->integer('delivery_days_max')->nullable();
            $t->boolean('is_active')->default(true);
            $t->integer('sort_order')->default(0);
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('shop_orders', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('customer_id');
            $t->string('order_number', 50)->unique();
            $t->string('status', 50)->default('pending');
            $t->string('payment_status', 50)->default('pending');
            $t->decimal('total_amount', 10, 2);
            $t->decimal('shipping_amount', 10, 2)->default(0);
            $t->decimal('tax_amount', 10, 2)->default(0);
            $t->decimal('discount_amount', 10, 2)->default(0);
            $t->decimal('final_amount', 10, 2)->default(0);
            $t->unsignedInteger('coupon_id')->nullable();
            $t->unsignedInteger('payment_method_id')->nullable();
            $t->unsignedInteger('shipping_method_id')->nullable();
            $t->string('shipping_address')->nullable();
            $t->string('shipping_city', 100)->nullable();
            $t->string('shipping_postal_code', 10)->nullable();
            $t->string('shipping_country', 50)->nullable();
            $t->text('notes')->nullable();
            $t->dateTime('paid_at')->nullable();
            $t->dateTime('shipped_at')->nullable();
            $t->dateTime('delivered_at')->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('customer_id')->references('id')->on('shop_customers')->cascadeOnDelete();
            $t->foreign('coupon_id')->references('id')->on('shop_coupons')->nullOnDelete();
            $t->foreign('payment_method_id')->references('id')->on('shop_payment_methods')->nullOnDelete();
            $t->foreign('shipping_method_id')->references('id')->on('shop_shipping_methods')->nullOnDelete();
        });

        Schema::create('shop_order_items', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('order_id');
            $t->unsignedInteger('product_id');
            $t->unsignedInteger('product_variant_id')->nullable();
            $t->string('product_name', 200);
            $t->string('variant_name')->nullable();
            $t->integer('quantity');
            $t->decimal('unit_price', 10, 2);
            $t->decimal('total_price', 10, 2);
            $t->decimal('discount_amount', 10, 2)->default(0);
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('updated_at')->useCurrent();
            $t->foreign('order_id')->references('id')->on('shop_orders')->cascadeOnDelete();
            $t->foreign('product_id')->references('id')->on('shop_products');
            $t->foreign('product_variant_id')->references('id')->on('shop_product_variants')->nullOnDelete();
        });
    }
}
