<?php
/**
 * @file CheckProjectPortalActive.php
 * @path app/Apps/ProjectPortal/Http/Middleware/CheckProjectPortalActive.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Middleware (alias `project-portal.active`) of the public endpoints of the project
 *   portal (client portal, order form): while the portal is in maintenance they answer 503 with
 *   the maintenance text. Same contract as `web.active` / `shop.active`.
 * @dependencies ProjectPortalSetting (switch, cache key ACTIVE_CACHE_KEY - forgotten by the admin
 *   change, so a switch applies at once).
 */

namespace App\Apps\ProjectPortal\Http\Middleware;

use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class CheckProjectPortalActive
{
    /** @description Maintenance text when the admin left none. */
    public const DEFAULT_MESSAGE = 'We apologize, the project portal is currently undergoing maintenance.';

    /**
     * @description Lets the request through while the portal is online, else 503 {message}.
     * @param Request $request
     * @param Closure $next
     * @return Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        $settings = Cache::remember(ProjectPortalSetting::ACTIVE_CACHE_KEY, 300, fn () => ProjectPortalSetting::current());

        if (!$settings->is_portal_active) {
            return response()->json(['message' => $settings->portal_maintenance_message ?: self::DEFAULT_MESSAGE], 503);
        }

        return $next($request);
    }
}
