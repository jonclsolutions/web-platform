<?php
/**
 * @file CoreSecuritySettingController.php
 * @path app/Http/Controllers/Api/Core/CoreSecuritySettingController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Management of security monitoring retention period (core_security_settings) -
 * singleton setting, same pattern as WebSiteSettingController for web maintenance.
 *
 * @bugfix-note (2026-08-22) `update()` must return the result wrapped in `{data: ...}` -
 * frontend `DataHandler.put<T>()` automatically unwraps `response.data` (see
 * data-handler.service.ts). `show()` on the other hand remains UNWRAPPED because it is called via
 * `DataHandler.get<T>()`, which does no unwrapping. Without this distinction, after
 * saving the retention, `saveRetention()` would receive `undefined` instead of the current value.
 *
 * @refactor-note (2026-08-22v2) AUDIT LOG: `update()` now writes to `core_logs`
 * (via `LogsActivity` trait, just like `AuthController` etc.) - who and when changed
 * the security monitoring retention period, including the old and new values. This is
 * different from `core_security_events` (suspicious activity diagnostics) - it's an audit of
 * the administrator's action over the monitoring itself.
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
            "Security monitoring retention period changed from {$previousRetention} to {$setting->retention_days} days.",
            $setting->id,
            'CoreSecuritySetting'
        );

        // Wrapper {data: ...} - see bugfix-note above (DataHandler.put() unwrap).
        return response()->json(['data' => $setting]);
    }
}