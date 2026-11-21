<?php
/**
 * @file 2026_11_21_000002_shop_shipping_countries.php
 * @path api/app/Apps/Shop/Database/Migrations/2026_11_21_000002_shop_shipping_countries.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Countries a shipping method delivers to (audit U-02) - ticked in the admin; the
 *   checkout offers only these countries and per country only the methods that deliver there.
 * @note Existing methods get Czechia (the only country of the checkout until now), so nothing
 *   changes for the customers until the admin ticks more countries.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds the column and sets Czechia to the existing methods.
     * @return void
     */
    public function up(): void
    {
        Schema::table('shop_shipping_methods', function (Blueprint $table) {
            $table->json('countries')->nullable()->after('shipping_type')->comment('ISO codes of the countries the method delivers to');
        });
        DB::table('shop_shipping_methods')->update(['countries' => json_encode(['CZ'])]);
    }

    /**
     * @description Drops the column.
     * @return void
     */
    public function down(): void
    {
        Schema::table('shop_shipping_methods', function (Blueprint $table) {
            $table->dropColumn('countries');
        });
    }
};
