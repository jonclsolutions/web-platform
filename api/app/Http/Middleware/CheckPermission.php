<?php
/**
 * @file CheckPermission.php
 * @path app/Http/Middleware/CheckPermission.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Backend enforcement of the permission system (the same keys as the Angular route
 * metadata `data: { permission: '...' }` and the `*appHasPermission` directive), so a direct
 * API call (Postman / curl) cannot bypass the UI.
 * @note The sysadmin passes every permission check unconditionally - the highest authority of
 * the application (UserController::SYSADMIN_ROLE_NAME / CoreRoleController); a missing
 * permission assignment of its role must not lock it out.
 * @note The optional second parameter `$selfParam` lets a route pass either the permission OR
 * the ownership of the record (route parameter = ID of the logged-in user) - used by the
 * `core/users/{id}` endpoints, which a user must reach for their OWN account (personal info).
 * @note Security events: `unauthenticated_access_attempt` (severity `info` - normally the
 * `auth:sanctum` group refuses such requests earlier, this is defence in depth) and
 * `permission_denied` (severity `warning`, context `required_permission`). The sysadmin and a
 * valid `$selfParam` pass (own account) are not logged.
 */

namespace App\Http\Middleware;

use App\Models\Core\CoreSecurityEvent;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * @description Role name that passes every permission check (see the class description).
     * Must match `UserController::SYSADMIN_ROLE_NAME` / `CoreRoleController`.
     */
    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /**
     * @param Request $request
     * @param Closure $next
     * @param string $permission One or more (separated by `|`) required permission keys - the
     * same keys as `data.permission` on the frontend. ANY of them is enough (OR).
     * @param string|null $selfParam Route parameter (e.g. 'id') whose match with the ID of the
     * logged-in user lets the request pass without the permission (see the class description).
     * @return Response
     */
    public function handle(Request $request, Closure $next, string $permission, ?string $selfParam = null): Response
    {
        $user = $request->user();

        if (!$user) {
            CoreSecurityEvent::record(
                'unauthenticated_access_attempt',
                'info',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['required_permission' => $permission])
            );

            return response()->json(['message' => 'Not logged in.'], 401);
        }

        $isSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
        if ($isSysadmin) {
            return $next($request);
        }

        if ($selfParam !== null) {
            $routeValue = $request->route($selfParam);
            $routeId = is_object($routeValue) ? $routeValue->id : $routeValue;
            if ($routeId !== null && (int) $routeId === (int) $user->id) {
                return $next($request);
            }
        }

        $requiredPermissions = explode('|', $permission);
        $userPermissions = $user->permissions ?? [];

        if (array_intersect($requiredPermissions, $userPermissions)) {
            return $next($request);
        }

        CoreSecurityEvent::record(
            'permission_denied',
            'warning',
            $request->ip(),
            CoreSecurityEvent::contextFromRequest($request, ['required_permission' => $permission])
        );

        return response()->json(['message' => 'Insufficient permissions.'], 403);
    }
}