<?php

/**
 * @file routes/api.php
 * @path routes/api.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Defines all application API endpoints, including public access for the
 * frontend, checkout processes, and protected administrative routes.
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
use App\Http\Controllers\Api\Core\CoreRoleController;
use App\Http\Controllers\Api\Core\CorePermissionController;
use App\Http\Controllers\Api\Core\CoreSecurityEventController;
use App\Http\Controllers\Api\Core\CoreSecuritySettingController;
use App\Http\Controllers\Api\Core\CoreRetentionSettingController;
use App\Http\Controllers\Api\Web\WebCookieConsentController;
use App\Http\Controllers\Api\Legal\DocumentSectionController;
use App\Http\Controllers\Api\Legal\SiteConfigurationController;
use App\Http\Controllers\Api\Web\WebRawRequestCommissionController;
use App\Http\Controllers\Api\Web\WebLogController;
use App\Http\Controllers\Api\Web\WebSalesLeadController;
use App\Http\Controllers\Api\Web\WebNewsController;
use App\Http\Controllers\Api\Web\WebFaqController;
use App\Http\Controllers\Api\Web\WebJobController;
use App\Http\Controllers\Api\Web\WebReferenceController;
use App\Http\Controllers\Api\Web\WebSalesOrderController;
use App\Http\Controllers\Api\Web\WebSupportTicketController;
use App\Http\Controllers\Api\Web\WebJobApplicationController;
use App\Http\Controllers\Api\Web\WebSiteSettingController;
use App\Http\Controllers\Api\Web\WebProjectController;
use App\Http\Controllers\Api\Web\WebProjectThreadController;
use App\Http\Controllers\Api\Web\WebProjectPublicController;
use App\Http\Controllers\Api\Shop\ShopLogController;
use App\Http\Controllers\Api\Shop\ShopSupplierController;
use App\Http\Controllers\Api\Shop\ShopCouponController;
use App\Http\Controllers\Api\Shop\ShopCategoryController;
use App\Http\Controllers\Api\Shop\ShopShippingMethodController;
use App\Http\Controllers\Api\Shop\ShopPaymentMethodController;
use App\Http\Controllers\Api\Shop\ShopProductController;
use App\Http\Controllers\Api\Shop\ShopOrderController;
use App\Http\Controllers\Api\Shop\ShopCustomerController;
use App\Http\Controllers\Api\Shop\ShopCheckoutController;
use App\Http\Controllers\Api\Shop\ShopPublicController;
use App\Http\Controllers\Api\Shop\ShopSiteSettingController;
use App\Http\Controllers\Api\Legal\DocumentTypeController;
use App\Http\Controllers\Api\Core\CoreExternalLinkController;
use App\Http\Controllers\Api\Core\CoreLogController;
use App\Http\Controllers\Api\Web\WebPublicController;
use App\Http\Controllers\Api\AttachmentDownloadController;
use App\Http\Controllers\Api\UploadRulesController;
use App\Http\Controllers\Api\CspReportController;
use App\Models\Core\CoreSecurityEvent;
use App\Http\Controllers\Api\Core\CoreEmailAccessPolicyController;
use App\Http\Controllers\Api\Legal\PageTitleController;


/*
|--------------------------------------------------------------------------
| LANGUAGES — public access (frontend does not require a token)
|--------------------------------------------------------------------------
| Only GET for language lists and translations — no mutations without authorization.
*/
Route::get('languages/{module}', [TranslationController::class, 'getLanguages'])
    ->where('module', TranslationController::MODULE_PATTERN);
Route::get('translations/{module}/{lang}', [TranslationController::class, 'show'])
    ->where(['module' => TranslationController::MODULE_PATTERN, 'lang' => TranslationController::LANG_PATTERN]);

/*
|--------------------------------------------------------------------------
| PUBLIC E-SHOP ROUTES
|--------------------------------------------------------------------------
*/
Route::prefix('shop/public')->group(function () {

    Route::get('status', [ShopPublicController::class, 'getStatus']);
    Route::get('settings', [ShopSiteSettingController::class, 'publicShow']);

    Route::middleware('shop.active')->group(function () {
        Route::get('products', [ShopProductController::class, 'publicIndex']);
        Route::get('products/{slugOrId}', [ShopProductController::class, 'publicShow']);
        Route::get('products/{id}/check-stock', [ShopPublicController::class, 'checkStock'])
            ->middleware('throttle:15,1,shop-check-stock');
        Route::get('categories', [ShopCategoryController::class, 'publicIndex']);
        Route::get('shipping-methods', [ShopPublicController::class, 'getShippingMethods']);
        Route::get('payment-methods', [ShopPublicController::class, 'getPaymentMethods']);
        Route::post('coupons/validate', [ShopPublicController::class, 'validateCoupon'])
            ->middleware('throttle:20,1,shop-coupon-validate');
    });
});
/*
|--------------------------------------------------------------------------
| PUBLIC WEB STATUS
|--------------------------------------------------------------------------
*/
Route::get('web/public/status', [WebPublicController::class, 'getStatus']);

// Attachment rules of every upload (allowed types, limits) - the same AttachmentPolicy the
// requests validate with; the frontend uses it for the file picker and the hints.
Route::get('upload-rules', [UploadRulesController::class, 'index'])->middleware('throttle:60,1');

// Violation reports of the Content-Security-Policy of the SPA (report-uri in deploy/server/.htaccess).
Route::post('csp-report', [CspReportController::class, 'store'])->middleware('throttle:20,1,csp-report');
/*
|--------------------------------------------------------------------------
| CHECKOUT
|--------------------------------------------------------------------------
*/
Route::prefix('shop/checkout')->middleware('shop.active')->group(function () {
    Route::post('create-order', [ShopCheckoutController::class, 'createOrder'])
        ->middleware('throttle:10,1,shop-checkout-create');
    Route::post('simulate-payment', [ShopCheckoutController::class, 'simulatePayment'])
        ->middleware('throttle:10,1,shop-checkout-payment');
});

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

/*
|--------------------------------------------------------------------------
| PUBLIC PROJECT PORTAL — customer login by permanent access_token, then a
| 24h-sliding session (CheckProjectSession middleware, alias 'project.session')
|--------------------------------------------------------------------------
*/
Route::post('projects/public/{token}/login', [WebProjectPublicController::class, 'login'])
    ->middleware('throttle:10,1,project-login');

Route::prefix('projects/public/{token}')
    ->middleware(['project.session', 'throttle:120,1,project-session'])
    ->group(function () {
        Route::get('/',       [WebProjectPublicController::class, 'me'])->name(AuthCookies::PORTAL_ROUTE);
        Route::post('logout', [WebProjectPublicController::class, 'logout']);

        Route::get('threads',            [WebProjectPublicController::class, 'threadsIndex']);
        Route::get('threads/{threadId}', [WebProjectPublicController::class, 'threadShow']);
        Route::get('threads/{threadId}/messages', [WebProjectPublicController::class, 'olderMessages']);
        Route::post('threads', [WebProjectPublicController::class, 'threadStore'])
            ->middleware('throttle:20,1,project-thread-create');
        Route::post('threads/{threadId}/messages', [WebProjectPublicController::class, 'messageStore'])
            ->middleware('throttle:30,1,project-message-create');
        Route::post('threads/{threadId}/status', [WebProjectPublicController::class, 'updateStatus']);
        Route::get('threads/{threadId}/new-messages', [WebProjectPublicController::class, 'newMessages']);
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

// Public web forms - per-IP limit (named limiter `public-form`), then the quota per recipient
// e-mail and the Turnstile captcha (PublicFormGuard). The admin creates the same records through
// the authenticated routes below (web/...), which have none of these checks.
Route::post('raw_request_commissions', [WebRawRequestCommissionController::class, 'store'])
    ->middleware(['web.active', 'throttle:public-form', 'public.form:raw_request,contact_email']);
Route::post('sales_orders', [WebSalesOrderController::class, 'store'])
    ->middleware(['web.active', 'throttle:public-form', 'public.form:sales_order,client_email']);
Route::post('job_applications',        [WebJobApplicationController::class, 'store'])
    ->middleware(['web.active', 'throttle:public-form', 'public.form:job_application,email']);

// Cookie consent record (GDPR Art. 7(1), VT-12) - anonymous (random consent id, no IP / user
// agent stored); sent by the cookie bar on every decision. Not behind web.active: the bar is
// also shown by the e-shop.
Route::post('cookie-consents', [WebCookieConsentController::class, 'store'])
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

        Route::post('/save_translations/{module}', [TranslationController::class, 'save'])
            ->where('module', TranslationController::MODULE_PATTERN)
            ->middleware('permission:web-edit-website-update|shop-edit-eshop-update');

    Route::prefix('languages')->middleware('permission:web-edit-website-update|shop-edit-eshop-update')
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

        // POST without a permission middleware - writes an audit entry of the user's own action (see
        Route::prefix('logs')->group(function () {
            Route::get('/',     [CoreLogController::class, 'index'])
                ->middleware('permission:view-core');
            Route::post('/',    [CoreLogController::class, 'store']);
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
    | SHOP
    |----------------------------------------------------------------------
    */
    Route::prefix('shop')->group(function () {

        // Browser titles of the e-shop pages (shop/edit-eshop).
        Route::get('/page-titles', [PageTitleController::class, 'index'])
            ->defaults('area', 'shop')
            ->middleware('permission:shop-edit-eshop-view');
        Route::put('/page-titles', [PageTitleController::class, 'update'])
            ->defaults('area', 'shop')
            ->middleware('permission:shop-edit-eshop-update');

        Route::prefix('settings')->group(function () {
            Route::get('/', [ShopSiteSettingController::class, 'show'])
                ->middleware('permission:shop-set-maintenance-mode');
            Route::put('/', [ShopSiteSettingController::class, 'update'])
                ->middleware('permission:shop-set-maintenance-mode');
        });

        // Products
        Route::prefix('products')->group(function () {
            // No bulk delete / import for this resource yet.
            Route::patch('/{id}/category',     [ShopProductController::class, 'updateCategory'])
                ->middleware('permission:shop-products-update');
            Route::get('/{id}',                [ShopProductController::class, 'show'])
                ->middleware('permission:shop-products-view');
            Route::post('/{id}/restore',       [ShopProductController::class, 'restore'])
                ->middleware('permission:shop-products-delete');
            Route::delete('/force-delete-all', [ShopProductController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:shop-products-delete');
        });
        Route::get('products',        [ShopProductController::class, 'index'])
            ->middleware('permission:shop-products-view');
        Route::post('products',       [ShopProductController::class, 'store'])
            ->middleware('permission:shop-products-create');
        Route::put('products/{id}',   [ShopProductController::class, 'update'])
            ->middleware('permission:shop-products-update');
        Route::patch('products/{id}', [ShopProductController::class, 'update'])
            ->middleware('permission:shop-products-update');
        Route::delete('products/{id}', [ShopProductController::class, 'destroy'])
            ->middleware('permission:shop-products-delete');

        // Customers
        Route::prefix('customers')->group(function () {
            // No bulk delete / import for this resource yet.
            Route::get('/{id}',                [ShopCustomerController::class, 'show'])
                ->middleware('permission:shop-customers-view');
            Route::post('/{id}/restore',       [ShopCustomerController::class, 'restore'])
                ->middleware('permission:shop-customers-delete');
            // GDPR erasure that keeps the orders (open finding #22) - same permission as delete.
            Route::post('/{id}/anonymize',     [ShopCustomerController::class, 'anonymize'])
                ->middleware('permission:shop-customers-delete');
            Route::delete('/force-delete-all', [ShopCustomerController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:shop-customers-delete');
        });
        Route::get('customers',        [ShopCustomerController::class, 'index'])
            ->middleware('permission:shop-customers-view');
        Route::post('customers',       [ShopCustomerController::class, 'store'])
            ->middleware('permission:shop-customers-create');
        Route::put('customers/{id}',   [ShopCustomerController::class, 'update'])
            ->middleware('permission:shop-customers-update');
        Route::patch('customers/{id}', [ShopCustomerController::class, 'update'])
            ->middleware('permission:shop-customers-update');
        Route::delete('customers/{id}', [ShopCustomerController::class, 'destroy'])
            ->middleware('permission:shop-customers-delete');

        // Orders
        Route::prefix('orders')->group(function () {
            // No bulk delete for this resource yet.
            Route::get('/{id}',                [ShopOrderController::class, 'show'])
                ->middleware('permission:shop-orders-view');
            Route::post('/{id}/restore',       [ShopOrderController::class, 'restore'])
                ->middleware('permission:shop-orders-delete');
            Route::delete('/force-delete-all', [ShopOrderController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:shop-orders-delete');
        });
        Route::get('orders',        [ShopOrderController::class, 'index'])
            ->middleware('permission:shop-orders-view');
        Route::post('orders',       [ShopOrderController::class, 'store'])
            ->middleware('permission:shop-orders-create');
        Route::put('orders/{id}',   [ShopOrderController::class, 'update'])
            ->middleware('permission:shop-orders-update');
        Route::patch('orders/{id}', [ShopOrderController::class, 'update'])
            ->middleware('permission:shop-orders-update');
        Route::delete('orders/{id}', [ShopOrderController::class, 'destroy'])
            ->middleware('permission:shop-orders-delete');

        // Suppliers
        Route::prefix('suppliers')->group(function () {
            Route::post('/bulk-delete', [ShopSupplierController::class, 'bulkDestroy'])
                ->middleware('permission:shop-suppliers-delete');
            Route::get('/import/template', [ShopSupplierController::class, 'importTemplate'])
                ->middleware('permission:shop-suppliers-create');
            Route::post('/import/validate', [ShopSupplierController::class, 'importValidate'])
                ->middleware(['throttle:30,1,import-suppliers-validate', 'permission:shop-suppliers-create']);
            Route::post('/import/commit', [ShopSupplierController::class, 'importCommit'])
                ->middleware(['throttle:30,1,import-suppliers-commit', 'permission:shop-suppliers-create']);
            Route::get('/{id}',                [ShopSupplierController::class, 'show'])
                ->middleware('permission:shop-suppliers-view');
            Route::post('/{id}/restore',       [ShopSupplierController::class, 'restore'])
                ->middleware('permission:shop-suppliers-delete');
            Route::delete('/force-delete-all', [ShopSupplierController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:shop-suppliers-delete');
        });
        Route::get('suppliers',        [ShopSupplierController::class, 'index'])
            ->middleware('permission:shop-suppliers-view');
        Route::post('suppliers',       [ShopSupplierController::class, 'store'])
            ->middleware('permission:shop-suppliers-create');
        Route::put('suppliers/{id}',   [ShopSupplierController::class, 'update'])
            ->middleware('permission:shop-suppliers-update');
        Route::patch('suppliers/{id}', [ShopSupplierController::class, 'update'])
            ->middleware('permission:shop-suppliers-update');
        Route::delete('suppliers/{id}', [ShopSupplierController::class, 'destroy'])
            ->middleware('permission:shop-suppliers-delete');

        // Shop Logs
        Route::prefix('logs')->group(function () {
            Route::get('/',     [ShopLogController::class, 'index'])
                ->middleware('permission:shop-view-logs');
            Route::post('/',    [ShopLogController::class, 'store']);
            Route::get('/{id}', [ShopLogController::class, 'show'])
                ->middleware('permission:shop-view-logs');
        });

        // Coupons
        Route::prefix('coupons')->group(function () {
            // No bulk delete / import for this resource yet.
            Route::get('/{id}',                [ShopCouponController::class, 'show'])
                ->middleware('permission:shop-coupons-view');
            Route::post('/{id}/restore',       [ShopCouponController::class, 'restore'])
                ->middleware('permission:shop-coupons-delete');
            Route::delete('/force-delete-all', [ShopCouponController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:shop-coupons-delete');
        });
        Route::get('coupons',        [ShopCouponController::class, 'index'])
            ->middleware('permission:shop-coupons-view');
        Route::post('coupons',       [ShopCouponController::class, 'store'])
            ->middleware('permission:shop-coupons-create');
        Route::put('coupons/{id}',   [ShopCouponController::class, 'update'])
            ->middleware('permission:shop-coupons-update');
        Route::patch('coupons/{id}', [ShopCouponController::class, 'update'])
            ->middleware('permission:shop-coupons-update');
        Route::delete('coupons/{id}', [ShopCouponController::class, 'destroy'])
            ->middleware('permission:shop-coupons-delete');

        // Categories
        Route::prefix('categories')->group(function () {
            // No bulk delete for this resource yet.
            Route::get('/{id}', [ShopCategoryController::class, 'show'])
                ->middleware('permission:shop-categories-view');
        });
        Route::get('categories',        [ShopCategoryController::class, 'index'])
            ->middleware('permission:shop-categories-view');
        Route::post('categories',       [ShopCategoryController::class, 'store'])
            ->middleware('permission:shop-categories-create');
        Route::put('categories/{id}',   [ShopCategoryController::class, 'update'])
            ->middleware('permission:shop-categories-update');
        Route::patch('categories/{id}', [ShopCategoryController::class, 'update'])
            ->middleware('permission:shop-categories-update');
        Route::delete('categories/{id}', [ShopCategoryController::class, 'destroy'])
            ->middleware('permission:shop-categories-delete');

        // Shipping Methods
        Route::prefix('shipping_methods')->group(function () {
            // No bulk delete for this resource yet.
            Route::get('/{id}',                [ShopShippingMethodController::class, 'show'])
                ->middleware('permission:shop-shipping-methods-view');
            Route::post('/{id}/restore',       [ShopShippingMethodController::class, 'restore'])
                ->middleware('permission:shop-shipping-methods-delete');
            Route::delete('/force-delete-all', [ShopShippingMethodController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:shop-shipping-methods-delete');
        });
        Route::get('shipping_methods',        [ShopShippingMethodController::class, 'index'])
            ->middleware('permission:shop-shipping-methods-view');
        Route::post('shipping_methods',       [ShopShippingMethodController::class, 'store'])
            ->middleware('permission:shop-shipping-methods-create');
        Route::put('shipping_methods/{id}',   [ShopShippingMethodController::class, 'update'])
            ->middleware('permission:shop-shipping-methods-update');
        Route::patch('shipping_methods/{id}', [ShopShippingMethodController::class, 'update'])
            ->middleware('permission:shop-shipping-methods-update');
        Route::delete('shipping_methods/{id}', [ShopShippingMethodController::class, 'destroy'])
            ->middleware('permission:shop-shipping-methods-delete');

        // Payment methods (index / update only - no destroy(), no bulk delete).
        Route::prefix('payment_methods')->group(function () {
            Route::get('/{id}', [ShopPaymentMethodController::class, 'show'])
                ->middleware('permission:shop-payment-methods-view');
        });
        Route::get('payment_methods',        [ShopPaymentMethodController::class, 'index'])
            ->middleware('permission:shop-payment-methods-view');
        Route::put('payment_methods/{id}',   [ShopPaymentMethodController::class, 'update'])
            ->middleware('permission:shop-payment-methods-update');
        Route::patch('payment_methods/{id}', [ShopPaymentMethodController::class, 'update'])
            ->middleware('permission:shop-payment-methods-update');

    });
    /*
    |----------------------------------------------------------------------
    | WEB
    |----------------------------------------------------------------------
    */
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
            Route::post('/',    [WebLogController::class, 'store']);
            Route::get('/{id}', [WebLogController::class, 'show'])
                ->middleware('permission:web-view-web-logs');
        });

        // ── web/support_tickets ────────────────────────────────────────────
        Route::prefix('support_tickets')->group(function () {
            Route::post('/bulk-delete', [WebSupportTicketController::class, 'bulkDestroy'])
                ->middleware('permission:web-support-tickets-delete');
            Route::delete('/force-delete-all', [WebSupportTicketController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-support-tickets-delete');
                Route::get('/import/template', [WebSupportTicketController::class, 'importTemplate'])
        ->middleware('permission:web-support-tickets-create');
    Route::post('/import/validate', [WebSupportTicketController::class, 'importValidate'])
        ->middleware(['throttle:30,1,import-support-tickets-validate', 'permission:web-support-tickets-create']);
    Route::post('/import/commit', [WebSupportTicketController::class, 'importCommit'])
        ->middleware(['throttle:30,1,import-support-tickets-commit', 'permission:web-support-tickets-create']);
            Route::get('/',      [WebSupportTicketController::class, 'index'])
                ->middleware('permission:web-support-tickets-view');
            Route::post('/',     [WebSupportTicketController::class, 'store'])
                ->middleware('permission:web-support-tickets-create');
            Route::get('/{id}',  [WebSupportTicketController::class, 'show'])
                ->middleware('permission:web-support-tickets-view');
            Route::put('/{id}',  [WebSupportTicketController::class, 'update'])
                ->middleware('permission:web-support-tickets-update');
            Route::patch('/{id}', [WebSupportTicketController::class, 'update'])
                ->middleware('permission:web-support-tickets-update');
            Route::post('/{id}/restore', [WebSupportTicketController::class, 'restore'])
                ->middleware('permission:web-support-tickets-delete');
            Route::delete('/{id}', [WebSupportTicketController::class, 'destroy'])
                ->middleware('permission:web-support-tickets-delete');
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

        // ── web/news ────────────────────────────────────────────────────────
        Route::prefix('news')->group(function () {
            Route::post('/bulk-delete', [WebNewsController::class, 'bulkDestroy'])
                ->middleware('permission:web-news-delete');
            Route::delete('/force-delete-all', [WebNewsController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-news-delete');
                  Route::get('/import/template', [WebNewsController::class, 'importTemplate'])
        ->middleware('permission:web-news-create');
    Route::post('/import/validate', [WebNewsController::class, 'importValidate'])
        ->middleware(['throttle:30,1,import-news-validate', 'permission:web-news-create']);
    Route::post('/import/commit', [WebNewsController::class, 'importCommit'])
        ->middleware(['throttle:30,1,import-news-commit', 'permission:web-news-create']);
            Route::get('/',      [WebNewsController::class, 'index'])
                ->middleware('permission:web-news-view');
            Route::post('/',     [WebNewsController::class, 'store'])
                ->middleware('permission:web-news-create');
            Route::get('/{id}',  [WebNewsController::class, 'show'])
                ->middleware('permission:web-news-view');
            Route::put('/{id}',  [WebNewsController::class, 'update'])
                ->middleware('permission:web-news-update');
            Route::patch('/{id}', [WebNewsController::class, 'update'])
                ->middleware('permission:web-news-update');
            Route::post('/{id}/restore', [WebNewsController::class, 'restore'])
                ->middleware('permission:web-news-delete');
            Route::delete('/{id}', [WebNewsController::class, 'destroy'])
                ->middleware('permission:web-news-delete');
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

        // ── web/projects ─────────────────────────────────────────────────────
        Route::prefix('projects')->group(function () {
            Route::post('/bulk-delete', [WebProjectController::class, 'bulkDestroy'])
                ->middleware('permission:web-projects-delete');
            Route::delete('/force-delete-all', [WebProjectController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-projects-delete');

            Route::get('/',      [WebProjectController::class, 'index'])
                ->middleware('permission:web-projects-view');
            Route::post('/',     [WebProjectController::class, 'store'])
                ->middleware('permission:web-projects-create');
            Route::get('/{id}',  [WebProjectController::class, 'show'])
                ->middleware('permission:web-projects-view');
            Route::put('/{id}',  [WebProjectController::class, 'update'])
                ->middleware('permission:web-projects-update');
            Route::patch('/{id}', [WebProjectController::class, 'update'])
                ->middleware('permission:web-projects-update');
            Route::post('/{id}/restore', [WebProjectController::class, 'restore'])
                ->middleware('permission:web-projects-delete');
            Route::delete('/{id}', [WebProjectController::class, 'destroy'])
                ->middleware('permission:web-projects-delete');

            // Regenerating the password is security sensitive (it ends every active customer session -
            // WebProjectController::regeneratePassword()), but whoever may edit a project may reset its
            // access: the same permission as update(), no extra key.
            Route::post('/{id}/regenerate-password', [WebProjectController::class, 'regeneratePassword'])
                ->middleware('permission:web-projects-update');

            // ── Checkpoints (nested under a project) ──────────────────
            Route::post('/{projectId}/checkpoints', [WebProjectController::class, 'storeCheckpoint'])
                ->middleware('permission:web-projects-update');
            Route::put('/{projectId}/checkpoints/{checkpointId}', [WebProjectController::class, 'updateCheckpoint'])
                ->middleware('permission:web-projects-update');
            Route::delete('/{projectId}/checkpoints/{checkpointId}', [WebProjectController::class, 'destroyCheckpoint'])
                ->middleware('permission:web-projects-update');
        });

        // ── web/project-threads ───────────────────────────────────────────────
        Route::prefix('project-threads')->group(function () {
            Route::get('/',    [WebProjectThreadController::class, 'index'])
                ->middleware('permission:web-projects-view');
            Route::get('/{id}', [WebProjectThreadController::class, 'show'])
                ->middleware('permission:web-projects-view');
            Route::post('/{threadId}/reply', [WebProjectThreadController::class, 'reply'])
                ->middleware('permission:web-projects-update');
            Route::put('/{threadId}/status', [WebProjectThreadController::class, 'updateStatus'])
                ->middleware('permission:web-projects-update');
            Route::get('/{threadId}/messages', [WebProjectThreadController::class, 'olderMessages'])
                ->middleware('permission:web-projects-view');
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