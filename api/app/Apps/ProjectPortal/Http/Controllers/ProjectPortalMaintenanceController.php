<?php
/**
 * @file ProjectPortalMaintenanceController.php
 * @path app/Apps/ProjectPortal/Http/Controllers/ProjectPortalMaintenanceController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Maintenance switch of the public project portal (client portal + order form),
 *   the same contract as the web (`web/settings`) and the e-shop (`shop/settings`):
 *   - GET  project-portal/public/status - public, `{is_portal_active, maintenance_message}`
 *     (the maintenance page and the guard of the public pages);
 *   - GET  project-portal/maintenance - admin, the switch and its text;
 *   - PUT  project-portal/maintenance - admin, change confirmed by the password of the signed-in
 *     user; the change and a refused password are written to the portal log.
 * @dependencies ProjectPortalSetting, ProjectPortalLog (LogsActivity), CheckProjectPortalActive
 *   (shares the cache key).
 */

namespace App\Apps\ProjectPortal\Http\Controllers;

use App\Apps\ProjectPortal\Http\Middleware\CheckProjectPortalActive;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use App\Http\Controllers\Controller;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

class ProjectPortalMaintenanceController extends Controller
{
    use LogsActivity;

    /**
     * @description Public status of the portal (cached like the middleware).
     * @return JsonResponse `{is_portal_active, maintenance_message}`.
     */
    public function publicStatus(): JsonResponse
    {
        $settings = Cache::remember(ProjectPortalSetting::ACTIVE_CACHE_KEY, 300, fn () => ProjectPortalSetting::current());

        return $this->respond([
            'is_portal_active'    => (bool) $settings->is_portal_active,
            'maintenance_message' => $settings->is_portal_active ? null : ($settings->portal_maintenance_message ?: CheckProjectPortalActive::DEFAULT_MESSAGE),
        ]);
    }

    /**
     * @description The switch and its text for the admin.
     * @return JsonResponse `{is_portal_active, portal_maintenance_message}`.
     */
    public function show(): JsonResponse
    {
        $settings = ProjectPortalSetting::current();

        return $this->respond([
            'is_portal_active'           => (bool) $settings->is_portal_active,
            'portal_maintenance_message' => $settings->portal_maintenance_message,
        ]);
    }

    /**
     * @description Switches the portal on / off (and / or changes the text) after the password
     *   of the signed-in user is confirmed.
     * @param Request $request `confirm_password`, `is_portal_active`?, `portal_maintenance_message`?.
     * @return JsonResponse The new state; 403 on a wrong password (logged).
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'confirm_password'           => 'required|string',
            'is_portal_active'           => 'sometimes|boolean',
            'portal_maintenance_message' => 'sometimes|nullable|string|max:500',
        ]);
        $auth = $request->user();

        if (!Hash::check($validated['confirm_password'], $auth->user_password_hash)) {
            $this->logAction($request, ProjectPortalLog::class, 'unauthorized_maintenance_toggle_attempt', 'ProjectPortalSetting',
                "⚠️ UNAUTHORIZED attempt to toggle project portal maintenance status by {$auth->user_email}. Incorrect password provided.",
                null, 'ProjectPortalSetting');

            return response()->json(['message' => 'Invalid confirmation password.'], 403);
        }

        $settings = ProjectPortalSetting::current();
        $settings->fill(array_intersect_key($validated, array_flip(['is_portal_active', 'portal_maintenance_message'])));
        $settings->save();
        Cache::forget(ProjectPortalSetting::ACTIVE_CACHE_KEY);

        if (array_key_exists('is_portal_active', $validated)) {
            $statusText = $validated['is_portal_active'] ? 'ENABLED (Operational)' : 'DISABLED (Maintenance)';
            $this->logAction($request, ProjectPortalLog::class, 'maintenance_status_changed', 'ProjectPortalSetting',
                "User {$auth->user_email} changed project portal status - {$statusText}.",
                $settings->id, 'ProjectPortalSetting');
        }

        return $this->respond([
            'is_portal_active'           => (bool) $settings->is_portal_active,
            'portal_maintenance_message' => $settings->portal_maintenance_message,
        ]);
    }
}
