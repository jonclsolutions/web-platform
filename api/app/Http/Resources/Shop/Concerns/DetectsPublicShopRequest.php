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
 */

namespace App\Http\Resources\Shop\Concerns;

use Illuminate\Http\Request;

/**
 * @description Public = unauthenticated storefront (`api/shop/public/*`) and checkout
 *   (`api/shop/checkout/*`) routes.
 */
trait DetectsPublicShopRequest
{
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
