<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\Core\CoreSiteSetting;
use Symfony\Component\HttpFoundation\Response;

class CheckCoreShopActive
{
    /**
     * Zkontroluje, zda je e-shop aktivní. Pokud ne, nepustí uživatele dál.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Načteme nastavení z Cache (shodně s CoreSiteSettingController), abychom nezatěžovali DB
        $settings = Cache::remember('site_setting_active', 300, function () {
            return CoreSiteSetting::firstOrCreate(
                ['id' => 1],
                ['is_shop_active' => true, 'maintenance_message' => 'Omlouváme se, probíhá údržba systému.']
            );
        });

        // Pokud je eshop vypnutý, vrátíme 503 s konfigurovanou hláškou
        if (!$settings->is_shop_active) {
            return response()->json([
                'success' => false,
                'message' => $settings->maintenance_message ?? 'Omlouváme se, ale příjem objednávek a provoz e-shopu je momentálně pozastaven.'
            ], 503);
        }

        return $next($request);
    }
}