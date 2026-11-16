<?php

/**
 * @file VersionController.php
 * @path app/Http/Controllers/Api/VersionController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public endpoint with the release of the running code (`{"version":"v2026.11.1"}`).
 * The deploy smoke test compares it with the deployed release; support sees which release a
 * client runs. Only the release tag - no PHP / Laravel / package versions.
 * @dependencies
 * - config('app.version'): env APP_VERSION, set by the production image.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class VersionController extends Controller
{
    /**
     * @description Returns the release; never cached by the browser or a proxy (it changes with
     * every deploy).
     * @return JsonResponse {version: string}
     */
    public function __invoke(): JsonResponse
    {
        return response()
            ->json(['version' => (string) config('app.version')])
            ->header('Cache-Control', 'no-store');
    }
}
