<?php
/**
 * @file 2026_11_07_000001_add_sales_order_email_template.php
 * @path api/database/migrations/2026_11_07_000001_add_sales_order_email_template.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The order confirmation e-mail in the language of the page (VT-15), the same
 *   mechanism as the inquiry confirmation:
 *   - `web_sales_orders.lang` - language of the page the order was sent from;
 *   - `web_site_settings.sales_order_email_*_i18n` - texts of the e-mail per language, editable
 *     in the admin (Received orders → E-mail template). The Czech texts of the former hard-coded
 *     e-mail are filled in for 'cz', so Czech customers get the same e-mail as before.
 * @note down() drops the columns (edited texts are lost).
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @description Template columns of web_site_settings. */
    private const COLUMNS = ['subject', 'title', 'intro', 'outro', 'labels'];

    /**
     * @description Adds the order language and the template columns; fills in the former Czech
     *   texts and their English version.
     * @return void
     */
    public function up(): void
    {
        Schema::table('web_sales_orders', function (Blueprint $table) {
            $table->string('lang', 5)->nullable()->after('client_email');
        });

        Schema::table('web_site_settings', function (Blueprint $table) {
            foreach (self::COLUMNS as $column) {
                $table->json("sales_order_email_{$column}_i18n")->nullable();
            }
        });

        $texts = [
            'subject' => ['cz' => 'Vaše poptávka byla přijata', 'en' => 'Your order has been received'],
            'title'   => ['cz' => 'Vaše poptávka byla přijata', 'en' => 'Your order has been received'],
            'intro'   => [
                'cz' => 'děkujeme za Vaši poptávku. Byla úspěšně přijata a náš tým se jí bude v nejbližší době věnovat.',
                'en' => 'thank you for your order. It has been successfully received and our team will attend to it shortly.',
            ],
            'outro'   => ['cz' => 'V případě dotazů nás neváhejte kontaktovat.', 'en' => 'If you have any questions, please do not hesitate to contact us.'],
            'labels'  => [
                'cz' => [
                    'greeting' => 'Dobrý den', 'summary_header' => 'Rekapitulace poptávky', 'label_name' => 'Jméno / Firma',
                    'label_ico' => 'IČO', 'label_email' => 'Kontaktní e-mail', 'label_phone' => 'Telefon', 'label_address' => 'Adresa',
                    'label_description' => 'Popis poptávky', 'label_attachments' => 'Přiložené soubory', 'label_date' => 'Datum přijetí',
                ],
                'en' => [
                    'greeting' => 'Hello', 'summary_header' => 'Order Summary', 'label_name' => 'Name / Company',
                    'label_ico' => 'Company ID', 'label_email' => 'Contact Email', 'label_phone' => 'Phone', 'label_address' => 'Address',
                    'label_description' => 'Order Description', 'label_attachments' => 'Attached Files', 'label_date' => 'Date Received',
                ],
            ],
        ];
        $values = [];
        foreach (self::COLUMNS as $column) {
            $values["sales_order_email_{$column}_i18n"] = json_encode($texts[$column], JSON_UNESCAPED_UNICODE);
        }
        DB::table('web_site_settings')->update($values);
    }

    /**
     * @description Drops the template columns and the order language.
     * @return void
     */
    public function down(): void
    {
        Schema::table('web_site_settings', function (Blueprint $table) {
            $table->dropColumn(array_map(fn ($c) => "sales_order_email_{$c}_i18n", self::COLUMNS));
        });
        Schema::table('web_sales_orders', function (Blueprint $table) {
            $table->dropColumn('lang');
        });
    }
};
