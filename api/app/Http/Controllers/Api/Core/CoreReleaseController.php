<?php

/**
 * @file CoreReleaseController.php
 * @path app/Http/Controllers/Api/Core/CoreReleaseController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Release notes of the running installation (App\Support\Changelog\Changelog):
 *   - index (admin, every signed-in user - page Core → Releases, the version in the sidebar and
 *     the notice after an update): the releases up to the running version with the changes of
 *     the core and of the applications the user may open (tab permission; the sysadmin all);
 *   - publicIndex (no sign-in): the public changes of ONE application - only when its manifest
 *     enables publicChangelog() (off for the web, the e-shop and the project portal), else 404.
 * @dependencies Changelog, AppRegistry / AppManifest (tabPermission, publicChangelog),
 *   config app.version.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Support\Apps\AppManifest;
use App\Support\Apps\AppRegistry;
use App\Support\Changelog\Changelog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class CoreReleaseController extends Controller
{
    /**
     * @description Releases of the core and of the user's applications.
     * @param Request $request Signed-in user.
     * @param Changelog $changelog
     * @return JsonResponse { data: { current: string, releases: [{ version, date,
     *   changes: [{ type, area, part, text, ref? }] }] } }
     */
    public function index(Request $request, Changelog $changelog): JsonResponse
    {
        $user = $request->user();
        $permissions = $user->roles()->where('role_name', 'sysadmin')->exists() ? null : ($user->permissions ?? []);
        $apps = array_filter(AppRegistry::apps(), fn (AppManifest $app) => $permissions === null || in_array($app->tabPermission(), $permissions, true));
        $areas = [Changelog::CORE, ...array_values(array_map(fn (AppManifest $app) => $app->id(), $apps))];

        return $this->respond($this->payload($changelog, $areas, null));
    }

    /**
     * @description Public changes of one application that publishes its changelog.
     * @param string $app Application id.
     * @param Changelog $changelog
     * @return JsonResponse Same shape as index (only the part `public` of the application); 404
     *   when the application does not exist or does not publish its changelog.
     */
    public function publicIndex(string $app, Changelog $changelog): JsonResponse
    {
        $manifest = AppRegistry::app($app);
        abort_if($manifest === null || !$manifest->publicChangelog(), 404);

        return $this->respond($this->payload($changelog, [$manifest->id()], 'public'));
    }

    /**
     * @description Running version + its releases; a broken changelog file is logged and gives
     *   an empty list (the pages keep working).
     * @param Changelog $changelog
     * @param list<string> $areas
     * @param string|null $part
     * @return array{current: string, releases: list<array<string, mixed>>}
     */
    private function payload(Changelog $changelog, array $areas, ?string $part): array
    {
        $current = (string) config('app.version');
        try {
            $releases = $changelog->releasesFor($areas, $part, $current);
        } catch (RuntimeException $e) {
            Log::error('Changelog cannot be read', ['error' => $e->getMessage()]);
            $releases = [];
        }

        return ['current' => $current, 'releases' => $releases];
    }
}
