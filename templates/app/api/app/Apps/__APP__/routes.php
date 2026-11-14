<?php

/**
 * @file routes.php
 * @path app/Apps/__APP__/routes.php
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description API endpoints of the application "__NAME__". Loaded by routes/api.php inside the
 *   `api` prefix (AppManifest::routesFile()), so every path here is below /api. The
 *   administration lives below `__app__/…` (signed-in users, every route checks its
 *   permission); public endpoints, if any, below `__app__/public/…` with a throttle.
 * @dependencies __APP__LogController; middleware `auth:sanctum`, `permission`.
 */

use App\Apps\__APP__\Http\Controllers\__APP__LogController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'throttle:300,1'])->prefix('__app__')->group(function () {
    // ── __app__/logs (audit log of the application) ────────────────────────
    Route::get('logs', [__APP__LogController::class, 'index'])->middleware('permission:__app__-view-logs');
    Route::get('logs/{id}', [__APP__LogController::class, 'show'])->middleware('permission:__app__-view-logs');
});
