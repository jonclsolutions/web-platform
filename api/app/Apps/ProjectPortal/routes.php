<?php

/**
 * @file routes.php
 * @path app/Apps/ProjectPortal/routes.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description API endpoints of the customer project portal: the public order form
 *   (project-portal/public/... - the lead of a link, sending an order), the public portal of a
 *   project (projects/public/{token} - sign-in by password / one-time code / link, then the
 *   session routes) and the administration (project-portal/..., signed-in users with permissions).
 *   Loaded by routes/api.php inside the `api` prefix (AppManifest::routesFile()), so every path
 *   here is below /api.
 * @dependencies
 * - App\Apps\ProjectPortal\Http\Controllers\*; core PageTitleController (browser titles of the
 *   public pages); PortalCookie::ROUTE (Path of the session cookie); middleware `project.session`
 *   (ProjectPortalApp::middlewareAliases()), core `public.form`, `auth:sanctum`, `permission`;
 *   named rate limiter `public-form`.
 */

use App\Apps\ProjectPortal\Http\Controllers\ProjectAccountController;
use App\Apps\ProjectPortal\Http\Controllers\ProjectApprovalController;
use App\Apps\ProjectPortal\Http\Controllers\ProjectController;
use App\Apps\ProjectPortal\Http\Controllers\ProjectPortalAccessController;
use App\Apps\ProjectPortal\Http\Controllers\ProjectPortalController;
use App\Apps\ProjectPortal\Http\Controllers\ProjectPortalLogController;
use App\Apps\ProjectPortal\Http\Controllers\ProjectPublicController;
use App\Apps\ProjectPortal\Http\Controllers\ProjectTemplateController;
use App\Apps\ProjectPortal\Http\Controllers\ProjectThreadController;
use App\Apps\ProjectPortal\Http\Controllers\ProjectUpdateController;
use App\Apps\ProjectPortal\Http\Controllers\SalesLeadController;
use App\Apps\ProjectPortal\Http\Controllers\SalesOrderController;
use App\Apps\ProjectPortal\Support\PortalCookie;
use App\Http\Controllers\Api\Legal\PageTitleController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| PUBLIC PROJECT PORTAL — customer login by permanent access_token, then a
| 24h-sliding session (CheckProjectSession middleware, alias 'project.session')
|--------------------------------------------------------------------------
*/
Route::post('projects/public/{token}/login', [ProjectPublicController::class, 'login'])
    ->middleware('throttle:10,1,project-login');
// Password-less sign-in: a one-time code / link sent to the account's e-mail (also invitations).
Route::post('projects/public/{token}/login/code-request', [ProjectPortalAccessController::class, 'requestCode'])
    ->middleware('throttle:5,1,project-code-request');
Route::post('projects/public/{token}/login/code', [ProjectPortalAccessController::class, 'loginWithCode'])
    ->middleware('throttle:10,1,project-login');
Route::post('projects/public/{token}/login/link', [ProjectPortalAccessController::class, 'loginWithLink'])
    ->middleware('throttle:10,1,project-login');

Route::prefix('projects/public/{token}')
    ->middleware(['project.session', 'throttle:120,1,project-session'])
    ->group(function () {
        Route::get('/',       [ProjectPublicController::class, 'me'])->name(PortalCookie::ROUTE);
        Route::post('logout', [ProjectPublicController::class, 'logout']);

        Route::get('threads',            [ProjectPublicController::class, 'threadsIndex']);
        Route::get('threads/{threadId}', [ProjectPublicController::class, 'threadShow']);
        Route::get('threads/{threadId}/messages', [ProjectPublicController::class, 'olderMessages']);
        Route::post('threads', [ProjectPublicController::class, 'threadStore'])
            ->middleware('throttle:20,1,project-thread-create');
        Route::post('threads/{threadId}/messages', [ProjectPublicController::class, 'messageStore'])
            ->middleware('throttle:30,1,project-message-create');
        Route::post('threads/{threadId}/status', [ProjectPublicController::class, 'updateStatus']);
        Route::get('threads/{threadId}/new-messages', [ProjectPublicController::class, 'newMessages']);
        Route::get('files', [ProjectPublicController::class, 'files']);
        Route::post('account', [ProjectPublicController::class, 'updateAccount'])
            ->middleware('throttle:20,1,project-account-settings');
        Route::get('activity', [ProjectPortalController::class, 'activity']);
        Route::post('activity/seen', [ProjectPortalController::class, 'markActivitySeen']);
        Route::get('updates', [ProjectPortalController::class, 'updates']);
        Route::get('approvals', [ProjectPortalController::class, 'approvals']);
        Route::post('approvals/{approvalId}/decision', [ProjectPortalController::class, 'decide'])
            ->middleware('throttle:20,1,project-approval-decision');
    });

/*
|--------------------------------------------------------------------------
| PUBLIC ORDER FORM — the lead of a link (by its unguessable token only, never by the internal
| id; prefills the form) and sending an order (per-IP limit `public-form`, then the quota per
| recipient e-mail and the captcha - PublicFormGuard). The admin creates orders through the
| authenticated routes below, which have none of these checks.
|--------------------------------------------------------------------------
*/
Route::prefix('project-portal/public')->group(function () {
    Route::get('sales-leads/{token}', [SalesLeadController::class, 'showByToken'])
        ->middleware('throttle:30,1,sales-lead-token');
    Route::post('sales-orders', [SalesOrderController::class, 'store'])
        ->middleware(['throttle:public-form', 'public.form:sales_order,client_email']);
});

/*
|--------------------------------------------------------------------------
| ADMINISTRATION (signed-in users; every route checks its permission)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:300,1'])->group(function () {
    Route::prefix('project-portal')->group(function () {

        // Browser titles of the public pages of the portal (project-portal/settings).
        Route::get('/page-titles', [PageTitleController::class, 'index'])
            ->defaults('area', 'project-portal')
            ->middleware('permission:project-portal-settings-view');
        Route::put('/page-titles', [PageTitleController::class, 'update'])
            ->defaults('area', 'project-portal')
            ->middleware('permission:project-portal-settings-update');

        // ── project-portal/sales_leads ──────────────────────────────────────
        Route::prefix('sales_leads')->group(function () {
            Route::post('/bulk-delete', [SalesLeadController::class, 'bulkDestroy'])
                ->middleware('permission:project-portal-sales-leads-delete');
            Route::delete('/force-delete-all', [SalesLeadController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:project-portal-sales-leads-delete');
            Route::get('/import/template', [SalesLeadController::class, 'importTemplate'])
                ->middleware('permission:project-portal-sales-leads-create');
            Route::post('/import/validate', [SalesLeadController::class, 'importValidate'])
                ->middleware(['throttle:30,1,import-sales-leads-validate', 'permission:project-portal-sales-leads-create']);
            Route::post('/import/commit', [SalesLeadController::class, 'importCommit'])
                ->middleware(['throttle:30,1,import-sales-leads-commit', 'permission:project-portal-sales-leads-create']);
            Route::get('/',      [SalesLeadController::class, 'index'])
                ->middleware('permission:project-portal-sales-leads-view');
            Route::post('/',     [SalesLeadController::class, 'store'])
                ->middleware('permission:project-portal-sales-leads-create');
            Route::get('/{id}',  [SalesLeadController::class, 'show'])
                ->middleware('permission:project-portal-sales-leads-view');
            Route::put('/{id}',  [SalesLeadController::class, 'update'])
                ->middleware('permission:project-portal-sales-leads-update');
            Route::patch('/{id}', [SalesLeadController::class, 'update'])
                ->middleware('permission:project-portal-sales-leads-update');
            Route::post('/{id}/restore', [SalesLeadController::class, 'restore'])
                ->middleware('permission:project-portal-sales-leads-delete');
            Route::delete('/{id}', [SalesLeadController::class, 'destroy'])
                ->middleware('permission:project-portal-sales-leads-delete');
            Route::post('/{id}/generate-link', [SalesLeadController::class, 'generateLink'])
                ->middleware('permission:project-portal-sales-leads-update');
        });

        // ── project-portal/sales_orders ─────────────────────────────────────
        // No import on purpose (SalesOrderController: atomic lead_token + GDPR consent cannot be
        // imported retroactively).
        Route::prefix('sales_orders')->group(function () {
            Route::get('/email-template', [SalesOrderController::class, 'emailTemplate'])
                ->middleware('permission:project-portal-sales-orders-update');
            Route::put('/email-template', [SalesOrderController::class, 'updateEmailTemplate'])
                ->middleware('permission:project-portal-sales-orders-update');
            Route::post('/bulk-delete', [SalesOrderController::class, 'bulkDestroy'])
                ->middleware('permission:project-portal-sales-orders-delete');
            Route::delete('/force-delete-all', [SalesOrderController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:project-portal-sales-orders-delete');
            Route::get('/',      [SalesOrderController::class, 'index'])
                ->middleware('permission:project-portal-sales-orders-view');
            Route::post('/',     [SalesOrderController::class, 'store'])
                ->middleware('permission:project-portal-sales-orders-create');
            Route::get('/{id}',  [SalesOrderController::class, 'show'])
                ->middleware('permission:project-portal-sales-orders-view');
            Route::put('/{id}',  [SalesOrderController::class, 'update'])
                ->middleware('permission:project-portal-sales-orders-update');
            Route::patch('/{id}', [SalesOrderController::class, 'update'])
                ->middleware('permission:project-portal-sales-orders-update');
            Route::post('/{id}/restore', [SalesOrderController::class, 'restore'])
                ->middleware('permission:project-portal-sales-orders-delete');
            Route::delete('/{id}', [SalesOrderController::class, 'destroy'])
                ->middleware('permission:project-portal-sales-orders-delete');
        });

        // ── project-portal/logs (audit log of the portal) ─────────────────────
        Route::prefix('logs')->group(function () {
            Route::get('/',     [ProjectPortalLogController::class, 'index'])
                ->middleware('permission:project-portal-view-logs');
            Route::get('/{id}', [ProjectPortalLogController::class, 'show'])
                ->middleware('permission:project-portal-view-logs');
        });

        // ── project-portal/projects────────────────────────────────────────────────
        Route::prefix('projects')->group(function () {
            Route::post('/bulk-delete', [ProjectController::class, 'bulkDestroy'])
                ->middleware('permission:web-projects-delete');
            Route::delete('/force-delete-all', [ProjectController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-projects-delete');

            Route::get('/',      [ProjectController::class, 'index'])
                ->middleware('permission:web-projects-view');
            // Administrators who can be responsible for a project (select of the project form).
            Route::get('/assignees', [ProjectController::class, 'assignees'])
                ->middleware('permission:web-projects-view');

            // ── Project templates (before /{id}) ──────────────────────
            Route::get('/templates', [ProjectTemplateController::class, 'index'])
                ->middleware('permission:web-projects-view');
            Route::post('/templates', [ProjectTemplateController::class, 'store'])
                ->middleware('permission:web-projects-update');
            Route::get('/templates/{templateId}', [ProjectTemplateController::class, 'show'])
                ->middleware('permission:web-projects-view');
            Route::put('/templates/{templateId}', [ProjectTemplateController::class, 'update'])
                ->middleware('permission:web-projects-update');
            Route::delete('/templates/{templateId}', [ProjectTemplateController::class, 'destroy'])
                ->middleware('permission:web-projects-update');
            Route::post('/',     [ProjectController::class, 'store'])
                ->middleware('permission:web-projects-create');
            Route::get('/{id}',  [ProjectController::class, 'show'])
                ->middleware('permission:web-projects-view');
            Route::put('/{id}',  [ProjectController::class, 'update'])
                ->middleware('permission:web-projects-update');
            Route::patch('/{id}', [ProjectController::class, 'update'])
                ->middleware('permission:web-projects-update');
            Route::post('/{id}/restore', [ProjectController::class, 'restore'])
                ->middleware('permission:web-projects-delete');
            Route::delete('/{id}', [ProjectController::class, 'destroy'])
                ->middleware('permission:web-projects-delete');

            // Files of the project (threads - also internal notes, flagged - updates, approvals).
            Route::get('/{id}/files', [ProjectController::class, 'files'])
                ->middleware('permission:web-projects-view');
            // What happened lately (client messages, approval decisions, updates, checkpoints).
            Route::get('/{id}/activity', [ProjectController::class, 'activity'])
                ->middleware('permission:web-projects-view');
            // Templates: save the checkpoints as a template / add a template's checkpoints.
            Route::post('/{projectId}/template', [ProjectTemplateController::class, 'storeFromProject'])
                ->middleware('permission:web-projects-update');
            Route::post('/{projectId}/apply-template', [ProjectTemplateController::class, 'applyToProject'])
                ->middleware('permission:web-projects-update');

            // ── Updates for the client ────────────────────────────────
            Route::get('/{projectId}/updates', [ProjectUpdateController::class, 'index'])
                ->middleware('permission:web-projects-view');
            Route::post('/{projectId}/updates', [ProjectUpdateController::class, 'store'])
                ->middleware('permission:web-projects-update');
            // POST (multipart: files) for a change.
            Route::post('/{projectId}/updates/{updateId}', [ProjectUpdateController::class, 'update'])
                ->middleware('permission:web-projects-update');
            Route::delete('/{projectId}/updates/{updateId}', [ProjectUpdateController::class, 'destroy'])
                ->middleware('permission:web-projects-update');

            // ── Approval requests ─────────────────────────────────────
            Route::get('/{projectId}/approvals', [ProjectApprovalController::class, 'index'])
                ->middleware('permission:web-projects-view');
            Route::post('/{projectId}/approvals', [ProjectApprovalController::class, 'store'])
                ->middleware('permission:web-projects-update');
            Route::post('/{projectId}/approvals/{approvalId}', [ProjectApprovalController::class, 'update'])
                ->middleware('permission:web-projects-update');
            Route::post('/{projectId}/approvals/{approvalId}/reopen', [ProjectApprovalController::class, 'reopen'])
                ->middleware('permission:web-projects-update');
            Route::post('/{projectId}/approvals/{approvalId}/cancel', [ProjectApprovalController::class, 'cancel'])
                ->middleware('permission:web-projects-update');
            Route::delete('/{projectId}/approvals/{approvalId}', [ProjectApprovalController::class, 'destroy'])
                ->middleware('permission:web-projects-update');

            // ── Client accounts of the portal ─────────────────────────
            // A password reset is security sensitive (it ends the account's sessions), but whoever
            // may edit a project may manage its access: the same permission as update(), no extra key.
            Route::get('/{projectId}/accounts', [ProjectAccountController::class, 'index'])
                ->middleware('permission:web-projects-view');
            Route::post('/{projectId}/accounts', [ProjectAccountController::class, 'store'])
                ->middleware('permission:web-projects-update');
            Route::put('/{projectId}/accounts/{accountId}', [ProjectAccountController::class, 'update'])
                ->middleware('permission:web-projects-update');
            Route::post('/{projectId}/accounts/{accountId}/password', [ProjectAccountController::class, 'resetPassword'])
                ->middleware('permission:web-projects-update');
            Route::post('/{projectId}/accounts/{accountId}/invite', [ProjectAccountController::class, 'invite'])
                ->middleware('permission:web-projects-update');
            Route::delete('/{projectId}/accounts/{accountId}', [ProjectAccountController::class, 'destroy'])
                ->middleware('permission:web-projects-update');

            // ── Checkpoints (nested under a project) ──────────────────
            Route::post('/{projectId}/checkpoints', [ProjectController::class, 'storeCheckpoint'])
                ->middleware('permission:web-projects-update');
            Route::put('/{projectId}/checkpoints/order', [ProjectController::class, 'reorderCheckpoints'])
                ->middleware('permission:web-projects-update');
            Route::put('/{projectId}/checkpoints/{checkpointId}', [ProjectController::class, 'updateCheckpoint'])
                ->middleware('permission:web-projects-update');
            Route::delete('/{projectId}/checkpoints/{checkpointId}', [ProjectController::class, 'destroyCheckpoint'])
                ->middleware('permission:web-projects-update');
        });

        // ── project-portal/project-threads────────────────────────────────────────────
        Route::prefix('project-threads')->group(function () {
            Route::get('/',    [ProjectThreadController::class, 'index'])
                ->middleware('permission:web-projects-view');
            Route::get('/{id}', [ProjectThreadController::class, 'show'])
                ->middleware('permission:web-projects-view');
            Route::post('/{threadId}/reply', [ProjectThreadController::class, 'reply'])
                ->middleware('permission:web-projects-update');
            Route::put('/{threadId}/status', [ProjectThreadController::class, 'updateStatus'])
                ->middleware('permission:web-projects-update');
            Route::put('/{threadId}/assignee', [ProjectThreadController::class, 'assign'])
                ->middleware('permission:web-projects-update');
            Route::get('/{threadId}/messages', [ProjectThreadController::class, 'olderMessages'])
                ->middleware('permission:web-projects-view');
        });
    });
});
