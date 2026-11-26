<?php
/**
 * @file 2026_11_29_000000_shop_order_email_czech_complete.php
 * @path api/app/Apps/Shop/Database/Migrations/2026_11_29_000000_shop_order_email_czech_complete.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Czech is the default language of the order confirmation e-mail of the e-shop (2026-11): the template is saved
 *   only with every Czech text filled in, and every other language falls back to Czech (never to
 *   a built-in English wording any more). Fills the empty Czech texts of the stored template with
 *   the built-in Czech texts (ShopOrderEmailTemplate::DEFAULTS) - filled texts and other languages stay.
 * @note No settings row yet (new installation, the seed comes later): nothing to do.
 * @note down() changes nothing - the filled-in texts cannot be told from texts typed in.
 * @dependencies ShopSiteSetting, ShopOrderEmailTemplate
 */

use App\Apps\Shop\Models\ShopSiteSetting;
use App\Apps\Shop\Support\ShopOrderEmailTemplate;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Completes the Czech texts of the template.
     * @return void
     */
    public function up(): void
    {
        if (!Schema::hasTable('shop_site_settings') || !Schema::hasColumn('shop_site_settings', 'order_email_labels_i18n')) {
            return;
        }
        $settings = ShopSiteSetting::query()->first();
        if ($settings && ShopOrderEmailTemplate::completeDefaults($settings)) {
            $settings->save();
        }
    }

    /**
     * @description Nothing to undo (see the file header).
     * @return void
     */
    public function down(): void
    {
    }
};
