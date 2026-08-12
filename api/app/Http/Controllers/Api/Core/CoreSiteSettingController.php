<?php
/**
 * @file CoreSiteSettingController.php
 * @path app/Http/Controllers/Api/Core/CoreSiteSettingController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages global site configuration - toggling maintenance mode for one or
 * more independent "sections" (currently shop + web) with secure password verification
 * and per-section cache invalidation.
 *
 * @refactor-note (2026-08) Přepsáno z natvrdo zadrátovaného shop-only togglu na generický
 * mechanismus (`TOGGLE_GROUPS`) - `update()` teď přijímá libovolnou kombinaci
 * `is_{section}_active` / `{section}_maintenance_message` polí a aktualizuje jen ty
 * sekce, které klient skutečně poslal. Přidání další sekce (např. `core`) v budoucnu
 * znamená jen přidat položku do `TOGGLE_GROUPS` + validaci - žádný další kód se nemění.
 * UI toggle přesunut z admin-layout headeru na Shop dashboard (shop) a Web dashboard
 * (web) - viz odpovídající dashboard komponenty.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreSiteSetting;
use App\Models\Web\WebLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

/**
 * @description Controller responsible for site-wide status settings (shop maintenance,
 * web maintenance, and any future toggleable section).
 * @note Uses Redis/Cache invalidation per-section so `CheckCoreShopActive`/
 * `CheckCoreWebActive` middleware react instantly to configuration changes.
 */
class CoreSiteSettingController extends Controller
{
    /**
     * @description Definuje každou nezávisle přepínatelnou "sekci" - jméno DB sloupce
     * pro aktivní stav, jméno DB sloupce pro zprávu, cache klíč použitý příslušným
     * middlewarem/veřejným status endpointem, a lidsky čitelný label pro audit log.
     * Přidání nové sekce (např. `core`) = jeden nový řádek zde + odpovídající sloupce
     * v DB (viz SQL migrace) - žádný jiný kód v tomto souboru se měnit nemusí.
     */
    private const TOGGLE_GROUPS = [
        'shop' => [
            'active_field'  => 'is_shop_active',
            'message_field' => 'maintenance_message',
            'cache_key'     => 'site_setting_active',
            'label'         => 'e-shopu',
        ],
        'web' => [
            'active_field'  => 'is_web_active',
            'message_field' => 'web_maintenance_message',
            'cache_key'     => 'site_setting_active_web',
            'label'         => 'webu',
        ],
    ];

    /**
     * Retrieves the current site settings or creates defaults if none exist.
     *
     * @return JsonResponse Returns the site configuration object.
     */
    public function show()
    {
        $settings = CoreSiteSetting::first() ?? CoreSiteSetting::create([
            'is_shop_active'          => true,
            'maintenance_message'     => 'Omlouváme se, na systému momentálně probíhá údržba.',
            'is_web_active'           => true,
            'web_maintenance_message' => 'Omlouváme se, web je momentálně v údržbě.',
        ]);

        return response()->json($settings);
    }

    /**
     * Updates site status for whichever sections are present in the request, with
     * mandatory password confirmation for security.
     *
     * @param Request $request The incoming HTTP request containing status/message fields
     * for one or more sections plus confirmation password.
     * @return JsonResponse Returns status success and updated settings, or a 403 error on
     * authentication failure.
     */
    public function update(Request $request)
    {
        $rules = ['confirm_password' => 'required|string'];
        foreach (self::TOGGLE_GROUPS as $group) {
            $rules[$group['active_field']]  = 'sometimes|boolean';
            $rules[$group['message_field']] = 'sometimes|nullable|string|max:500';
        }

        $validated = $request->validate($rules);

        $auth = $request->user() ?? auth('sanctum')->user();

        if (!$auth) {
            return response()->json(['message' => 'User is not authenticated.'], 401);
        }

        // Security check: Verify password against database hash
        if (!Hash::check($validated['confirm_password'], $auth->user_password_hash)) {
            $this->logAction(
                $request,
                'unauthorized_maintenance_toggle_attempt',
                'Core',
                "⚠️ UNAUTHORIZED attempt to toggle maintenance status by {$auth->user_email}. Incorrect password provided.",
                null
            );

            return response()->json(['message' => 'Invalid confirmation password.'], 403);
        }

        $settings = CoreSiteSetting::first() ?? new CoreSiteSetting();
        $changedLabels = [];

        foreach (self::TOGGLE_GROUPS as $group) {
            $activeField  = $group['active_field'];
            $messageField = $group['message_field'];

            if (!array_key_exists($activeField, $validated)) {
                continue; // Tahle sekce nebyla v requestu vůbec zmíněná - nesahat na ni.
            }

            $settings->{$activeField} = $validated[$activeField];
            if (isset($validated[$messageField])) {
                $settings->{$messageField} = $validated[$messageField];
            }

            Cache::forget($group['cache_key']);

            $statusText = $validated[$activeField] ? 'ENABLED (Operational)' : 'DISABLED (Maintenance)';
            $changedLabels[] = "{$group['label']}: {$statusText}";
        }

        $settings->save();

        if ($changedLabels) {
            $this->logAction(
                $request,
                'maintenance_status_changed',
                'Core',
                "User {$auth->user_email} changed status - " . implode(', ', $changedLabels) . ".",
                $settings->id
            );
        }

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
                'context_data'         => json_encode($request->except(['confirm_password', 'password']), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'system'
            ]);
        } catch (\Exception $e) { 
            Log::error("Log error (CoreSiteSetting): " . $e->getMessage()); 
        }
    }
}