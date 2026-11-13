<?php

/**
 * @file routes.php
 * @path app/Apps/Web/routes.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description API endpoints of the web application: the public website (status, FAQ, jobs,
 *   references, the order-form link of a lead, the contact / order / job forms) and the
 *   administration (web/..., signed-in users with permissions). Loaded by routes/api.php inside
 *   the `api` prefix (AppManifest::routesFile()), so every path here is below /api.
 * @dependencies
 * - App\Apps\Web\Http\Controllers\*; core PageTitleController (browser titles of the web pages);
 *   middleware `web.active` (WebApp::middlewareAliases()), core `public.form`, `auth:sanctum`,
 *   `permission`; named rate limiter `public-form`.
 */

use App\Apps\Web\Http\Controllers\WebFaqController;
use App\Apps\Web\Http\Controllers\WebJobApplicationController;
use App\Apps\Web\Http\Controllers\WebJobController;
use App\Apps\Web\Http\Controllers\WebLogController;
use App\Apps\Web\Http\Controllers\WebPublicController;
use App\Apps\Web\Http\Controllers\WebRawRequestCommissionController;
use App\Apps\Web\Http\Controllers\WebReferenceController;
use App\Apps\Web\Http\Controllers\WebSalesLeadController;
use App\Apps\Web\Http\Controllers\WebSalesOrderController;
use App\Apps\Web\Http\Controllers\WebSiteSettingController;
use App\Http\Controllers\Api\Legal\PageTitleController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| PUBLIC WEB STATUS
|--------------------------------------------------------------------------
*/
Route::get('web/public/status', [WebPublicController::class, 'getStatus']);

/*
|--------------------------------------------------------------------------
| PUBLIC SALES LEADS — resolve by unguessable token (order form prefill)
|--------------------------------------------------------------------------
| OrderFormComponent prefills the form from the link the salesman sent to the lead
| (WebSalesLeadController::generateLink in the protected section). NEVER add access by the
| internal `id` here - only by `token`.
*/
Route::prefix('public')->middleware('web.active')->group(function () {
    Route::get('sales-leads/{token}', [WebSalesLeadController::class, 'showByToken'])->middleware('throttle:30,1,sales-lead-token');
});

/*
|--------------------------------------------------------------------------
| PUBLIC FAQ, OPEN POSITIONS AND REFERENCES — content of the public website (edited in web/edit-website)
|--------------------------------------------------------------------------
*/
Route::prefix('public/web')->middleware(['web.active', 'throttle:60,1,public-web-content'])->group(function () {
    Route::get('faq',  [WebFaqController::class, 'publicIndex']);
    Route::get('jobs', [WebJobController::class, 'publicIndex']);
    Route::get('references', [WebReferenceController::class, 'publicIndex']);
});

// Public web forms - per-IP limit (named limiter `public-form`), then the quota per recipient
// e-mail and the Turnstile captcha (PublicFormGuard). The admin creates the same records through
// the authenticated routes below (web/...), which have none of these checks.
Route::post('raw_request_commissions', [WebRawRequestCommissionController::class, 'store'])
    ->middleware(['web.active', 'throttle:public-form', 'public.form:raw_request,contact_email']);
Route::post('sales_orders', [WebSalesOrderController::class, 'store'])
    ->middleware(['web.active', 'throttle:public-form', 'public.form:sales_order,client_email']);
Route::post('job_applications',        [WebJobApplicationController::class, 'store'])
    ->middleware(['web.active', 'throttle:public-form', 'public.form:job_application,email']);

/*
|--------------------------------------------------------------------------
| ADMINISTRATION (signed-in users; every route checks its permission)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:300,1'])->group(function () {
    Route::prefix('web')->group(function () {

        // Browser titles of the web pages (web/edit-website).
        Route::get('/page-titles', [PageTitleController::class, 'index'])
            ->defaults('area', 'web')
            ->middleware('permission:web-edit-website-view');
        Route::put('/page-titles', [PageTitleController::class, 'update'])
            ->defaults('area', 'web')
            ->middleware('permission:web-edit-website-update');

        // FAQ and open positions of the public website (web/edit-website, tabs FAQ / Jobs).
        Route::get('/faq', [WebFaqController::class, 'index'])
            ->middleware('permission:web-edit-website-view');
        Route::put('/faq', [WebFaqController::class, 'update'])
            ->middleware('permission:web-edit-website-update');
        Route::get('/jobs', [WebJobController::class, 'index'])
            ->middleware('permission:web-edit-website-view');
        Route::put('/jobs', [WebJobController::class, 'update'])
            ->middleware('permission:web-edit-website-update');
        // References (web/edit-website, tab References); the image of a saved reference on its own.
        Route::get('/references', [WebReferenceController::class, 'index'])
            ->middleware('permission:web-edit-website-view');
        Route::put('/references', [WebReferenceController::class, 'update'])
            ->middleware('permission:web-edit-website-update');
        Route::post('/references/{id}/image', [WebReferenceController::class, 'storeImage'])
            ->middleware(['permission:web-edit-website-update', 'throttle:30,1']);
        Route::delete('/references/{id}/image', [WebReferenceController::class, 'destroyImage'])
            ->middleware('permission:web-edit-website-update');

        Route::prefix('settings')->group(function () {
            Route::get('/', [WebSiteSettingController::class, 'show'])
                ->middleware('permission:web-set-maintenance-mode');
            Route::put('/', [WebSiteSettingController::class, 'update'])
                ->middleware('permission:web-set-maintenance-mode');
            Route::get('/raw-request-email-template', [WebSiteSettingController::class, 'showRawRequestEmailTemplate'])
                ->middleware('permission:web-user-requests-update');
            Route::put('/raw-request-email-template', [WebSiteSettingController::class, 'updateRawRequestEmailTemplate'])
                ->middleware('permission:web-user-requests-update');
            Route::get('/sales-order-email-template', [WebSiteSettingController::class, 'showSalesOrderEmailTemplate'])
                ->middleware('permission:web-sales-orders-update');
            Route::put('/sales-order-email-template', [WebSiteSettingController::class, 'updateSalesOrderEmailTemplate'])
                ->middleware('permission:web-sales-orders-update');
        });

        // ── web/job_applications ─────────────────────────────────────────
        Route::prefix('job_applications')->group(function () {
            Route::post('/bulk-delete', [WebJobApplicationController::class, 'bulkDestroy'])
                ->middleware('permission:web-job-applications-delete');
            Route::delete('/force-delete-all', [WebJobApplicationController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-job-applications-delete');
            Route::get('/',      [WebJobApplicationController::class, 'index'])
                ->middleware('permission:web-job-applications-view');
            Route::post('/',     [WebJobApplicationController::class, 'store'])
                ->middleware('permission:web-job-applications-create');
            Route::get('/{id}',  [WebJobApplicationController::class, 'show'])
                ->middleware('permission:web-job-applications-view');
            Route::put('/{id}',  [WebJobApplicationController::class, 'update'])
                ->middleware('permission:web-job-applications-update');
            Route::patch('/{id}', [WebJobApplicationController::class, 'update'])
                ->middleware('permission:web-job-applications-update');
            Route::post('/{id}/restore', [WebJobApplicationController::class, 'restore'])
                ->middleware('permission:web-job-applications-delete');
            Route::delete('/{id}', [WebJobApplicationController::class, 'destroy'])
                ->middleware('permission:web-job-applications-delete');
        });

        // web/logs
        Route::prefix('logs')->group(function () {
            Route::get('/',     [WebLogController::class, 'index'])
                ->middleware('permission:web-view-web-logs');
            Route::get('/{id}', [WebLogController::class, 'show'])
                ->middleware('permission:web-view-web-logs');
        });

        // ── web/raw_request_commissions ────────────────────────────────────
        // Bulk delete and import (the import sends no confirmation e-mail - see the header of
        // WebRawRequestCommissionController).
        Route::prefix('raw_request_commissions')->group(function () {
            Route::post('/bulk-delete', [WebRawRequestCommissionController::class, 'bulkDestroy'])
                ->middleware('permission:web-user-requests-delete');
            Route::get('/import/template', [WebRawRequestCommissionController::class, 'importTemplate'])
                ->middleware('permission:web-user-requests-create');
            Route::post('/import/validate', [WebRawRequestCommissionController::class, 'importValidate'])
                ->middleware(['throttle:30,1,import-raw-request-validate', 'permission:web-user-requests-create']);
            Route::post('/import/commit', [WebRawRequestCommissionController::class, 'importCommit'])
                ->middleware(['throttle:30,1,import-raw-request-commit', 'permission:web-user-requests-create']);
            Route::delete('/force-delete-all', [WebRawRequestCommissionController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-user-requests-delete');
            Route::get('/',      [WebRawRequestCommissionController::class, 'index'])
                ->middleware('permission:web-user-requests-view');
            Route::post('/',     [WebRawRequestCommissionController::class, 'store'])
                ->middleware('permission:web-user-requests-create');
            Route::get('/{id}',  [WebRawRequestCommissionController::class, 'show'])
                ->middleware('permission:web-user-requests-view');
            Route::put('/{id}',  [WebRawRequestCommissionController::class, 'update'])
                ->middleware('permission:web-user-requests-update');
            Route::patch('/{id}', [WebRawRequestCommissionController::class, 'update'])
                ->middleware('permission:web-user-requests-update');
            Route::post('/{id}/restore', [WebRawRequestCommissionController::class, 'restore'])
                ->middleware('permission:web-user-requests-delete');
            Route::delete('/{id}', [WebRawRequestCommissionController::class, 'destroy'])
                ->middleware('permission:web-user-requests-delete');
        });

        // ── web/sales_orders ───────────────────────────────────────────────
        // No import on purpose (WebSalesOrderController: atomic lead_token + GDPR consent cannot be
        // imported retroactively).
        Route::prefix('sales_orders')->group(function () {
            Route::post('/bulk-delete', [WebSalesOrderController::class, 'bulkDestroy'])
                ->middleware('permission:web-sales-orders-delete');
            Route::delete('/force-delete-all', [WebSalesOrderController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-sales-orders-delete');
            Route::get('/',      [WebSalesOrderController::class, 'index'])
                ->middleware('permission:web-sales-orders-view');
            Route::post('/',     [WebSalesOrderController::class, 'store'])
                ->middleware('permission:web-sales-orders-create');
            Route::get('/{id}',  [WebSalesOrderController::class, 'show'])
                ->middleware('permission:web-sales-orders-view');
            Route::put('/{id}',  [WebSalesOrderController::class, 'update'])
                ->middleware('permission:web-sales-orders-update');
            Route::patch('/{id}', [WebSalesOrderController::class, 'update'])
                ->middleware('permission:web-sales-orders-update');
            Route::post('/{id}/restore', [WebSalesOrderController::class, 'restore'])
                ->middleware('permission:web-sales-orders-delete');
            Route::delete('/{id}', [WebSalesOrderController::class, 'destroy'])
                ->middleware('permission:web-sales-orders-delete');
        });

        // ── web/sales_leads ────────────────────────────────────────────────
        Route::prefix('sales_leads')->group(function () {
            Route::post('/bulk-delete', [WebSalesLeadController::class, 'bulkDestroy'])
                ->middleware('permission:web-sales-leads-delete');
            Route::delete('/force-delete-all', [WebSalesLeadController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-sales-leads-delete');
                 Route::get('/import/template', [WebSalesLeadController::class, 'importTemplate'])
        ->middleware('permission:web-sales-leads-create');
    Route::post('/import/validate', [WebSalesLeadController::class, 'importValidate'])
        ->middleware(['throttle:30,1,import-sales-leads-validate', 'permission:web-sales-leads-create']);
    Route::post('/import/commit', [WebSalesLeadController::class, 'importCommit'])
        ->middleware(['throttle:30,1,import-sales-leads-commit', 'permission:web-sales-leads-create']);

            Route::get('/',      [WebSalesLeadController::class, 'index'])
                ->middleware('permission:web-sales-leads-view');
            Route::post('/',     [WebSalesLeadController::class, 'store'])
                ->middleware('permission:web-sales-leads-create');
            Route::get('/{id}',  [WebSalesLeadController::class, 'show'])
                ->middleware('permission:web-sales-leads-view');
            Route::put('/{id}',  [WebSalesLeadController::class, 'update'])
                ->middleware('permission:web-sales-leads-update');
            Route::patch('/{id}', [WebSalesLeadController::class, 'update'])
                ->middleware('permission:web-sales-leads-update');
            Route::post('/{id}/restore', [WebSalesLeadController::class, 'restore'])
                ->middleware('permission:web-sales-leads-delete');
            Route::delete('/{id}', [WebSalesLeadController::class, 'destroy'])
                ->middleware('permission:web-sales-leads-delete');
            Route::post('/{id}/generate-link', [WebSalesLeadController::class, 'generateLink'])
                ->middleware('permission:web-sales-leads-update');
        });

    });
});
