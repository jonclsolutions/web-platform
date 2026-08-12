<?php
/**
 * @file CheckCoreWebActive.php
 * @path app/Http/Middleware/CheckCoreWebActive.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Middleware that enforces public-web availability by verifying the
 * 'is_web_active' site setting. Mirror of CheckCoreShopActive, but for the marketing/
 * public web forms (job applications, raw request commissions, sales orders) rather than
 * the e-shop.
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\Core\CoreSiteSetting;
use Symfony\Component\HttpFoundation\Response;

/**
 * @description Intercepts incoming requests to verify if the public web is currently active.
 * @note Deliberately uses its own cache key ('site_setting_active_web', distinct from
 * shop's 'site_setting_active') so invalidating one section's cache never affects the
 * other - shop and web maintenance are fully independent.
 */
class CheckCoreWebActive
{
    /**
     * Handles the incoming request and validates web activity status.
     *
     * @param Request $request
     * @param Closure $next
     * @return Response Returns the request response or a 503 maintenance error.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $settings = Cache::remember('site_setting_active_web', 300, function () {
            return CoreSiteSetting::firstOrCreate(
                ['id' => 1],
                ['is_web_active' => true, 'web_maintenance_message' => 'Omlouváme se, web je momentálně v údržbě.']
            );
        });

        if (!$settings->is_web_active) {
            return response()->json([
                'success' => false,
                'message' => $settings->web_maintenance_message ?? 'Omlouváme se, web je momentálně v údržbě.'
            ], 503);
        }

        return $next($request);
    }
}