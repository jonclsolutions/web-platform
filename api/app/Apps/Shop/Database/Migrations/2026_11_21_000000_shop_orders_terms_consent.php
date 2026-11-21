<?php
/**
 * @file 2026_11_21_000000_shop_orders_terms_consent.php
 * @path api/app/Apps/Shop/Database/Migrations/2026_11_21_000000_shop_orders_terms_consent.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Consent of the buyer with the terms and conditions stored with the order (audit
 *   U-04): when it was given and which wording of the terms it was (App\Support\Legal\TermsVersion
 *   - last change + SHA-256 of the text), so the accepted wording can be proved.
 * @note Existing orders keep the columns empty (the consent was not stored then).
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds the consent columns.
     * @return void
     */
    public function up(): void
    {
        Schema::table('shop_orders', function (Blueprint $table) {
            $table->dateTime('terms_accepted_at')->nullable()->after('lang')->comment('Consent with the terms and conditions');
            $table->string('terms_version', 40)->nullable()->after('terms_accepted_at')->comment('Last change of the accepted terms (ISO 8601 UTC)');
            $table->char('terms_hash', 64)->nullable()->after('terms_version')->comment('SHA-256 of the accepted terms text');
        });
    }

    /**
     * @description Drops the consent columns.
     * @return void
     */
    public function down(): void
    {
        Schema::table('shop_orders', function (Blueprint $table) {
            $table->dropColumn(['terms_accepted_at', 'terms_version', 'terms_hash']);
        });
    }
};
