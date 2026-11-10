<?php
/**
 * @file 2026_11_14_000000_shop_order_confirmation_email.php
 * @path api/database/migrations/2026_11_14_000000_shop_order_confirmation_email.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Confirmation e-mail of an e-shop order (Directive 2011/83/EU, Art. 8(7) -
 *   confirmation of the concluded contract on a durable medium):
 *   - shop_orders.lang - language of the storefront the order was placed from (the e-mail is
 *     sent in it);
 *   - shop_site_settings.order_email_*_i18n - the texts of the e-mail editable per language in
 *     the admin (E-shop orders → Edit confirmation e-mail), as the web orders have them.
 * @note Existing orders keep lang null (= Czech); no e-mail is sent for them afterwards.
 * @note The Czech texts (database/seeders/data/shop_order_email.php) are filled into the existing
 *   settings row - the e-mail of the built-in language is Czech from the start and editable; a
 *   language without its own texts uses them (ShopOrderEmailTemplate). A new installation has no
 *   row yet: BaseDataSeeder creates it with the same texts.
 * @dependencies database/seeders/data/shop_order_email.php
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @description Template columns of shop_site_settings. */
    private const TEMPLATE_COLUMNS = ['order_email_subject_i18n', 'order_email_title_i18n', 'order_email_intro_i18n', 'order_email_outro_i18n', 'order_email_labels_i18n'];

    /**
     * @description Adds the language of the order and the template columns, fills in the Czech texts.
     * @return void
     */
    public function up(): void
    {
        Schema::table('shop_orders', function (Blueprint $table) {
            $table->string('lang', 10)->nullable()->after('notes')->comment('Language of the storefront (confirmation e-mail); null = cz');
        });

        Schema::table('shop_site_settings', function (Blueprint $table) {
            foreach (self::TEMPLATE_COLUMNS as $column) {
                $table->json($column)->nullable();
            }
        });

        // The columns are new - nothing of the admin is overwritten.
        $texts = array_map(
            fn (array $value) => json_encode($value, JSON_UNESCAPED_UNICODE),
            require database_path('seeders/data/shop_order_email.php')
        );
        DB::table('shop_site_settings')->update($texts);
    }

    /**
     * @description Drops the columns again.
     * @return void
     */
    public function down(): void
    {
        Schema::table('shop_site_settings', function (Blueprint $table) {
            $table->dropColumn(self::TEMPLATE_COLUMNS);
        });

        Schema::table('shop_orders', function (Blueprint $table) {
            $table->dropColumn('lang');
        });
    }
};
