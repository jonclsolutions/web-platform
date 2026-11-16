<?php
/**
 * @file CoreAppStatusController.php
 * @path app/Http/Controllers/Api/Core/CoreAppStatusController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Status overview of the applications (admin: core/apps) - read only. For every
 *   registered application the user may open (its tab permission; the sysadmin sees all):
 *   - availability: online / maintenance and the maintenance text (AppManifest::availability(),
 *     read fresh from the database, null = the application has no switch);
 *   - a light diagnosis from the application's own data: response time of its database reads,
 *     entries of its audit log in the last 24 hours (load), errors among them and the last one;
 *   - health: `error` (its data cannot be read), `offline` (maintenance), `warning` (errors in
 *     the last 24 hours or a slow database), else `ok`.
 * @note Switching an application on / off stays with the application (web/settings,
 *   shop/settings, project-portal/maintenance - each with its own permission and password check).
 * @dependencies AppRegistry / AppManifest (availability, logModel, tabPermission), App\Models\User.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Support\Apps\AppManifest;
use App\Support\Apps\AppRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Throwable;

class CoreAppStatusController extends Controller
{
    /** @description Database reads slower than this (ms) mark the application `warning`. */
    public const SLOW_MS = 1000;

    /** @description Event type of an error in the audit logs of the applications. */
    private const ERROR_EVENT = 'error';

    /**
     * @description Status of the applications the user may open.
     * @param Request $request Signed-in user.
     * @return JsonResponse { data: [{ id, health, active, maintenance_message,
     *   diagnostics: { response_ms, activity_24h, errors_24h, last_activity_at, last_error_at } | null,
     *   checked_at }] }
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $permissions = $user->roles()->where('role_name', 'sysadmin')->exists() ? null : ($user->permissions ?? []);

        $apps = array_filter(AppRegistry::apps(), fn (AppManifest $app) => $permissions === null || in_array($app->tabPermission(), $permissions, true));

        return $this->respond(array_values(array_map(fn (AppManifest $app) => $this->status($app), $apps)));
    }

    /**
     * @description Availability and diagnosis of one application; a failing read gives `error`
     *   (the reason only goes to the server log).
     * @param AppManifest $app
     * @return array<string, mixed>
     */
    private function status(AppManifest $app): array
    {
        $started = hrtime(true);
        try {
            $availability = $app->availability();
            $log = $app->logModel();
            $since = now()->subDay();
            $activity = $log::query()->where('created_at', '>=', $since)->count();
            $errors = $log::query()->where('created_at', '>=', $since)->where('event_type', self::ERROR_EVENT)->count();
            $lastActivity = $log::query()->max('created_at');
            $lastError = $log::query()->where('event_type', self::ERROR_EVENT)->max('created_at');
            $ms = (int) round((hrtime(true) - $started) / 1e6);
        } catch (Throwable $e) {
            Log::warning('Application status check failed', ['app' => $app->id(), 'error' => $e->getMessage()]);

            return ['id' => $app->id(), 'health' => 'error', 'active' => null, 'maintenance_message' => null, 'diagnostics' => null, 'checked_at' => now()->toIso8601String()];
        }

        $active = $availability?->active;
        $health = match (true) {
            $active === false => 'offline',
            $errors > 0 || $ms > self::SLOW_MS => 'warning',
            default => 'ok',
        };

        return [
            'id'                  => $app->id(),
            'health'              => $health,
            'active'              => $active,
            'maintenance_message' => $availability?->message,
            'diagnostics'         => [
                'response_ms'      => $ms,
                'activity_24h'     => $activity,
                'errors_24h'       => $errors,
                'last_activity_at' => $this->iso($lastActivity),
                'last_error_at'    => $this->iso($lastError),
            ],
            'checked_at'          => now()->toIso8601String(),
        ];
    }

    /**
     * @description ISO 8601 of a database timestamp (null stays null).
     * @param mixed $value
     * @return string|null
     */
    private function iso(mixed $value): ?string
    {
        return $value === null ? null : Carbon::parse($value)->toIso8601String();
    }
}
