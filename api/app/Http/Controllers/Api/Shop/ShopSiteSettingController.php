<?php
/**
 * @file ShopSiteSettingController.php
 * @path app/Http/Controllers/Api/Shop/ShopSiteSettingController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages e-shop maintenance mode - toggling storefront/checkout availability
 * and the customer-facing maintenance message, with mandatory password re-confirmation
 * for the write action and a public read-only endpoint for the storefront.
 *
 * @refactor-note (2026-08-15) Replaces the shop branch of `CoreSiteSettingController`
 * (formerly a generic `TOGGLE_GROUPS` loop shared with web maintenance). Shop maintenance
 * is now a Shop-domain concern with its own table (`shop_site_settings`), model
 * (`ShopSiteSetting`), and permission-gated routes under `/api/shop/settings`. Web
 * maintenance is untouched and remains in `CoreSiteSettingController`.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopSiteSetting;
use App\Models\Shop\ShopLog;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;

/**
 * @description Controller responsible for e-shop-wide maintenance status settings.
 * @note Uses Cache invalidation (`site_setting_active_shop`) so `CheckShopActive`
 * middleware and the public status endpoint react instantly to configuration changes.
 */
class ShopSiteSettingController extends Controller
{
    use LogsActivity;

    /**
     * @description Cache key shared with `CheckShopActive` middleware - must stay in sync.
     */
    private const CACHE_KEY = 'site_setting_active_shop';

    /**
     * Retrieves the current shop settings or creates defaults if none exist.
     *
     * @return JsonResponse
     */
    public function show(): JsonResponse
    {
        $settings = ShopSiteSetting::first() ?? ShopSiteSetting::create([
            'is_shop_active'      => true,
            'maintenance_message' => 'Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.',
        ]);

        return response()->json($settings);
    }

    /**
     * Public, unauthenticated read of the shop's current availability status and message.
     * Used by the storefront (`shop/public/settings`) to render the maintenance page.
     *
     * @return JsonResponse
     */
    public function publicShow(): JsonResponse
    {
        $settings = ShopSiteSetting::first();

        return response()->json([
            'is_shop_active'      => (bool) ($settings->is_shop_active ?? true),
            'maintenance_message' => $settings->maintenance_message ?? null,
        ]);
    }

    /**
     * Updates shop maintenance status, with mandatory password confirmation for security.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'confirm_password'    => 'required|string',
            'is_shop_active'      => 'sometimes|boolean',
            'maintenance_message' => 'sometimes|nullable|string|max:500',
        ]);

        $auth = $request->user() ?? auth('sanctum')->user();

        if (!$auth) {
            return response()->json(['message' => 'User is not authenticated.'], 401);
        }

        // Security check: Verify password against database hash
        if (!Hash::check($validated['confirm_password'], $auth->user_password_hash)) {
            $this->logAction(
                $request,
                ShopLog::class,
                'unauthorized_maintenance_toggle_attempt',
                'Shop',
                "⚠️ UNAUTHORIZED attempt to toggle shop maintenance status by {$auth->user_email}. Incorrect password provided.",
                null,
                'ShopSiteSetting'
            );

            return response()->json(['message' => 'Invalid confirmation password.'], 403);
        }

        $settings = ShopSiteSetting::first() ?? new ShopSiteSetting();

        if (array_key_exists('is_shop_active', $validated)) {
            $settings->is_shop_active = $validated['is_shop_active'];
        }
        if (array_key_exists('maintenance_message', $validated)) {
            $settings->maintenance_message = $validated['maintenance_message'];
        }

        $settings->save();
        Cache::forget(self::CACHE_KEY);

        if (array_key_exists('is_shop_active', $validated)) {
            $statusText = $validated['is_shop_active'] ? 'ENABLED (Operational)' : 'DISABLED (Maintenance)';
            $this->logAction(
                $request,
                ShopLog::class,
                'maintenance_status_changed',
                'Shop',
                "User {$auth->user_email} changed e-shop status - {$statusText}.",
                $settings->id,
                'ShopSiteSetting'
            );
        }

        return response()->json([
            'success' => true,
            'data'    => $settings,
        ]);
    }
}