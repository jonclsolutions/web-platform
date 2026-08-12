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
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreSiteSetting;
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
            return CoreSiteSetting::firstOrCreate(
                ['id' => 1],
                ['is_web_active' => true, 'web_maintenance_message' => 'Omlouváme se, web je momentálně v údržbě.']
            );
        });

        return response()->json([
            'is_web_active' => (bool) $settings->is_web_active,
        ]);
    }
}