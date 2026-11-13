<?php

/**
 * @file ShopSchema.php
 * @path api/tests/Apps/Shop/Support/ShopSchema.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test tables of the e-shop (SQLite mirror of database/db.sql and its
 *   migrations): settings, catalogue (categories, suppliers, products with prices / variants /
 *   images), coupons, customers, payment and shipping methods, orders with items. Foreign keys
 *   with the production ON DELETE behaviour (order items keep their product: no cascade).
 * @dependencies Tests\Support\TestSchema (audit log shape); run by TestSchema::create() while
 *   the application is in config/apps.php.
 */

namespace Tests\Apps\Shop\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\Support\TestSchema;

/**
 * @description Creates the tables of the application in the test database.
 */
final class ShopSchema
{
    /**
     * @description Creates every table of the application.
     * @return void
     */
    public static function create(): void
    {
        TestSchema::auditLog('shop_logs');

        Schema::create('shop_site_settings', function (Blueprint $t) {
            $t->increments('id');
            $t->boolean('is_shop_active')->default(true);
            $t->string('maintenance_message')->nullable();
            // Confirmation e-mail of an order (migration 2026_11_14_000000_shop_order_confirmation_email).
            foreach (['subject', 'title', 'intro', 'outro', 'labels'] as $field) {
                $t->json("order_email_{$field}_i18n")->nullable();
            }
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
            // Buyer contact snapshot (database/migrations/2026_10_23_shop_orders_vat_contact_retention.sql).
            $t->string('customer_first_name', 100)->nullable();
            $t->string('customer_last_name', 100)->nullable();
            $t->string('customer_email', 150)->nullable();
            $t->string('customer_phone', 20)->nullable();
            $t->string('customer_company', 150)->nullable();
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
            $t->string('lang', 10)->nullable();
            $t->dateTime('paid_at')->nullable();
            $t->dateTime('shipped_at')->nullable();
            $t->dateTime('delivered_at')->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('customer_id')->references('id')->on('shop_customers')->restrictOnDelete();  // orders are kept (finding #22)
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
            $t->decimal('vat_rate', 5, 2)->default(21);  // finding #21
            $t->decimal('discount_amount', 10, 2)->default(0);
            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('updated_at')->useCurrent();
            $t->foreign('order_id')->references('id')->on('shop_orders')->cascadeOnDelete();
            $t->foreign('product_id')->references('id')->on('shop_products');
            $t->foreign('product_variant_id')->references('id')->on('shop_product_variants')->nullOnDelete();
        });
    }
}
