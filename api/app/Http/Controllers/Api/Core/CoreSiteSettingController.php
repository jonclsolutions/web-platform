<?php

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreSiteSetting;
use App\Models\Web\WebLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache; // 🟢 DŮLEŽITÉ: Import pro správu cache

class CoreSiteSettingController extends Controller
{
    /**
     * Načtení aktuálního nastavení e-shopu.
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
     * Aktualizace stavu e-shopu s ověřením hesla.
     */
    public function update(Request $request)
    {
        // 1. Validace vstupních dat včetně vyžadovaného potvrzovacího hesla
        $validated = $request->validate([
            'is_shop_active'       => 'required|boolean',
            'maintenance_message'  => 'nullable|string|max:500',
            'confirm_password'     => 'required|string',
        ]);

        // 2. Načtení aktuálně přihlášeného uživatele
        $auth = $request->user() ?? auth('sanctum')->user();

        if (!$auth) {
            return response()->json(['message' => 'Uživatel není přihlášen.'], 401);
        }

        // 3. BEZPEČNOSTNÍ POJISTKA: Ověření zadaného hesla proti hash v DB
        if (!Hash::check($validated['confirm_password'], $auth->user_password_hash)) {
            // Zalogujeme neúspěšný pokus
            $this->logAction(
                $request, 
                'unauthorized_shop_toggle_attempt', 
                'Core', 
                "⚠️ NEÚSPĚŠNÝ pokus o změnu stavu e-shopu uživatelem {$auth->user_email}. Zadáno nesprávné heslo.",
                null
            );

            return response()->json(['message' => 'Zadané potvrzovací heslo je nesprávné.'], 403);
        }

        // 4. Provedení samotné změny nastavení
        $settings = CoreSiteSetting::first() ?? new CoreSiteSetting();
        $settings->is_shop_active = $validated['is_shop_active'];
        if (isset($validated['maintenance_message'])) {
            $settings->maintenance_message = $validated['maintenance_message'];
        }
        $settings->save();

        // 🟢 KLÍČOVÝ KROK: Vymazání cache, aby middleware CheckCoreShopActive okamžitě viděl změnu
        Cache::forget('site_setting_active');

        // 5. ZALOGOVÁNÍ ÚSPĚŠNÉ AKCE
        $statusText = $settings->is_shop_active ? 'ZAPNUT (Provoz)' : 'VYPNUT (Údržba)';
        $this->logAction(
            $request, 
            'shop_status_changed', 
            'Core', 
            "Uživatel {$auth->user_email} změnil stav e-shopu na: {$statusText}.",
            $settings->id
        );

        return response()->json([
            'success' => true,
            'data' => $settings
        ]);
    }

    /**
     * Interní pomocná metoda pro zápis do web_logs.
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
                // Očistíme context_data od hesel
                'context_data'         => json_encode($request->except(['confirm_password', 'password']), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'system'
            ]);
        } catch (\Exception $e) { 
            Log::error("Log error (CoreSiteSetting): " . $e->getMessage()); 
        }
    }
}