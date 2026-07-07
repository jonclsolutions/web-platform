<?php
/**
 * @file CoreSiteSettingController.php
 * @path app/Http/Controllers/Api/Core/CoreSiteSettingController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages global site configuration, specifically toggling shop maintenance modes with secure password verification and cache invalidation.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreSiteSetting;
use App\Models\Web\WebLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

/**
 * @description Controller responsible for shop-wide status settings.
 * @note Uses Redis/Cache invalidation to ensure that the `CheckCoreShopActive` middleware reacts instantly to configuration changes.
 */
class CoreSiteSettingController extends Controller
{
    /**
     * Retrieves the current shop settings or creates defaults if none exist.
     *
     * @return JsonResponse Returns the site configuration object.
     */
    public function show()
    {
        $settings = CoreSiteSetting::first() ?? CoreSiteSetting::create([
            'is_shop_active' => true,
            'maintenance_message' => 'Omlouváme se, na systému momentálně probíhá údržba.'
        ]);

        return response()->json($settings);
    }

    /**
     * Updates shop status with mandatory password confirmation for security.
     *
     * @param Request $request The incoming HTTP request containing status and confirmation password.
     * @return JsonResponse Returns status success and updated settings, or a 403 error on authentication failure.
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'is_shop_active'       => 'required|boolean',
            'maintenance_message'  => 'nullable|string|max:500',
            'confirm_password'     => 'required|string',
        ]);

        $auth = $request->user() ?? auth('sanctum')->user();

        if (!$auth) {
            return response()->json(['message' => 'User is not authenticated.'], 401);
        }

        // Security check: Verify password against database hash
        if (!Hash::check($validated['confirm_password'], $auth->user_password_hash)) {
            $this->logAction(
                $request, 
                'unauthorized_shop_toggle_attempt', 
                'Core', 
                "⚠️ UNAUTHORIZED attempt to toggle shop status by {$auth->user_email}. Incorrect password provided.",
                null
            );

            return response()->json(['message' => 'Invalid confirmation password.'], 403);
        }

        $settings = CoreSiteSetting::first() ?? new CoreSiteSetting();
        $settings->is_shop_active = $validated['is_shop_active'];
        if (isset($validated['maintenance_message'])) {
            $settings->maintenance_message = $validated['maintenance_message'];
        }
        $settings->save();

        // Invalidate cache to force middleware to re-evaluate the shop state immediately
        Cache::forget('site_setting_active');

        $statusText = $settings->is_shop_active ? 'ENABLED (Operational)' : 'DISABLED (Maintenance)';
        $this->logAction(
            $request, 
            'shop_status_changed', 
            'Core', 
            "User {$auth->user_email} changed shop status to: {$statusText}.",
            $settings->id
        );

        return response()->json([
            'success' => true,
            'data' => $settings
        ]);
    }

    /**
     * Logs administrative actions to the central audit system.
     *
     * @param Request $request The request context.
     * @param string $type The action category.
     * @param string $mod The module identifier.
     * @param string $desc The audit log description.
     * @param int|null $id The affected entity ID.
     * @return void
     */
    protected function logAction(Request $request, string $type, string $mod, string $desc, ?int $id = null)
    {
        try {
            $user = $request->user() ?? auth('sanctum')->user();

            WebLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $type,
                'module'               => $mod,
                'description'          => $desc,
                'affected_entity_type' => 'CoreSiteSetting',
                'affected_entity_id'   => $id,
                'user_id'              => $user?->id,
                // Clean context data: remove sensitive password fields
                'context_data'         => json_encode($request->except(['confirm_password', 'password']), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'system'
            ]);
        } catch (\Exception $e) { 
            Log::error("Log error (CoreSiteSetting): " . $e->getMessage()); 
        }
    }
}