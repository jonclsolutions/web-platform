<?php
/**
 * @file DetectsPublicShopRequest.php
 * @path app/Apps/Shop/Http/Resources/Concerns/DetectsPublicShopRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Lets shop resources tell the public storefront / checkout responses apart
 *   from the authenticated admin responses, so internal fields are only sent to the admin.
 */

namespace App\Apps\Shop\Http\Resources\Concerns;

use Illuminate\Http\Request;

/**
 * @description Public = unauthenticated storefront (`api/shop/public/*`) and checkout
 *   (`api/shop/checkout/*`) routes.
 */
trait DetectsPublicShopRequest
{
    /** @var int Highest stock value shown publicly (quantity limit of the cart). */
    public const PUBLIC_STOCK_CAP = 99;

    /**
     * @description Stock as shown in the given response: exact for the admin, capped publicly.
     * @param Request $request Current request.
     * @param int|null $stock Real stock.
     * @return int|null
     */
    protected function stockFor(Request $request, ?int $stock): ?int
    {
        if ($stock === null || !$this->isPublicShopRequest($request)) {
            return $stock;
        }
        return min($stock, self::PUBLIC_STOCK_CAP);
    }

    /**
     * @description Whether the response goes to the public storefront / checkout.
     * @param Request $request Current request.
     * @return bool
     */
    protected function isPublicShopRequest(Request $request): bool
    {
        return $request->is('api/shop/public/*', 'api/shop/checkout/*');
    }
}
