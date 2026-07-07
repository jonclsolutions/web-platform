<?php
/**
 * @file CheckCoreShopActive.php
 * @path app/Http/Middleware/CheckCoreShopActive.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Middleware that enforces e-shop availability by verifying the 'is_shop_active' site setting.
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\Core\CoreSiteSetting;
use Symfony\Component\HttpFoundation\Response;

/**
 * @description Intercepts incoming requests to verify if the shop is currently active.
 * @note Prevents access to order-related routes if the site is in maintenance mode, using caching for performance.
 */
class CheckCoreShopActive
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
        $settings = Cache::remember('site_setting_active', 300, function () {
            return CoreSiteSetting::firstOrCreate(
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