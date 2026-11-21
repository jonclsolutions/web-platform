<?php
/**
 * @file 2026_11_21_000001_shop_company_ids.php
 * @path api/app/Apps/Shop/Database/Migrations/2026_11_21_000001_shop_company_ids.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Buying on a company in the e-shop (audit U-03): the company ID (IČO) and VAT ID
 *   (DIČ) of the buyer - on the order (snapshot of the order, as the other contact columns) and on
 *   the customer; the Czech label of the order confirmation e-mail for them.
 * @note Existing rows keep the columns empty. The label is added to the stored Czech labels of
 *   the e-mail only when missing - an edit of the admin is never overwritten.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @description Czech label of the IČO / DIČ row of the confirmation e-mail. */
    private const LABEL = ['label_company_ids' => 'IČO / DIČ'];

    /**
     * @description Adds the columns and the Czech e-mail label.
     * @return void
     */
    public function up(): void
    {
        Schema::table('shop_orders', function (Blueprint $table) {
            $table->string('customer_ico', 20)->nullable()->after('customer_company')->comment('Company ID of the buyer (snapshot)');
            $table->string('customer_dic', 20)->nullable()->after('customer_ico')->comment('VAT ID of the buyer (snapshot)');
        });
        Schema::table('shop_customers', function (Blueprint $table) {
            $table->string('ico', 20)->nullable()->after('company')->comment('Company ID');
            $table->string('dic', 20)->nullable()->after('ico')->comment('VAT ID');
        });

        foreach (DB::table('shop_site_settings')->get(['id', 'order_email_labels_i18n']) as $row) {
            $labels = json_decode((string) $row->order_email_labels_i18n, true);
            if (!is_array($labels) || !isset($labels['cz']) || isset($labels['cz']['label_company_ids'])) {
                continue;
            }
            $labels['cz'] += self::LABEL;
            DB::table('shop_site_settings')->where('id', $row->id)->update(['order_email_labels_i18n' => json_encode($labels, JSON_UNESCAPED_UNICODE)]);
        }
    }

    /**
     * @description Drops the columns (the label stays - harmless).
     * @return void
     */
    public function down(): void
    {
        Schema::table('shop_customers', function (Blueprint $table) {
            $table->dropColumn(['ico', 'dic']);
        });
        Schema::table('shop_orders', function (Blueprint $table) {
            $table->dropColumn(['customer_ico', 'customer_dic']);
        });
    }
};
