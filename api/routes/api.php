<?php

/**
 * @file routes/api.php
 * @path routes/api.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description API endpoints of the core (sign-in, accounts, roles, settings, calendar, logs,
 * languages and translations, legal documents, attachments) - public and protected. The
 * endpoints of the applications (web, e-shop, project portal) are in app/Apps/<App>/routes.php,
 * loaded near the end of this file from the registry (config/apps.php).
 * @security-note (2026-10-23) Removed the `@TEMP-DEBUG` unprotected `debug/users` route (local env
 *   only, bypassed CheckPermission - open finding #3).
 */

use App\Support\Auth\AuthCookies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AccountActivationController;
use App\Http\Controllers\Api\Auth\PasswordResetController;
use App\Http\Controllers\Api\Auth\PasswordConfirmationController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserAvatarController;
use App\Http\Controllers\Api\KnowledgeBaseController;
use App\Http\Controllers\Api\TranslationController;
use App\Support\Apps\AppRegistry;
use App\Http\Controllers\Api\Core\CoreRoleController;
use App\Http\Controllers\Api\Core\CorePermissionController;
use App\Http\Controllers\Api\Core\CoreSecurityEventController;
use App\Http\Controllers\Api\Core\CoreSecuritySettingController;
use App\Http\Controllers\Api\Core\CoreRetentionSettingController;
use App\Http\Controllers\Api\Legal\CookieConsentController;
use App\Http\Controllers\Api\Legal\DocumentSectionController;
use App\Http\Controllers\Api\Legal\SiteConfigurationController;
use App\Http\Controllers\Api\Legal\DocumentTypeController;
use App\Http\Controllers\Api\Core\CoreExternalLinkController;
use App\Http\Controllers\Api\Core\CoreLogController;
use App\Http\Controllers\Api\AttachmentDownloadController;
use App\Http\Controllers\Api\UploadRulesController;
use App\Http\Controllers\Api\CspReportController;
use App\Models\Core\CoreSecurityEvent;
use App\Http\Controllers\Api\Core\CoreAgendaController;
use App\Http\Controllers\Api\Core\CoreCalendarEventController;
use App\Http\Controllers\Api\Core\CoreEmailAccessPolicyController;
use App\Http\Controllers\Api\Legal\PageTitleController;

/*
|--------------------------------------------------------------------------
| LANGUAGES — public access (frontend does not require a token)
|--------------------------------------------------------------------------
| Only GET for language lists and translations — no mutations without authorization.
*/
Route::get('languages', [TranslationController::class, 'getAllLanguages']);
Route::get('languages/{module}', [TranslationController::class, 'getLanguages'])
    ->where('module', TranslationController::MODULE_PATTERN);
Route::get('translations/{module}/{lang}', [TranslationController::class, 'show'])
    ->where(['module' => TranslationController::MODULE_PATTERN, 'lang' => TranslationController::LANG_PATTERN]);

// Attachment rules of every upload (allowed types, limits) - the same AttachmentPolicy the
// requests validate with; the frontend uses it for the file picker and the hints.
Route::get('upload-rules', [UploadRulesController::class, 'index'])->middleware('throttle:60,1');

// Violation reports of the Content-Security-Policy of the SPA (report-uri in deploy/server/.htaccess).
Route::post('csp-report', [CspReportController::class, 'store'])->middleware('throttle:20,1,csp-report');

/*
|--------------------------------------------------------------------------
| PUBLIC LEGAL DOCUMENTS AND CONFIGURATION
|--------------------------------------------------------------------------
*/
Route::prefix('public/legal')->group(function () {
    Route::get('/config',      [SiteConfigurationController::class, 'publicShow']);
    Route::get('/page-titles', [PageTitleController::class, 'publicIndex']);
    Route::get('/{slug}',      [DocumentSectionController::class, 'publicShow']);
});

/*
|--------------------------------------------------------------------------
| ACCOUNT ACTIVATION — public, token-based (account created by an admin without a password)
|--------------------------------------------------------------------------
*/
Route::prefix('account-activation')->group(function () {
    Route::get('/{token}',  [AccountActivationController::class, 'show'])
        ->middleware('throttle:20,1,account-activation-show');
    Route::post('/{token}', [AccountActivationController::class, 'activate'])
        ->middleware('throttle:10,1,account-activation-activate');
});

/*
|--------------------------------------------------------------------------
| Authentication (public)
|--------------------------------------------------------------------------
*/
Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

Route::post('/login/verify-2fa', [AuthController::class, 'verifyTwoFactor'])
    ->middleware('throttle:10,1,login-verify-2fa');

Route::post('/login/resend-2fa', [AuthController::class, 'resendTwoFactor'])
    ->middleware('throttle:login-2fa-resend');

// The refresh token comes ONLY from its HttpOnly cookie (AuthCookies) - one per account signed in
// in the browser (`jsw_refresh_{slot}`, header X-Session-Slot); their Path is this route.
Route::post('/refresh', [AuthController::class, 'refresh'])
    ->name(AuthCookies::REFRESH_ROUTE)
    ->middleware('throttle:30,1,auth-refresh');
// Accounts remembered in this browser (login page: "Continue as ..."), under the cookie Path.
Route::post('/refresh/accounts', [AuthController::class, 'rememberedAccounts'])
    ->middleware('throttle:30,1,auth-accounts');

/*
|--------------------------------------------------------------------------
| Password reset (public) — request the link and set the new password
|--------------------------------------------------------------------------
| IP throttle against brute force / enumeration; audit log in core_logs.
*/
Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword'])
    ->middleware('throttle:5,1,password-forgot');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])
    ->middleware('throttle:10,1,password-reset');

// Cookie consent record (GDPR Art. 7(1), VT-12) - anonymous (random consent id, no IP / user
// agent stored); sent by the cookie bar on every decision. Not behind web.active: the bar is
// also shown by the e-shop.
Route::post('cookie-consents', [CookieConsentController::class, 'store'])
    ->middleware('throttle:20,1,cookie-consent');

/*
|--------------------------------------------------------------------------
| ATTACHMENT DOWNLOAD / VIEW — signed URLs only
|--------------------------------------------------------------------------
*/
Route::get('/attachments/download/{path}', [AttachmentDownloadController::class, 'download'])
    ->where('path', '.*')
    ->middleware('signed')
    ->name('attachments.download');

Route::get('/attachments/view/{path}', [AttachmentDownloadController::class, 'view'])
    ->where('path', '.*')
    ->middleware('signed')
    ->name('attachments.view');

// Profile photo of an admin account (UserAvatar::url) - signed URL only, so <img> needs no token;
// relative signature (the URL is relative, see UserAvatar::url).
Route::get('/users/{id}/avatar', [UserAvatarController::class, 'show'])
    ->middleware('signed:relative')
    ->name('users.avatar');

/*
|--------------------------------------------------------------------------
| Protected Routes (auth:sanctum + rate limit)
|--------------------------------------------------------------------------
| @note `throttle:300,1` needs no prefix: for a LOGGED-IN user the throttle signature is the
| user_id, not the IP, so it is separate from the public buckets above; auth:sanctum runs
| BEFORE the throttle.
*/
Route::middleware(['auth:sanctum', 'throttle:300,1'])->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user',    [AuthController::class, 'user']);
    // Step-up confirmation of the own password for one sensitive operation (sysadmin accounts,
    // e-mail access policy) - see App\Traits\RequiresPasswordConfirmation (2026-10-26).
    Route::post('/confirm-password', [PasswordConfirmationController::class, 'confirm'])
        ->middleware('throttle:20,1,password-confirmation');

    // Internal manual (Knowledge Base) - every signed-in user, content filtered by the permissions.
    Route::get('/knowledge-base', [KnowledgeBaseController::class, 'index']);
    Route::get('/knowledge-base/pages/{id}', [KnowledgeBaseController::class, 'show'])
        ->where('id', '[a-z0-9-]{1,80}');

        // Any application's translation permission lets the request in; TranslationController then
        // checks the permission of the module of the URL (only the sysadmin when none is registered).
        $translationPermission = 'permission:' . (implode('|', AppRegistry::translationPermissions()) ?: 'sysadmin-only');
        Route::post('/save_translations/{module}', [TranslationController::class, 'save'])
            ->where('module', TranslationController::MODULE_PATTERN)
            ->middleware($translationPermission);

    Route::prefix('languages')->middleware($translationPermission)
        ->where(['module' => TranslationController::MODULE_PATTERN, 'code' => TranslationController::LANG_PATTERN])
        ->group(function () {
            Route::post('/{module}',     [TranslationController::class, 'saveLanguages']);
            Route::post('/{module}/{code}/icon', [TranslationController::class, 'storeLanguageIcon']);
            Route::delete('/{module}/{code}',    [TranslationController::class, 'destroyLanguage']);
        });

    /*
    |----------------------------------------------------------------------
    | CORE
    |----------------------------------------------------------------------
    */
    Route::prefix('core')->group(function () {

        // Agenda of the admin calendar (core/calendar): no page permission - every source is
        // filtered by the user's permissions inside (CoreAgendaController).
        Route::get('/agenda', [CoreAgendaController::class, 'index'])->middleware('throttle:60,1');
        // Own personal events of the calendar (scoped to the owner, no permission - own data).
        Route::post('/calendar-events', [CoreCalendarEventController::class, 'store'])->middleware('throttle:60,1');
        Route::put('/calendar-events/{id}', [CoreCalendarEventController::class, 'update'])->middleware('throttle:60,1');
        Route::delete('/calendar-events/{id}', [CoreCalendarEventController::class, 'destroy'])->middleware('throttle:60,1');

        // POST without a permission middleware - writes an audit entry of the user's own action (see
        Route::prefix('logs')->group(function () {
            Route::get('/',     [CoreLogController::class, 'index'])
                ->middleware('permission:view-core');
            Route::get('/{id}', [CoreLogController::class, 'show'])
                ->middleware('permission:view-core');
        });

        // ── core/security_events ────────────────────────────────────────────
        Route::prefix('security_events')->group(function () {
            Route::get('/stats', [CoreSecurityEventController::class, 'stats'])
                ->middleware('permission:core-security-view');
            Route::delete('/purge', [CoreSecurityEventController::class, 'purge'])
                ->middleware('permission:core-security-delete');
            Route::get('/',      [CoreSecurityEventController::class, 'index'])
                ->middleware('permission:core-security-view');
            Route::get('/{id}',  [CoreSecurityEventController::class, 'show'])
                ->middleware('permission:core-security-view');
            Route::put('/{id}',  [CoreSecurityEventController::class, 'update'])
                ->middleware('permission:core-security-update');
            Route::patch('/{id}', [CoreSecurityEventController::class, 'update'])
                ->middleware('permission:core-security-update');
            Route::delete('/{id}', [CoreSecurityEventController::class, 'destroy'])
                ->middleware('permission:core-security-delete');
        });

        // ── core/security_settings ──────────────────────────────────────────
        Route::prefix('security_settings')->group(function () {
            Route::get('/',  [CoreSecuritySettingController::class, 'show'])
                ->middleware('permission:core-security-view');
            Route::put('/', [CoreSecuritySettingController::class, 'update'])
                ->middleware('permission:core-security-update');
        });

        // ── core/retention_settings (GDPR storage limitation, VT-10) ──────────
        // Periods of the personal data + an immediate run of the daily `retention:purge`.
        Route::prefix('retention_settings')->group(function () {
            Route::get('/', [CoreRetentionSettingController::class, 'index'])
                ->middleware('permission:core-legal-config-view');
            Route::put('/', [CoreRetentionSettingController::class, 'update'])
                ->middleware('permission:core-legal-config-update');
            Route::post('/purge', [CoreRetentionSettingController::class, 'purge'])
                ->middleware(['throttle:5,1,retention-purge', 'permission:core-legal-config-update']);
        });

        // ── core/email-access-policy ────────────────────────────────────────────
        Route::prefix('email-access-policy')->group(function () {
            Route::get('/',                [CoreEmailAccessPolicyController::class, 'show']);
            Route::put('/primary-domain',  [CoreEmailAccessPolicyController::class, 'updatePrimaryDomain']);
            Route::post('/rules',          [CoreEmailAccessPolicyController::class, 'storeRule']);
            Route::delete('/rules/{id}',   [CoreEmailAccessPolicyController::class, 'destroyRule']);
        });

        // ── core/users ────────────────────────────────────────────────────
        // {id} routes pass 'selfParam' => id (CheckPermission) - the own account
        // (personal info page) is reachable without core-administrators-*.
        //
        // No bulk delete / import for core/users on purpose: UserController::destroy() protects the
        // sysadmin (no deleting yourself, only a sysadmin deletes a sysadmin) - a bulkDestroy() would
        // have to repeat that exactly; an import would have to hash passwords and assign roles - both
        // need a security review first.
        //
        Route::prefix('users')->group(function () {
            Route::delete('/force-delete-all', [UserController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:core-administrators-delete');

            Route::get('/',    [UserController::class, 'index'])
                ->middleware('permission:core-administrators-view');
            Route::post('/',   [UserController::class, 'store'])
                ->middleware('permission:core-administrators-create');
            Route::get('/{id}', [UserController::class, 'show'])
                ->middleware('permission:core-administrators-view,id');
            Route::put('/{id}', [UserController::class, 'update'])
                ->middleware('permission:core-administrators-update,id');
            Route::patch('/{id}', [UserController::class, 'update'])
                ->middleware('permission:core-administrators-update,id');
            Route::put('/{id}/change-password', [UserController::class, 'changePassword'])
                ->middleware('permission:core-administrators-update,id');
            Route::post('/{id}/avatar', [UserAvatarController::class, 'store'])
                ->middleware(['permission:core-administrators-update,id', 'throttle:20,1,user-avatar']);
            Route::delete('/{id}/avatar', [UserAvatarController::class, 'destroy'])
                ->middleware('permission:core-administrators-update,id');
            Route::post('/{id}/resend-activation', [UserController::class, 'resendActivation'])
                ->middleware('permission:core-administrators-update');
            Route::post('/{id}/restore', [UserController::class, 'restore'])
                ->middleware('permission:core-administrators-delete');
            Route::delete('/{id}', [UserController::class, 'destroy'])
                ->middleware('permission:core-administrators-delete');
        });

        Route::get('/permissions', [CorePermissionController::class, 'index']);

        // core/roles - NO permission middleware on purpose: protected only by the
        // role_name === 'sysadmin' check in CoreRoleController.
        // No bulk delete of roles on purpose - it could leave users without a role.
        Route::prefix('roles')->group(function () {
            Route::post('/',                   [CoreRoleController::class, 'store']);
            Route::post('/{id}/restore',       [CoreRoleController::class, 'restore']);
            Route::delete('/force-delete-all', [CoreRoleController::class, 'forceDeleteAllTrashed']);
            Route::get('/{id}',                [CoreRoleController::class, 'show']);
            Route::put('/{id}/permissions',    [CoreRoleController::class, 'syncPermissions']);
        });
        Route::apiResource('roles', CoreRoleController::class)
            ->except(['store', 'create', 'edit'])
            ->parameters(['roles' => 'id']);

        // ── core/external_links ──────────────────────────────────────────
        // No bulk delete on purpose - destroy() is scoped to the owner
        // ($request->user()->externalLinks()); a bulkDestroy() must use the SAME scope, otherwise
        // foreign links could be deleted by guessing IDs.
        Route::prefix('external_links')->group(function () {
            Route::delete('/force-delete-all', [CoreExternalLinkController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:core-external-links-delete');
            Route::get('/',      [CoreExternalLinkController::class, 'index'])
                ->middleware('permission:core-external-links-view');
            Route::post('/',     [CoreExternalLinkController::class, 'store'])
                ->middleware('permission:core-external-links-create');
                  Route::post('/bulk-delete', [CoreExternalLinkController::class, 'bulkDestroy'])
        ->middleware('permission:core-external-links-delete');
            Route::get('/{id}',  [CoreExternalLinkController::class, 'show'])
                ->middleware('permission:core-external-links-view');
            Route::put('/{id}',  [CoreExternalLinkController::class, 'update'])
                ->middleware('permission:core-external-links-update');
            Route::patch('/{id}', [CoreExternalLinkController::class, 'update'])
                ->middleware('permission:core-external-links-update');
            Route::post('/{id}/restore', [CoreExternalLinkController::class, 'restore'])
                ->middleware('permission:core-external-links-delete');
            Route::delete('/{id}', [CoreExternalLinkController::class, 'destroy'])
                ->middleware('permission:core-external-links-delete');
        });

    });

    /*
    |----------------------------------------------------------------------
    | LEGAL — managed on the core/edit-legal page (GDPR / TOS / cookies)
    |----------------------------------------------------------------------
    */
Route::prefix('legal')->group(function () {
 
    Route::get('document-types', [DocumentTypeController::class, 'index'])
        ->middleware('permission:core-legal-documents-view');
 
    Route::prefix('document-sections')->group(function () {
        Route::get('/',       [DocumentSectionController::class, 'index'])
            ->middleware('permission:core-legal-documents-view');
        Route::post('/',      [DocumentSectionController::class, 'store'])
            ->middleware('permission:core-legal-documents-create');
        Route::get('/{id}',   [DocumentSectionController::class, 'show'])
            ->middleware('permission:core-legal-documents-view');
        Route::put('/{id}',   [DocumentSectionController::class, 'update'])
            ->middleware('permission:core-legal-documents-update');
        Route::delete('/{id}', [DocumentSectionController::class, 'destroy'])
            ->middleware('permission:core-legal-documents-delete');
    });
 
    Route::prefix('config')->group(function () {
        Route::get('/',              [SiteConfigurationController::class, 'index'])
            ->middleware('permission:core-legal-config-view');
        Route::put('/settings',      [SiteConfigurationController::class, 'updateSettings'])
            ->middleware('permission:core-legal-config-update');
 
        // Browser titles of the administration; web / shop titles: web/page-titles, shop/page-titles.
        Route::get('/page-titles',   [PageTitleController::class, 'index'])
            ->defaults('area', 'admin')
            ->middleware('permission:core-legal-config-view');
        Route::put('/page-titles',   [PageTitleController::class, 'update'])
            ->defaults('area', 'admin')
            ->middleware('permission:core-legal-config-update');
 
        Route::post('/social',       [SiteConfigurationController::class, 'storeSocial'])
            ->middleware('permission:core-legal-config-create');
        Route::put('/social/{id}',   [SiteConfigurationController::class, 'updateSocial'])
            ->middleware('permission:core-legal-config-update');
        Route::delete('/social/{id}', [SiteConfigurationController::class, 'destroySocial'])
            ->middleware('permission:core-legal-config-delete');
        Route::post('/social/{id}',  [SiteConfigurationController::class, 'updateSocial'])
            ->middleware('permission:core-legal-config-update');
    });
});
});

/*
|--------------------------------------------------------------------------
| APPLICATIONS — the routes of every registered application (config/apps.php)
|--------------------------------------------------------------------------
| Each application keeps its public and protected routes in app/Apps/<App>/routes.php (same
| `api` prefix and middleware group as this file); a removed application has none.
*/
foreach (AppRegistry::apps() as $application) {
    if ($routesFile = $application->routesFile()) {
        require $routesFile;
    }
}

/*
|--------------------------------------------------------------------------
| SCANNING / PROBING DETECTION — MUST stay at the very end of the file
|--------------------------------------------------------------------------
|
| Typical pattern of automated vulnerability scanning. `throttle:30,1` protects the fallback
| route itself from becoming a load source (CoreSecurityEvent::record() is bucketed, the HTTP
| answer still has a cost). The route never has a logged-in user, so it is always recorded.
*/
Route::fallback(function (Request $request) {
    CoreSecurityEvent::record(
        'scan_probe',
        'warning',
        $request->ip(),
        CoreSecurityEvent::contextFromRequest($request)
    );

    return response()->json(['message' => 'Not Found.'], 404);
})->middleware('throttle:30,1,scan-probe');