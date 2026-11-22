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
 *   - `js-creator/<section>/templates`, `…/blocks`, `…/sets` and `…/outputs` (one route group per
 *     section of JsCreatorSections, the section is passed to the controller): templates, blocks,
 *     sets, generating and export / import (one JSON file) with the permissions of their section.
 *   - `js-creator/outputs`: the outputs of every section in one list; each output needs the
 *     permission of its section (OutputController).
 *   - `js-creator/files/…`: files of a workspace (and ZIPs of outputs), only through the signed
 *     URLs issued to their owner (WorkspaceFiles).
 * @note The limit of the whole group has its own name (`js-creator`): an unnamed `throttle:N,1`
 *   shares one counter per account with every other unnamed limit of the API (e.g. the 60 / min
 *   of the notifications of the core), so working in JS Creator would use them up.
 * @dependencies the controllers of the application; middleware `auth:sanctum`, `permission`,
 *   `signed`, `throttle`.
 */

use App\Apps\JsCreator\Http\Controllers\AssetController;
use App\Apps\JsCreator\Http\Controllers\BlockController;
use App\Apps\JsCreator\Http\Controllers\FileController;
use App\Apps\JsCreator\Http\Controllers\FolderController;
use App\Apps\JsCreator\Http\Controllers\FontController;
use App\Apps\JsCreator\Http\Controllers\JsCreatorLogController;
use App\Apps\JsCreator\Http\Controllers\OutputController;
use App\Apps\JsCreator\Http\Controllers\SetController;
use App\Apps\JsCreator\Http\Controllers\SettingsController;
use App\Apps\JsCreator\Http\Controllers\TemplateController;
use App\Apps\JsCreator\Http\Controllers\TransferController;
use App\Apps\JsCreator\Http\Controllers\UsageController;
use App\Apps\JsCreator\Support\JsCreatorSections;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'throttle:300,1,js-creator'])->prefix('js-creator')->group(function () {
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

    // ── js-creator/library/assets (images and own icons of the library, `kind`) ─────
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

    // ── js-creator/outputs (outputs of every section; each needs its section permission) ──
    Route::get('outputs', [OutputController::class, 'index'])->middleware($view);
    Route::delete('outputs/trash', [OutputController::class, 'emptyTrash'])->middleware($delete);
    Route::post('outputs/bulk', [OutputController::class, 'bulk'])
        ->middleware('permission:' . JsCreatorSections::any('update') . '|' . JsCreatorSections::any('delete'))->name('js-creator.outputs.bulk');
    Route::post('outputs/zip', [OutputController::class, 'zip'])->middleware([$view, 'throttle:20,1,js-creator-zip'])->name('js-creator.outputs.zip');
    Route::put('outputs/{id}', [OutputController::class, 'update'])->middleware($update)->whereNumber('id');
    Route::delete('outputs/{id}', [OutputController::class, 'destroy'])->middleware($delete)->whereNumber('id');
    Route::post('outputs/{id}/restore', [OutputController::class, 'restore'])->middleware($delete)->whereNumber('id');

    // ── js-creator/<section>/templates (templates of each section) ───────────────
    // ── js-creator/<section>/blocks (blocks of each section) ──────────────────────
    // ── js-creator/<section>/sets (sets of templates of each section) ─────────────
    // ── js-creator/<section>/outputs (generating from a template of the section) ─
    // ── js-creator/<section>/export, …/import (templates, blocks, sets as one JSON file) ─
    foreach (JsCreatorSections::SECTIONS as $section) {
        $can = fn (string $action) => 'permission:' . JsCreatorSections::permission($section, $action);
        Route::post("{$section}/outputs", [OutputController::class, 'store'])->middleware([$can('create'), $upload])->defaults('section', $section);
        Route::post("{$section}/export", [TransferController::class, 'export'])->middleware([$can('view'), 'throttle:30,1,js-creator-export'])->defaults('section', $section);
        Route::post("{$section}/import", [TransferController::class, 'import'])->middleware([$can('create'), $upload])->defaults('section', $section);
        Route::prefix("{$section}/templates")->group(function () use ($section, $can, $upload) {
            Route::get('', [TemplateController::class, 'index'])->middleware($can('view'))->defaults('section', $section);
            Route::post('', [TemplateController::class, 'store'])->middleware($can('create'))->defaults('section', $section);
            Route::delete('trash', [TemplateController::class, 'emptyTrash'])->middleware($can('delete'))->defaults('section', $section);
            Route::post('bulk', [TemplateController::class, 'bulk'])->middleware($can('delete'))->defaults('section', $section);
            Route::get('{id}', [TemplateController::class, 'show'])->middleware($can('view'))->whereNumber('id')->defaults('section', $section);
            Route::put('{id}', [TemplateController::class, 'update'])->middleware($can('update'))->whereNumber('id')->defaults('section', $section);
            Route::post('{id}/thumbnail', [TemplateController::class, 'thumbnail'])->middleware([$can('update'), $upload])->whereNumber('id')->defaults('section', $section);
            Route::post('{id}/duplicate', [TemplateController::class, 'duplicate'])->middleware($can('create'))->whereNumber('id')->defaults('section', $section);
            Route::delete('{id}', [TemplateController::class, 'destroy'])->middleware($can('delete'))->whereNumber('id')->defaults('section', $section);
            Route::post('{id}/restore', [TemplateController::class, 'restore'])->middleware($can('delete'))->whereNumber('id')->defaults('section', $section);
        });
        Route::prefix("{$section}/blocks")->group(function () use ($section, $can, $upload) {
            Route::get('', [BlockController::class, 'index'])->middleware($can('view'))->defaults('section', $section);
            Route::post('', [BlockController::class, 'store'])->middleware($can('create'))->defaults('section', $section);
            Route::delete('trash', [BlockController::class, 'emptyTrash'])->middleware($can('delete'))->defaults('section', $section);
            Route::post('bulk', [BlockController::class, 'bulk'])->middleware($can('delete'))->defaults('section', $section);
            Route::get('{id}', [BlockController::class, 'show'])->middleware($can('view'))->whereNumber('id')->defaults('section', $section);
            Route::put('{id}', [BlockController::class, 'update'])->middleware($can('update'))->whereNumber('id')->defaults('section', $section);
            Route::post('{id}/thumbnail', [BlockController::class, 'thumbnail'])->middleware([$can('update'), $upload])->whereNumber('id')->defaults('section', $section);
            Route::post('{id}/duplicate', [BlockController::class, 'duplicate'])->middleware($can('create'))->whereNumber('id')->defaults('section', $section);
            Route::delete('{id}', [BlockController::class, 'destroy'])->middleware($can('delete'))->whereNumber('id')->defaults('section', $section);
            Route::post('{id}/restore', [BlockController::class, 'restore'])->middleware($can('delete'))->whereNumber('id')->defaults('section', $section);
        });
        Route::prefix("{$section}/sets")->group(function () use ($section, $can) {
            Route::get('', [SetController::class, 'index'])->middleware($can('view'))->defaults('section', $section);
            Route::post('', [SetController::class, 'store'])->middleware($can('create'))->defaults('section', $section);
            Route::delete('trash', [SetController::class, 'emptyTrash'])->middleware($can('delete'))->defaults('section', $section);
            Route::post('bulk', [SetController::class, 'bulk'])->middleware($can('delete'))->defaults('section', $section);
            Route::get('{id}', [SetController::class, 'show'])->middleware($can('view'))->whereNumber('id')->defaults('section', $section);
            Route::put('{id}', [SetController::class, 'update'])->middleware($can('update'))->whereNumber('id')->defaults('section', $section);
            Route::delete('{id}', [SetController::class, 'destroy'])->middleware($can('delete'))->whereNumber('id')->defaults('section', $section);
            Route::post('{id}/restore', [SetController::class, 'restore'])->middleware($can('delete'))->whereNumber('id')->defaults('section', $section);
        });
    }

    // ── js-creator/settings (default and individual quotas) ──────────────────────
    Route::get('settings', [SettingsController::class, 'show'])->middleware('permission:js-creator-settings-view');
    Route::put('settings', [SettingsController::class, 'update'])->middleware('permission:js-creator-settings-update');
    Route::get('settings/users', [SettingsController::class, 'users'])->middleware('permission:js-creator-settings-view');
    Route::put('settings/users/{id}/quota', [SettingsController::class, 'updateQuota'])->middleware('permission:js-creator-settings-update')->whereNumber('id');

    // ── js-creator/logs (audit log of the application) ───────────────────────────
    Route::get('logs', [JsCreatorLogController::class, 'index'])->middleware('permission:js-creator-view-logs');
    Route::get('logs/{id}', [JsCreatorLogController::class, 'show'])->middleware('permission:js-creator-view-logs')->whereNumber('id');
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
Route::get('js-creator/files/blocks/{id}', [FileController::class, 'block'])
    ->middleware('signed:relative')->whereNumber('id')
    ->name('js-creator.files.block');
Route::get('js-creator/files/outputs/{id}/{variant}', [FileController::class, 'output'])
    ->middleware('signed:relative')->whereNumber('id')->whereIn('variant', ['original', 'thumb', 'download'])
    ->name('js-creator.files.output');
Route::get('js-creator/files/zip', [FileController::class, 'zip'])
    ->middleware(['signed:relative', 'throttle:20,1,js-creator-zip-file'])
    ->name('js-creator.files.zip');
