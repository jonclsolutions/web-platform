<?php
/**
 * @file CoreRetentionSettingController.php
 * @path app/Http/Controllers/Api/Core/CoreRetentionSettingController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Retention periods of the personal data (core_retention_settings, GDPR storage
 * limitation) - list, change, and an immediate run of the purge that otherwise runs daily
 * (`retention:purge`, RetentionPurgeService).
 * @security Every change and every manual run is written to the core log (who, what) - counts
 * only, no personal data.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\CoreRetentionSetting\UpdateCoreRetentionSettingRequest;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreRetentionSetting;
use App\Services\Retention\RetentionPurgeService;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CoreRetentionSettingController extends Controller
{
    use LogsActivity;

    /**
     * @description Every retention setting in the admin order.
     * @return JsonResponse { data: CoreRetentionSetting[] }
     */
    public function index(): JsonResponse
    {
        return $this->respond(CoreRetentionSetting::allInOrder());
    }

    /**
     * @description Stores the changed periods and logs every change.
     * @param UpdateCoreRetentionSettingRequest $request { settings: [{data_key, retention_days}] }.
     * @return JsonResponse { data: CoreRetentionSetting[] }
     */
    public function update(UpdateCoreRetentionSettingRequest $request): JsonResponse
    {
        $rows = collect(CoreRetentionSetting::allInOrder())->keyBy('data_key');

        foreach ($request->validated('settings') as $item) {
            $setting = $rows[$item['data_key']];
            $previous = $setting->retention_days;
            $setting->update(['retention_days' => $item['retention_days']]);

            if ($previous !== $setting->retention_days) {
                $this->logAction(
                    $request, CoreLog::class, 'retention_updated', 'Core',
                    sprintf('Retention of %s changed from %s to %s days.', $setting->data_key, $previous ?? 'off', $setting->retention_days ?? 'off'),
                    $setting->id, 'CoreRetentionSetting'
                );
            }
        }

        return $this->respond(CoreRetentionSetting::allInOrder());
    }

    /**
     * @description Runs the retention purge at once (the same as the daily command).
     * @param Request $request Admin request.
     * @param RetentionPurgeService $service The purge.
     * @return JsonResponse { data: { deleted: {key: count|null}, settings: CoreRetentionSetting[] } }
     */
    public function purge(Request $request, RetentionPurgeService $service): JsonResponse
    {
        $deleted = $service->purgeAll();

        $this->logAction(
            $request, CoreLog::class, 'retention_purge', 'Core',
            'Retention purge run by hand: ' . json_encode($deleted), null, 'CoreRetentionSetting'
        );

        return $this->respond(['deleted' => $deleted, 'settings' => CoreRetentionSetting::allInOrder()]);
    }
}
