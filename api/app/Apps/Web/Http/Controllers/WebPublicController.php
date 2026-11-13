<?php
/**
 * @file WebPublicController.php
 * @path app/Apps/Web/Http/Controllers/WebPublicController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public (unauthenticated) status endpoint used by `webMaintenanceGuard` on
 * the frontend to decide whether to redirect visitors to the web maintenance page. Mirror
 * of ShopPublicController::getStatus() for the web section.
 */

namespace App\Apps\Web\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\Web\Models\WebSiteSetting;
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