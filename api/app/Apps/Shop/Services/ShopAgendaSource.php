<?php
/**
 * @file ShopAgendaSource.php
 * @path app/Apps/Shop/Services/ShopAgendaSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calendar entries of the e-shop: start / end of active coupons (events), orders to
 * process and products at / below their stock warning level (reminders). Registered in
 * ShopApp::agendaSources().
 * @dependencies AgendaContext, ShopCoupon, ShopOrder, ShopProduct
 */

namespace App\Apps\Shop\Services;

use App\Apps\Shop\ShopApp;
use App\Apps\Shop\Models\ShopCoupon;
use App\Apps\Shop\Models\ShopOrder;
use App\Apps\Shop\Models\ShopProduct;
use App\Services\Agenda\AgendaContext;
use App\Services\Agenda\AgendaSource;
use Illuminate\Support\Carbon;

final class ShopAgendaSource implements AgendaSource
{
    /** @description E-shop order states that still need work. */
    public const ORDER_OPEN_STATES = ['pending', 'confirmed', 'processing'];

    /** @description See AgendaSource::permissions(). */
    public function permissions(): array
    {
        return ['shop-coupons-view', 'shop-orders-view', 'shop-products-view'];
    }

    /** @description See AgendaSource::events(). */
    public function events(AgendaContext $agenda, Carbon $from, Carbon $to): array
    {
        $events = [];
        if ($agenda->can('shop-coupons-view')) {
            foreach (ShopCoupon::where('is_active', true)->whereBetween('valid_from', [$from, $to])->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get(['id', 'code', 'valid_from']) as $coupon) {
                $events[] = $agenda->event('coupon_start', (string) $coupon->id, $coupon->valid_from, $coupon->code, '/admin/shop/coupons');
            }
            foreach (ShopCoupon::where('is_active', true)->whereBetween('valid_until', [$from, $to])->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get(['id', 'code', 'valid_until']) as $coupon) {
                $events[] = $agenda->event('coupon_end', (string) $coupon->id, $coupon->valid_until, $coupon->code, '/admin/shop/coupons', 'warning');
            }
        }

        return $events;
    }

    /** @description See AgendaSource::reminders(). */
    public function reminders(AgendaContext $agenda): array
    {
        $reminders = [];
        if ($agenda->can('shop-orders-view')) {
            $reminders[] = $agenda->reminder('shop_orders_open', '/admin/shop/orders', ShopOrder::whereIn('status', self::ORDER_OPEN_STATES));
        }
        if ($agenda->can('shop-products-view')) {
            $reminders[] = $agenda->reminder('products_low_stock', '/admin/shop/products', ShopProduct::where('is_active', true)
                ->whereColumn('stock_quantity', '<=', 'stock_warning_level'), null);
        }

        return array_values(array_filter($reminders));
    }
}
