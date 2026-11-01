<?php
/**
 * @file CoreSecuritySettingController.php
 * @path app/Http/Controllers/Api/Core/CoreSecuritySettingController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Management of security monitoring retention period (core_security_settings) -
 * singleton setting, same pattern as WebSiteSettingController for web maintenance.
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
        return $this->respond(CoreSecuritySetting::current());
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

        // Wrapper {data: ...} - DataHandler.put() unwraps it on the frontend.
        return $this->respond($setting);
    }
}