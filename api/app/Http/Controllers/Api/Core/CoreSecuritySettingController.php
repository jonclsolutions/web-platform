<?php
/**
 * @file CoreSecuritySettingController.php
 * @path app/Http/Controllers/Api/Core/CoreSecuritySettingController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Správa retenční doby bezpečnostního monitoringu (core_security_settings) -
 * singleton nastavení, stejný vzor jako WebSiteSettingController pro web maintenance.
 *
 * @bugfix-note (2026-08-22) `update()` musí vracet výsledek obalený v `{data: ...}` -
 * frontendový `DataHandler.put<T>()` automaticky odbaluje `response.data` (viz
 * data-handler.service.ts). `show()` naopak zůstává NEobalené, protože se volá přes
 * `DataHandler.get<T>()`, který žádné odbalování nedělá. Bez tohoto rozlišení by po
 * uložení retence přišlo z `saveRetention()` `undefined` misto aktuální hodnoty.
 *
 * @refactor-note (2026-08-22v2) AUDITNÍ LOG: `update()` teď zapisuje do `core_logs`
 * (přes `LogsActivity` trait, stejně jako `AuthController` apod.) - kdo a kdy změnil
 * retenční dobu bezpečnostního monitoringu, včetně staré i nové hodnoty. Tohle je
 * odlišné od `core_security_events` (diagnostika podezřelé aktivity) - jde o audit
 * administrátorské akce nad samotným monitoringem.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\CoreSecuritySetting\UpdateCoreSecuritySettingRequest;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreSecuritySetting;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;

class CoreSecuritySettingController extends Controller
{
    use LogsActivity;

    public function show(): JsonResponse
    {
        return response()->json(CoreSecuritySetting::current());
    }

    public function update(UpdateCoreSecuritySettingRequest $request): JsonResponse
    {
        $setting = CoreSecuritySetting::current();
        $previousRetention = $setting->retention_days;

        $setting->update($request->validated());

        $this->logAction(
            $request,
            CoreLog::class,
            'security_retention_updated',
            'Core',
            "Retenční doba bezpečnostního monitoringu změněna z {$previousRetention} na {$setting->retention_days} dní.",
            $setting->id,
            'CoreSecuritySetting'
        );

        // Obal {data: ...} - viz bugfix-note výše (DataHandler.put() unwrap).
        return response()->json(['data' => $setting]);
    }
}