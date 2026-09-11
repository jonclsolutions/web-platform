<?php
/**
 * @file CheckWebActive.php
 * @path app/Http/Middleware/CheckWebActive.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Middleware that enforces public-web availability by verifying the
 * `is_web_active` flag on the web-owned settings table.
 *
 * @refactor-note (2026-08-15) Renamed from `CheckCoreWebActive` and repointed from
 * `App\Models\Core\CoreSiteSetting` to `App\Models\Web\WebSiteSetting`, following the
 * move of web maintenance data out of the (now-deleted) Core domain into Web. The
 * middleware alias itself (`web.active`, registered in bootstrap/app.php) is unchanged -
 * only the class it points to. Cache key (`site_setting_active_web`) unchanged, so any
 * existing cached row is transparently replaced by the model's next `firstOrCreate()`.
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\Web\WebSiteSetting;
use Symfony\Component\HttpFoundation\Response;

/**
 * @description Intercepts incoming requests to verify if the public web is currently active.
 * @note Deliberately uses its own cache key ('site_setting_active_web', distinct from
 * shop's 'site_setting_active_shop') so invalidating one section's cache never affects the
 * other - shop and web maintenance are fully independent.
 */
class CheckWebActive
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
            return WebSiteSetting::firstOrCreate(
                ['id' => 1],
                ['is_web_active' => true, 'web_maintenance_message' => 'We apologize, the website is currently undergoing maintenance.']
            );
        });

        if (!$settings->is_web_active) {
            return response()->json([
                'success' => false,
                'message' => $settings->web_maintenance_message ?? 'We apologize, the website is currently undergoing maintenance.'
            ], 503);
        }

        return $next($request);
    }
}