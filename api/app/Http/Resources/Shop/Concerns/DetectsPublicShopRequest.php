<?php
/**
 * @file DetectsPublicShopRequest.php
 * @path app/Http/Resources/Shop/Concerns/DetectsPublicShopRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Lets shop resources tell the public storefront / checkout responses apart
 *   from the authenticated admin responses, so internal fields are only sent to the admin.
 *
 * @bugfix-note (2026-10-23) SECURITY - the public product list / detail returned the
 *   purchase price (`cost_price_eur`) of every product and variant, and the public payment
 *   methods (also embedded in the checkout order response) returned the gateway `config`
 *   (intended for API keys / merchant settings). Resources now leave these fields out of
 *   public responses.
 * @bugfix-note (2026-10-23) Open finding #26: public products / variants returned the exact
 *   stock (`stock_quantity`) although check-stock is designed to hide it (competitors could
 *   scrape the stock levels). Public responses cap it at PUBLIC_STOCK_CAP (the cart uses it
 *   only as the quantity limit; low stock is still shown exactly) and leave out the internal
 *   `stock_warning_level`.
 */

namespace App\Http\Resources\Shop\Concerns;

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
