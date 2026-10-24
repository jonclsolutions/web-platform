<?php
/**
 * @file WebPublicController.php
 * @path app/Http/Controllers/Api/Web/WebPublicController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Public (unauthenticated) status endpoint used by `webMaintenanceGuard` on
 * the frontend to decide whether to redirect visitors to the web maintenance page. Mirror
 * of ShopPublicController::getStatus() for the web section.
 *
 * @refactor-note (2026-08-15) `getStatus()` repointed from `App\Models\Core\CoreSiteSetting`
 * (table dropped) to `App\Models\Web\WebSiteSetting` following the move of web maintenance
 * data out of the Core domain - see WebSiteSettingController for the accompanying admin
 * endpoint. Cache key unchanged; since 2026-10-24 the answer is `{data: {is_web_active}}` (finding #6).
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebSiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class WebPublicController extends Controller
{
    /**
     * @description Returns the current public-web active/maintenance status.
     * @return JsonResponse
     */
    public function getStatus(): JsonResponse
    {
        $settings = Cache::remember('site_setting_active_web', 300, function () {
            return WebSiteSetting::firstOrCreate(
                ['id' => 1],
                ['is_web_active' => true, 'web_maintenance_message' => 'We apologize, the website is currently undergoing maintenance.']
            );
        });

        return $this->respond([
            'is_web_active' => (bool) $settings->is_web_active,
        ]);
    }
}