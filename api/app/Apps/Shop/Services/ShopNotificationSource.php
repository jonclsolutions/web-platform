<?php
/**
 * @file ShopNotificationSource.php
 * @path app/Apps/Shop/Services/ShopNotificationSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the e-shop: new orders and active products at / below their stock
 * warning level that changed after the last look (a sale or a stock edit that left them low) -
 * unread, red; texts missing in the active languages of the e-shop texts (attention, orange - for
 * the admins who may edit them). Registered in ShopApp::notificationSources().
 * @note A product that stays low and does not change is not counted again - it is unread once.
 * @dependencies ShopOrder, ShopProduct, MissingTranslations, NotificationContext
 */

namespace App\Apps\Shop\Services;

use App\Apps\Shop\Models\ShopOrder;
use App\Apps\Shop\Models\ShopProduct;
use App\Services\Notifications\NotificationContext;
use App\Services\Notifications\NotificationSource;
use App\Support\I18n\MissingTranslations;

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

        if ($context->can('shop-edit-eshop-update')) {
            $kinds[] = $context->attention('shop_texts_missing', '/admin/shop/edit-eshop', MissingTranslations::count('shop'));
        }

        return $kinds;
    }
}
