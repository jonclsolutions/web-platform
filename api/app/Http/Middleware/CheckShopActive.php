<?php
/**
 * @file CheckShopActive.php
 * @path app/Http/Middleware/CheckShopActive.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Middleware that enforces e-shop availability by verifying the
 * `is_shop_active` flag on the shop-owned settings table.
 *
 * @refactor-note (2026-08-15) Renamed from `CheckCoreShopActive` and repointed from
 * `App\Models\Core\CoreSiteSetting` to `App\Models\Shop\ShopSiteSetting`, following the
 * move of shop maintenance data out of the Core domain into Shop. The middleware alias
 * itself (`shop.active`, registered in bootstrap/app.php) is unchanged - only the class
 * it points to needs updating, see delivery notes.
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\Shop\ShopSiteSetting;
use Symfony\Component\HttpFoundation\Response;

/**
 * @description Intercepts incoming requests to verify if the shop is currently active.
 * @note Prevents access to storefront/checkout routes if the shop is in maintenance mode,
 * using caching for performance. Cache key must stay in sync with
 * `ShopSiteSettingController::CACHE_KEY`.
 */
class CheckShopActive
{
    /**
     * Handles the incoming request and validates the shop activity status.
     *
     * @param Request $request
     * @param Closure $next
     * @return Response Returns the request response or a 503 maintenance error.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Retrieve settings from Cache to minimize database load
        $settings = Cache::remember('site_setting_active_shop', 300, function () {
            return ShopSiteSetting::firstOrCreate(
                ['id' => 1],
                ['is_shop_active' => true, 'maintenance_message' => 'Omlouváme se, probíhá údržba systému.']
            );
        });

        // Return 503 if the shop is inactive
        if (!$settings->is_shop_active) {
            return response()->json([
                'success' => false,
                'message' => $settings->maintenance_message ?? 'Omlouváme se, ale příjem objednávek a provoz e-shopu je momentálně pozastaven.'
            ], 503);
        }

        return $next($request);
    }
}