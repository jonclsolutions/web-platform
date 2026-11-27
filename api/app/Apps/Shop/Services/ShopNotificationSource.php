<?php
/**
 * @file ShopNotificationSource.php
 * @path app/Apps/Shop/Services/ShopNotificationSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the e-shop: new orders and active products at / below their stock
 * warning level that changed after the last look (a sale or a stock edit that left them low) -
 * unread, red; texts, page titles and texts of the order e-mails (shop_order_email_missing, Czech
 * always) missing in the active languages of the e-shop (attention, orange - for the admins who may
 * edit them), each with `preparing`: the same in the switched off languages (grey dot).
 * Registered in ShopApp::notificationSources().
 * @note A product that stays low and does not change is not counted again - it is unread once.
 * @dependencies ShopOrder, ShopProduct, ShopSiteSetting, ShopOrderEmailTemplate, MissingTranslations,
 *   MissingPageTitles, TranslationController, NotificationContext
 */

namespace App\Apps\Shop\Services;

use App\Apps\Shop\Models\ShopOrder;
use App\Apps\Shop\Models\ShopProduct;
use App\Apps\Shop\Models\ShopSiteSetting;
use App\Apps\Shop\Support\ShopOrderEmailTemplate;
use App\Http\Controllers\Api\TranslationController;
use App\Services\Notifications\NotificationContext;
use App\Services\Notifications\NotificationSource;
use App\Support\I18n\MissingTranslations;
use App\Support\I18n\MissingPageTitles;

final class ShopNotificationSource implements NotificationSource
{
    /** @description See NotificationSource::kinds(). */
    public function kinds(NotificationContext $context): array
    {
        $kinds = [];
        if ($context->can('shop-orders-view')) {
            $kinds[] = $context->created('shop_orders', '/admin/shop/orders', ShopOrder::query());
        }
        if ($context->can('shop-products-view')) {
            $kinds[] = $context->created('shop_low_stock', '/admin/shop/products', ShopProduct::where('is_active', true)
                ->whereColumn('stock_quantity', '<=', 'stock_warning_level'), 'updated_at');
        }

        $inactive = TranslationController::inactiveLanguageCodes('shop');
        if ($context->can('shop-edit-eshop-update')) {
            $missing = MissingTranslations::byLanguage('shop');
            $kinds[] = $context->attention('shop_texts_missing', '/admin/shop/edit-eshop', array_sum($missing), $missing,
                MissingTranslations::byLanguage('shop', $inactive));
            $titles = MissingPageTitles::byLanguage('shop');
            $kinds[] = $context->attention('shop_page_titles_missing', '/admin/shop/edit-eshop', array_sum($titles), $titles,
                MissingPageTitles::byLanguage('shop', $inactive));
        }
        if ($context->can('shop-orders-update')) {
            $settings = ShopSiteSetting::first();
            $email = ShopOrderEmailTemplate::countsByLanguage($settings, array_merge(['cz'], TranslationController::activeLanguageCodes('shop')));
            $kinds[] = $context->attention('shop_order_email_missing', '/admin/shop/orders', array_sum($email), $email,
                ShopOrderEmailTemplate::countsByLanguage($settings, $inactive));
        }

        return $kinds;
    }
}
