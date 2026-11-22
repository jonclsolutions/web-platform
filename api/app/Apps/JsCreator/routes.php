<?php

/**
 * @file routes.php
 * @path app/Apps/JsCreator/routes.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description API endpoints of the application "JS Creator". Loaded by routes/api.php inside the
 *   `api` prefix (AppManifest::routesFile()), so every path here is below /api.
 *   - `js-creator/…` (signed-in accounts): the OWN workspace - usage, folders, library images and
 *     fonts (every controller limits its queries to the signed-in account), the settings
 *     (quotas) and the audit log. The shared parts of the workspace need the action in any
 *     section (JsCreatorSections::any()).
 *   - `js-creator/<section>/templates` (one route group per section of JsCreatorSections, the
 *     section is passed to the controller): templates with the permissions of their section.
 *   - `js-creator/files/…`: files of a workspace, only through the signed URLs issued to their
 *     owner (WorkspaceFiles).
 * @dependencies the controllers of the application; middleware `auth:sanctum`, `permission`,
 *   `signed`, `throttle`.
 */

use App\Apps\JsCreator\Http\Controllers\AssetController;
use App\Apps\JsCreator\Http\Controllers\FileController;
use App\Apps\JsCreator\Http\Controllers\FolderController;
use App\Apps\JsCreator\Http\Controllers\FontController;
use App\Apps\JsCreator\Http\Controllers\JsCreatorLogController;
use App\Apps\JsCreator\Http\Controllers\SettingsController;
use App\Apps\JsCreator\Http\Controllers\TemplateController;
use App\Apps\JsCreator\Http\Controllers\UsageController;
use App\Apps\JsCreator\Support\JsCreatorSections;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'throttle:300,1'])->prefix('js-creator')->group(function () {
    $view = 'permission:' . JsCreatorSections::any('view');
    $create = 'permission:' . JsCreatorSections::any('create');
    $update = 'permission:' . JsCreatorSections::any('update');
    $delete = 'permission:' . JsCreatorSections::any('delete');
    $upload = 'throttle:60,1,js-creator-upload';

    // ── js-creator/usage (usage bar of the own workspace) ────────────────────────
    Route::get('usage', [UsageController::class, 'show'])->middleware($view);

    // ── js-creator/folders (one tree for every section) ──────────────────────────
    Route::get('folders', [FolderController::class, 'index'])->middleware($view);
    Route::post('folders', [FolderController::class, 'store'])->middleware($create);
    Route::delete('folders/trash', [FolderController::class, 'emptyTrash'])->middleware($delete);
    Route::put('folders/{id}', [FolderController::class, 'update'])->middleware($update)->whereNumber('id');
    Route::delete('folders/{id}', [FolderController::class, 'destroy'])->middleware($delete)->whereNumber('id');
    Route::post('folders/{id}/restore', [FolderController::class, 'restore'])->middleware($delete)->whereNumber('id');

    // ── js-creator/library/assets (images of the library) ────────────────────────
    Route::get('library/assets', [AssetController::class, 'index'])->middleware($view);
    Route::post('library/assets', [AssetController::class, 'store'])->middleware([$create, $upload]);
    Route::delete('library/assets/trash', [AssetController::class, 'emptyTrash'])->middleware($delete);
    Route::put('library/assets/{id}', [AssetController::class, 'update'])->middleware($update)->whereNumber('id');
    Route::delete('library/assets/{id}', [AssetController::class, 'destroy'])->middleware($delete)->whereNumber('id');
    Route::post('library/assets/{id}/restore', [AssetController::class, 'restore'])->middleware($delete)->whereNumber('id');

    // ── js-creator/library/fonts (own fonts) ─────────────────────────────────────
    Route::get('library/fonts', [FontController::class, 'index'])->middleware($view);
    Route::post('library/fonts', [FontController::class, 'store'])->middleware([$create, $upload]);
    Route::delete('library/fonts/trash', [FontController::class, 'emptyTrash'])->middleware($delete);
    Route::put('library/fonts/{id}', [FontController::class, 'update'])->middleware($update)->whereNumber('id');
    Route::delete('library/fonts/{id}', [FontController::class, 'destroy'])->middleware($delete)->whereNumber('id');
    Route::post('library/fonts/{id}/restore', [FontController::class, 'restore'])->middleware($delete)->whereNumber('id');

    // ── js-creator/<section>/templates (templates of each section) ───────────────
    foreach (JsCreatorSections::SECTIONS as $section) {
        $can = fn (string $action) => 'permission:' . JsCreatorSections::permission($section, $action);
        Route::prefix("{$section}/templates")->group(function () use ($section, $can, $upload) {
            Route::get('', [TemplateController::class, 'index'])->middleware($can('view'))->defaults('section', $section);
            Route::post('', [TemplateController::class, 'store'])->middleware($can('create'))->defaults('section', $section);
            Route::delete('trash', [TemplateController::class, 'emptyTrash'])->middleware($can('delete'))->defaults('section', $section);
            Route::get('{id}', [TemplateController::class, 'show'])->middleware($can('view'))->whereNumber('id')->defaults('section', $section);
            Route::put('{id}', [TemplateController::class, 'update'])->middleware($can('update'))->whereNumber('id')->defaults('section', $section);
            Route::post('{id}/thumbnail', [TemplateController::class, 'thumbnail'])->middleware([$can('update'), $upload])->whereNumber('id')->defaults('section', $section);
            Route::post('{id}/duplicate', [TemplateController::class, 'duplicate'])->middleware($can('create'))->whereNumber('id')->defaults('section', $section);
            Route::delete('{id}', [TemplateController::class, 'destroy'])->middleware($can('delete'))->whereNumber('id')->defaults('section', $section);
            Route::post('{id}/restore', [TemplateController::class, 'restore'])->middleware($can('delete'))->whereNumber('id')->defaults('section', $section);
        });
    }

    // ── js-creator/settings (default and individual quotas) ──────────────────────
    Route::get('settings', [SettingsController::class, 'show'])->middleware('permission:js-creator-settings-view');
    Route::put('settings', [SettingsController::class, 'update'])->middleware('permission:js-creator-settings-update');
    Route::get('settings/users', [SettingsController::class, 'users'])->middleware('permission:js-creator-settings-view');
    Route::put('settings/users/{id}/quota', [SettingsController::class, 'updateQuota'])->middleware('permission:js-creator-settings-update')->whereNumber('id');

    // ── js-creator/logs (audit log of the application) ───────────────────────────
    Route::get('logs', [JsCreatorLogController::class, 'index'])->middleware('permission:js-creator-view-logs');
    Route::get('logs/{id}', [JsCreatorLogController::class, 'show'])->middleware('permission:js-creator-view-logs');
});

// ── js-creator/files (signed URLs of WorkspaceFiles only; relative signature) ───────
Route::get('js-creator/files/assets/{id}/{variant}', [FileController::class, 'asset'])
    ->middleware('signed:relative')->whereNumber('id')->whereIn('variant', ['original', 'thumb'])
    ->name('js-creator.files.asset');
Route::get('js-creator/files/fonts/{id}', [FileController::class, 'font'])
    ->middleware('signed:relative')->whereNumber('id')
    ->name('js-creator.files.font');
Route::get('js-creator/files/templates/{id}', [FileController::class, 'template'])
    ->middleware('signed:relative')->whereNumber('id')
    ->name('js-creator.files.template');
