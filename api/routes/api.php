<?php

/**
 * @file routes/api.php
 * @path routes/api.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Defines all application API endpoints, including public access for the
 * frontend, checkout processes, and protected administrative routes.
 *
 * @refactor-note (2026-08-23c) PŘECHOD Z GENERICKÉHO IMPORT/BULK-DELETE NA PER-CONTROLLER.
 * Dřívější `core/import/*` (ImportController + config/importable_resources.php) a
 * `core/bulk_delete` (BulkDeleteController + config/bulk_deletable_resources.php) byly
 * ZAHOZENY - generický zápis/mazání by u resources se speciální byznys logikou ve
 * store()/destroy() (vlastnictví, úklid souborů, GDPR souhlas, sysadmin ochrana...)
 * tuhle logiku tiše obešel. Každý resource má teď VLASTNÍ `bulkDestroy()` a případně
 * `importTemplate()/importValidate()/importCommit()` metody přímo ve svém kontroleru,
 * které přirozeně sdílejí stejná pravidla jako `destroy()`/`store()` (viz jednotlivé
 * kontrolery a bulk_destroy_recipe.txt/bulk_import_recipe.txt).
 *
 * Stav k tomuto datu:
 * - bulkDestroy() hotovo: web/raw_request_commissions, web/job_applications, web/news,
 *   web/sales_leads, web/sales_orders, web/support_tickets.
 * - Import hotovo: web/raw_request_commissions (BEZ potvrzovacího e-mailu - záměr).
 * - Import se VĚDOMĚ NEDĚLÁ pro web/sales_orders (atomická vazba na lead_token + GDPR
 *   souhlas, který nelze retroaktivně "odsouhlasit" za importovaná data).
 * - Shop sekce a `core/users`/`core/roles`/`core/external_links` zatím BEZ bulk
 *   delete/importu - viz zakomentované TODO bloky u shopu níže. `core/users` a
 *   `core/external_links` mají per-row byznys logiku (sysadmin ochrana, vlastnictví),
 *   která vyžaduje vlastní bezpečnostní rozbor před přidáním - ne mechanické doplnění.
 *
 * @refactor-note (2026-08-24) BACKLOG "workflow zakládání účtů z adminu": nové veřejné
 * (nepřihlášené) endpointy `account-activation/{token}` (GET ověří odkaz, POST nastaví
 * heslo a aktivuje účet) - viz AccountActivationController. Do chráněné `core/users`
 * skupiny přidána `POST /{id}/resend-activation` (znovu odeslat aktivační odkaz účtu,
 * který se ještě nikdy neaktivoval). Účty teď vznikají BEZ hesla
 * (`UserController::store()`) - uživatel si ho nastaví sám přes aktivační odkaz, nikdo
 * jiný (ani admin) tak nikdy nezná cizí heslo.
 *
 * @bugfix-note (2026-08-25) KRITICKÁ CHYBA - VŠECHNY NEPOJMENOVANÉ `throttle:X,Y`
 * LIMITERY SDÍLELY JEDEN SPOLEČNÝ BUCKET. Laravelův vestavěný `ThrottleRequests`
 * middleware generuje cache klíč VÝHRADNĚ z `$prefix . resolveRequestSignature($request)`,
 * kde `resolveRequestSignature()` bez přihlášeného uživatele vrací `sha1($ip)` a
 * s přihlášeným uživatelem `sha1($user->id)` - NIKDY nezahrnuje konkrétní route ani
 * čísla `maxAttempts`/`decayMinutes`, která je za dvojtečkou. Bez explicitního TŘETÍHO
 * parametru (`throttle:max,decay,PREFIX`) tak VŠECHNY `throttle:X,Y` zápisy na
 * NEPŘIHLÁŠENÝCH routách (`/forgot-password`, `/reset-password`, `/sales_orders`,
 * `/account-activation/*`, `/login/verify-2fa`, `shop/public/.../check-stock`, fallback
 * `scan_probe`) pro danou IP sdílely JEDEN counter - request na jednu routu tak mohl
 * vyčerpat limit úplně jiné, nesouvisející routy. Prokázáno reálným testem
 * (`attack_security_monitoring.sh`): sekce testující throttle na `/sales_orders` a
 * `/forgot-password` vyčerpaly sdílený counter natolik, že SAMOSTATNÉ pozdější testy na
 * `/account-activation/*`, `/reset-password` a `/login/verify-2fa` skončily rovnou 429
 * (throttle), aniž by se ty routy samotné vůbec „přetížily“ - a v produkci by tímtéž
 * mechanismem mohl útočník bušící do `/sales_orders` nechtěně (nebo cíleně jako DoS)
 * zablokovat legitimního uživatele resetujícího heslo ze stejné IP (firemní síť/VPN).
 * Analogicky uvnitř CHRÁNĚNÉ (`auth:sanctum`) skupiny sdílely stejný per-uživatelský
 * bucket VŠECHNY `throttle:30,1` importní endpointy napříč resources (suppliers, news,
 * support_tickets, raw_request_commissions, sales_leads) - admin importující `news`
 * mohl nechtěně vyčerpat budget i na import `suppliers`.
 *
 * ŘEŠENÍ: KAŽDÝ nepojmenovaný `throttle:X,Y` zápis dostal vlastní unikátní TŘETÍ
 * parametr (prefix) - viz komentáře u jednotlivých routes níže. Číselné limity
 * (`maxAttempts`/`decayMinutes`) zůstávají VŠUDE BEZE ZMĚNY, mění se VÝHRADNĚ izolace
 * bucketů - pro legitimní provoz je to buď neutrální, nebo (v případě dřívějšího
 * falešného křížení mezi nesouvisejícími endpointy) fakticky MÉNĚ restriktivní, nikdy
 * ne víc. Pojmenované limitery (`throttle:login`, `throttle:login-2fa-resend`, viz
 * `AppServiceProvider::boot()`) NEBYLY dotčeny - ty už mají vlastní explicitní klíče
 * (`login-ip:`/`login-email:`/`2fa-resend-ip:`) a byly izolované správně už předtím.
 */

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AccountActivationController;
use App\Http\Controllers\Api\Auth\PasswordResetController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\TranslationController;
use App\Http\Controllers\Api\Core\CoreRoleController;
use App\Http\Controllers\Api\Core\CorePermissionController;
use App\Http\Controllers\Api\Core\CoreSecurityEventController;
use App\Http\Controllers\Api\Core\CoreSecuritySettingController;
use App\Http\Controllers\Api\Legal\DocumentSectionController;
use App\Http\Controllers\Api\Legal\SiteConfigurationController;
use App\Http\Controllers\Api\Web\WebRawRequestCommissionController;
use App\Http\Controllers\Api\Web\WebLogController;
use App\Http\Controllers\Api\Web\WebSalesLeadController;
use App\Http\Controllers\Api\Web\WebNewsController;
use App\Http\Controllers\Api\Web\WebSalesOrderController;
use App\Http\Controllers\Api\Web\WebSupportTicketController;
use App\Http\Controllers\Api\Web\WebJobApplicationController;
use App\Http\Controllers\Api\Web\WebSiteSettingController;
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
use App\Http\Controllers\Api\PublicFileDownloadController;
use App\Models\Core\CoreSecurityEvent;

/*
|--------------------------------------------------------------------------
| LANGUAGES — public access (frontend does not require a token)
|--------------------------------------------------------------------------
| Only GET for language lists and translations — no mutations without authorization.
*/
Route::get('languages/{module}', [TranslationController::class, 'getLanguages']);
Route::get('translations/{module}/{lang}', [TranslationController::class, 'show']);

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
        // Prefix 'shop-check-stock' - viz bugfix-note (2026-08-25) v hlavičce souboru.
        Route::get('products/{id}/check-stock', [ShopPublicController::class, 'checkStock'])
            ->middleware('throttle:15,1,shop-check-stock');
        Route::get('categories', [ShopCategoryController::class, 'index']);
        Route::get('shipping-methods', [ShopPublicController::class, 'getShippingMethods']);
        Route::get('payment-methods', [ShopPublicController::class, 'getPaymentMethods']);
        Route::post('coupons/validate', [ShopPublicController::class, 'validateCoupon']);
    });
});
/*
|--------------------------------------------------------------------------
| PUBLIC WEB STATUS
|--------------------------------------------------------------------------
*/
Route::get('web/public/status', [WebPublicController::class, 'getStatus']);
/*
|--------------------------------------------------------------------------
| CHECKOUT
|--------------------------------------------------------------------------
*/
Route::prefix('shop/checkout')->middleware('shop.active')->group(function () {
    Route::post('create-order', [ShopCheckoutController::class, 'createOrder']);
    Route::post('simulate-payment', [ShopCheckoutController::class, 'simulatePayment']);
});

/*
|--------------------------------------------------------------------------
| PUBLIC LEGAL DOCUMENTS AND CONFIGURATION
|--------------------------------------------------------------------------
*/
Route::prefix('public/legal')->group(function () {
    Route::get('/config', [SiteConfigurationController::class, 'publicShow']);
    Route::get('/{slug}', [DocumentSectionController::class, 'publicShow']);
});

/*
|--------------------------------------------------------------------------
| PUBLIC SALES LEADS — resolve by unguessable token (order form prefill)
|--------------------------------------------------------------------------
| Slouží OrderFormComponent k předvyplnění formuláře podle odkazu, který lead
| dostal od obchodníka (viz WebSalesLeadController::generateLink v chráněné
| sekci níže). NIKDY nepřidávat sem přístup podle interního `id` - jen `token`.
*/
Route::prefix('public')->group(function () {
    Route::get('sales-leads/{token}', [WebSalesLeadController::class, 'showByToken']);
});

/*
|--------------------------------------------------------------------------
| ACCOUNT ACTIVATION — public, token-based (účet založený adminem bez hesla)
|--------------------------------------------------------------------------
| @refactor-note (2026-08-24) BACKLOG "workflow zakládání účtů z adminu": odkaz z
| AccountActivationMail (viz UserController::store()/resendActivation()). GET ověří
| platnost tokenu bez jeho spotřebování, POST nastaví heslo, aktivuje účet
| (`activated_at`) a token spotřebuje. Throttle chrání proti hrubému hádání tokenů
| (token samotný je 64znakový random string, ale defense-in-depth se nevyplácí
| přeskakovat ani tady).
| @bugfix-note (2026-08-25) Prefixy 'account-activation-show'/'account-activation-activate'
| - viz hlavička souboru. Bez nich sdílely bucket s /forgot-password, /sales_orders atd.
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
Route::get('/sanctum/csrf-cookie', fn(Request $r) => response()->json([], 204));

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

// Prefix 'login-verify-2fa' - viz bugfix-note (2026-08-25) v hlavičce souboru.
Route::post('/login/verify-2fa', [AuthController::class, 'verifyTwoFactor'])
    ->middleware('throttle:10,1,login-verify-2fa');

Route::post('/login/resend-2fa', [AuthController::class, 'resendTwoFactor'])
    ->middleware('throttle:login-2fa-resend');

Route::post('/refresh', [AuthController::class, 'refresh']);

/*
|--------------------------------------------------------------------------
| Password reset (public) — krok 1 (vyžádání odkazu) a krok 5 (nastavení nového hesla)
|--------------------------------------------------------------------------
| Throttle per-IP proti hrubému útoku / enumeraci; interní audit log viz. web_system_logs.
| @bugfix-note (2026-08-25) Prefixy 'password-forgot'/'password-reset' - viz hlavička souboru.
*/
Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword'])
    ->middleware('throttle:5,1,password-forgot');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])
    ->middleware('throttle:10,1,password-reset');

// Public web forms
Route::post('raw_request_commissions', [WebRawRequestCommissionController::class, 'store']);
// Prefix 'sales-orders' - viz bugfix-note (2026-08-25) v hlavičce souboru (tenhle
// endpoint byl hlavní zdroj falešného křížení v reálném testu skriptu).
Route::post('sales_orders', [WebSalesOrderController::class, 'store'])
    ->middleware('throttle:10,1,sales-orders');
Route::post('job_applications',        [WebJobApplicationController::class, 'store']);

Route::get('/download-file/{folder}/{file}', [PublicFileDownloadController::class, 'download'])
    ->where('file', '.*');

Route::get('/view-file/{folder}/{file}', [PublicFileDownloadController::class, 'view'])
    ->where('file', '.*');

/*
|--------------------------------------------------------------------------
| Protected Routes (auth:sanctum + rate limit)
|--------------------------------------------------------------------------
| @note `throttle:300,1` zde NEPOTŘEBOVAL prefix - resolveRequestSignature() u
| PŘIHLÁŠENÉHO uživatele klíčuje podle user_id, ne podle IP, takže je od veřejných
| (nepřihlášených) throttle bucketů výše přirozeně oddělený už teď - auth:sanctum
| middleware navíc běží PŘED throttle, takže sem se bez platného uživatele vůbec
| nedostaneme.
*/
Route::middleware(['auth:sanctum', 'throttle:300,1'])->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user',    [AuthController::class, 'user']);

    // ── Translations / Languages — spravováno na stránce "Správa Webu" (edit-website) ──
    Route::post('/save_translations/{module}', [TranslationController::class, 'save'])
        ->middleware('permission:web-view-edit-website');

    Route::prefix('languages')->middleware('permission:web-view-edit-website')->group(function () {
        Route::post('/{module}',     [TranslationController::class, 'saveLanguages']);
        Route::post('/{module}/{code}/icon', [TranslationController::class, 'storeLanguageIcon']);
        Route::delete('/{module}/{code}',    [TranslationController::class, 'destroyLanguage']);
    });

    /*
    |----------------------------------------------------------------------
    | CORE
    |----------------------------------------------------------------------
    | @refactor-note (2026-08-15): blok `core/settings` (CoreSiteSettingController)
    |    ZRUŠEN celý - viz hlavička souboru. Web maintenance žije nově pod `web/settings`
    |    (WEB sekce níže), shop maintenance pod `shop/settings` (SHOP sekce níže).
    */
    Route::prefix('core')->group(function () {

        // POST bez permission middleware - zápis vlastního audit záznamu (viz
        // @refactor-note 2026-08-2 v hlavičce souboru). GET (čtení historie) chráněno.
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

        // ── core/users ────────────────────────────────────────────────────
        // {id} routy mají 'selfParam' => id (viz CheckPermission) - vlastní účet
        // (personal-info stránka) je dostupný i bez core-administrators-*.
        //
        // TODO (budoucí task): bulk-delete/import pro core/users VĚDOMĚ zatím NEEXISTUJE.
        // UserController::destroy() obsahuje sysadmin ochranu (nelze smazat sám sebe,
        // jen sysadmin smí smazat jiného sysadmina) - bulkDestroy() by musel tuhle logiku
        // přesně replikovat, ne obejít. Import navíc musí řešit hashování hesla a
        // přiřazení role - vyžaduje samostatný bezpečnostní rozbor před implementací.
        //
        // @refactor-note (2026-08-24) `resend-activation` přidána vedle `change-password` -
        // znovu odešle aktivační odkaz účtu, který se ještě nikdy neaktivoval (viz
        // UserController::resendActivation()).
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
            Route::post('/{id}/resend-activation', [UserController::class, 'resendActivation'])
                ->middleware('permission:core-administrators-update');
            Route::post('/{id}/restore', [UserController::class, 'restore'])
                ->middleware('permission:core-administrators-delete');
            Route::delete('/{id}', [UserController::class, 'destroy'])
                ->middleware('permission:core-administrators-delete');
        });

        Route::get('/permissions', [CorePermissionController::class, 'index']);

        // core/roles - záměrně BEZ permission middleware. Chráněno výhradně
        // role_name === 'sysadmin' kontrolou přímo v CoreRoleController.
        // TODO: bulk-delete pro role VĚDOMĚ zatím NEEXISTUJE - hromadné smazání rolí
        // může osiřet uživatele bez role, potřebuje vlastní rozbor, ne mechanické přidání.
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
        // TODO: bulk-delete VĚDOMĚ zatím NEEXISTUJE - destroy() je scoped na vlastníka
        // ($request->user()->externalLinks()), bulkDestroy() musí replikovat STEJNÝ
        // scope, jinak by šlo hromadně smazat cizí odkazy jen uhodnutím ID.
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
    | @note (2026-08-5) Shop sekce zatím NENÍ granularizována (view/create/update/delete).
    | @todo (2026-08-23) BULK-DELETE / IMPORT PRO SHOP KONTROLERY ZATÍM NEIMPLEMENTOVÁNO.
    |    Až budou ShopProductController/ShopOrderController/ShopCategoryController/
    |    ShopCustomerController/ShopSupplierController/ShopCouponController/
    |    ShopShippingMethodController mít doplněné bulkDestroy() (+ případně import*()),
    |    routy se přidají SEM, stejným vzorem jako u web sekce - VŽDY před `Route::get('/{id}'`
    |    /`Route::delete('/{id}'` ve stejné skupině. Konkrétní rizika k prověření před
    |    přidáním (viz bulk_destroy_recipe.txt): ShopProduct (obrázky/varianty na disku),
    |    ShopOrder (možný dopad na sklad), ShopCategory (rodič/potomek strom),
    |    ShopCustomer (vazba na objednávky).
    */
    Route::prefix('shop')->group(function () {

        Route::prefix('settings')->group(function () {
            Route::get('/', [ShopSiteSettingController::class, 'show'])
                ->middleware('permission:shop-set-maintenance-mode');
            Route::put('/', [ShopSiteSettingController::class, 'update'])
                ->middleware('permission:shop-set-maintenance-mode');
        });

        // Products
        Route::prefix('products')->middleware('permission:shop-manage-products')->group(function () {
            // TODO: Route::post('/bulk-delete', [ShopProductController::class, 'bulkDestroy']);
            // TODO: Route::get('/import/template', [ShopProductController::class, 'importTemplate']);
            // TODO: Route::post('/import/validate', [ShopProductController::class, 'importValidate'])->middleware('throttle:30,1');
            // TODO: Route::post('/import/commit', [ShopProductController::class, 'importCommit'])->middleware('throttle:30,1');
            Route::patch('/{id}/category',     [ShopProductController::class, 'updateCategory']);
            Route::get('/{id}',                [ShopProductController::class, 'show']);
            Route::post('/{id}/restore',       [ShopProductController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopProductController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('products', ShopProductController::class)
            ->parameters(['products' => 'id'])
            ->middleware('permission:shop-manage-products');

        // Customers
        Route::prefix('customers')->middleware('permission:shop-manage-customers')->group(function () {
            // TODO: Route::post('/bulk-delete', [ShopCustomerController::class, 'bulkDestroy']);
            // TODO: Route::get('/import/template', [ShopCustomerController::class, 'importTemplate']);
            // TODO: Route::post('/import/validate', [ShopCustomerController::class, 'importValidate'])->middleware('throttle:30,1');
            // TODO: Route::post('/import/commit', [ShopCustomerController::class, 'importCommit'])->middleware('throttle:30,1');
            Route::get('/{id}',                [ShopCustomerController::class, 'show']);
            Route::post('/{id}/restore',       [ShopCustomerController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopCustomerController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('customers', ShopCustomerController::class)
            ->parameters(['customers' => 'id'])
            ->middleware('permission:shop-manage-customers');

        // Orders
        Route::prefix('orders')->middleware('permission:shop-view-orders')->group(function () {
            // TODO: Route::post('/bulk-delete', [ShopOrderController::class, 'bulkDestroy']);
            // (import pro orders pravděpodobně nedává smysl - obdobný důvod jako
            // web/sales_orders, prověřit až budeme u tohohle kontroleru)
            Route::get('/{id}',                [ShopOrderController::class, 'show']);
            Route::post('/{id}/restore',       [ShopOrderController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopOrderController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('orders', ShopOrderController::class)
            ->parameters(['orders' => 'id'])
            ->middleware('permission:shop-view-orders');

        // Suppliers
        // @bugfix-note (2026-08-25) Prefixy 'import-suppliers-validate'/'import-suppliers-commit'
        // - viz hlavička souboru (import throttly napříč resources dřív sdílely jeden
        // per-uživatelský bucket).
        Route::prefix('suppliers')->middleware('permission:shop-manage-suppliers')->group(function () {
            Route::post('/bulk-delete', [ShopSupplierController::class, 'bulkDestroy'])
        ->middleware('permission:shop-manage-suppliers');
    Route::get('/import/template', [ShopSupplierController::class, 'importTemplate'])
        ->middleware('permission:shop-manage-suppliers');
    Route::post('/import/validate', [ShopSupplierController::class, 'importValidate'])
        ->middleware(['throttle:30,1,import-suppliers-validate', 'permission:shop-manage-suppliers']);
    Route::post('/import/commit', [ShopSupplierController::class, 'importCommit'])
        ->middleware(['throttle:30,1,import-suppliers-commit', 'permission:shop-manage-suppliers']);
            Route::get('/{id}',                [ShopSupplierController::class, 'show']);
            Route::post('/{id}/restore',       [ShopSupplierController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopSupplierController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('suppliers', ShopSupplierController::class)
            ->parameters(['suppliers' => 'id'])
            ->middleware('permission:shop-manage-suppliers');

        // Shop Logs
        Route::prefix('logs')->group(function () {
            Route::get('/',     [ShopLogController::class, 'index'])
                ->middleware('permission:shop-view-logs');
            Route::post('/',    [ShopLogController::class, 'store']);
            Route::get('/{id}', [ShopLogController::class, 'show'])
                ->middleware('permission:shop-view-logs');
        });

        // Coupons
        Route::prefix('coupons')->middleware('permission:shop-view-reports')->group(function () {
            // TODO: Route::post('/bulk-delete', [ShopCouponController::class, 'bulkDestroy']);
            // TODO: Route::get('/import/template', [ShopCouponController::class, 'importTemplate']);
            // TODO: Route::post('/import/validate', [ShopCouponController::class, 'importValidate'])->middleware('throttle:30,1');
            // TODO: Route::post('/import/commit', [ShopCouponController::class, 'importCommit'])->middleware('throttle:30,1');
            Route::get('/{id}',                [ShopCouponController::class, 'show']);
            Route::post('/{id}/restore',       [ShopCouponController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopCouponController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('coupons', ShopCouponController::class)
            ->parameters(['coupons' => 'id'])
            ->middleware('permission:shop-view-reports');

        // Categories
        Route::prefix('categories')->middleware('permission:shop-manage-categories')->group(function () {
            // TODO: Route::post('/bulk-delete', [ShopCategoryController::class, 'bulkDestroy']);
            // (pozor na rodič/potomek strukturu - viz bulk_destroy_recipe.txt)
            Route::get('/{id}', [ShopCategoryController::class, 'show']);
        });
        Route::apiResource('categories', ShopCategoryController::class)
            ->parameters(['categories' => 'id'])
            ->middleware('permission:shop-manage-categories');

        // Shipping Methods
        Route::prefix('shipping_methods')->middleware('permission:shop-manage-shipping-methods')->group(function () {
            // TODO: Route::post('/bulk-delete', [ShopShippingMethodController::class, 'bulkDestroy']);
            Route::get('/{id}',                [ShopShippingMethodController::class, 'show']);
            Route::post('/{id}/restore',       [ShopShippingMethodController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopShippingMethodController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('shipping_methods', ShopShippingMethodController::class)
            ->parameters(['shipping_methods' => 'id'])
            ->middleware('permission:shop-manage-shipping-methods');

        // Payment Methods (jen index/update - žádné destroy(), bulk-delete se netýká)
        Route::prefix('payment_methods')->middleware('permission:shop-manage-payment-methods')->group(function () {
            Route::get('/{id}', [ShopPaymentMethodController::class, 'show']);
        });
        Route::apiResource('payment_methods', ShopPaymentMethodController::class)
            ->only(['index', 'update'])
            ->parameters(['payment_methods' => 'id'])
            ->middleware('permission:shop-manage-payment-methods');

        // TODO (budoucí task): EditEshopController zatím neexistuje.
    });

    /*
    |----------------------------------------------------------------------
    | WEB
    |----------------------------------------------------------------------
    */
    Route::prefix('web')->group(function () {

        Route::prefix('settings')->group(function () {
            Route::get('/', [WebSiteSettingController::class, 'show'])
                ->middleware('permission:web-set-maintenance-mode');
            Route::put('/', [WebSiteSettingController::class, 'update'])
                ->middleware('permission:web-set-maintenance-mode');
            Route::get('/raw-request-email-template', [WebSiteSettingController::class, 'showRawRequestEmailTemplate'])
                ->middleware('permission:web-user-requests-update');
            Route::put('/raw-request-email-template', [WebSiteSettingController::class, 'updateRawRequestEmailTemplate'])
                ->middleware('permission:web-user-requests-update');
        });

        // ── web/job_applications ─────────────────────────────────────────
        // bulkDestroy() hotovo. Import zatím NE - čeká na StoreWebJobApplicationRequest.
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
        // bulkDestroy() hotovo. Import zatím NE (nebylo požadováno).
        // @bugfix-note (2026-08-25) Prefixy 'import-support-tickets-validate'/'-commit'
        // - viz hlavička souboru.
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
        // bulkDestroy() I import HOTOVO KOMPLETNĚ (import bez potvrzovacího e-mailu -
        // viz WebRawRequestCommissionController hlavička).
        // @bugfix-note (2026-08-25) Prefixy 'import-raw-request-validate'/'-commit'
        // - viz hlavička souboru.
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
        // bulkDestroy() hotovo. Import ZÁMĚRNĚ NIKDY - viz WebSalesOrderController
        // hlavička (atomický lead_token + GDPR souhlas, nelze retroaktivně importovat).
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
        // bulkDestroy() hotovo. Import zatím NE - čeká na StoreWebNewsRequest.
        // @bugfix-note (2026-08-25) Prefixy 'import-news-validate'/'import-news-commit'
        // - viz hlavička souboru.
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
        // bulkDestroy() hotovo. Import zatím NE (store() má defaultní přiřazení
        // salesman_name/user_id, které by import musel replikovat - neřešeno zatím).
        // @bugfix-note (2026-08-25) Prefixy 'import-sales-leads-validate'/'-commit'
        // - viz hlavička souboru.
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

    /*
    |----------------------------------------------------------------------
    | LEGAL — spravováno na core/edit-legal stránce (GDPR/TOS/Cookies)
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
            Route::post('/social',       [SiteConfigurationController::class, 'storeSocial'])
                ->middleware('permission:core-legal-config-create');
            Route::put('/social/{id}',   [SiteConfigurationController::class, 'updateSocial'])
                ->middleware('permission:core-legal-config-update');
            Route::delete('/social/{id}', [SiteConfigurationController::class, 'destroySocial'])
                ->middleware('permission:core-legal-config-delete');
        });
    });
});

/*
|--------------------------------------------------------------------------
| SCANNING / PROBING DETECTION — MUSÍ zůstat úplně na konci souboru
|--------------------------------------------------------------------------
| @refactor-note (2026-08-22) BEZPEČNOSTNÍ MONITORING (krok 2): `Route::fallback()`
| se aktivuje jen tehdy, když žádná jiná routa výše požadavek nezachytí. Proto MUSÍ
| být registrována jako úplně poslední.
|
| Typický vzorec automatizovaného skenování zranitelností. Throttle `throttle:30,1`
| chrání SAMOTNOU fallback routu před tím, aby se stala novým zdrojem zátěže.
| `CoreSecurityEvent::record()` je bucketované (viz model), takže i bez throttle by
| DB zápis zůstal levný, ale HTTP odpověď samotná má svou cenu, kterou throttle omezuje.
| Tahle routa nemá přihlášeného uživatele nikdy (je mimo chráněnou skupinu), takže
| filtr "jen nepřihlášené requesty" z throttle handleru (bootstrap/app.php) se na ni
| ani nemusí vztahovat - zůstává vždy zaznamenaná.
| @bugfix-note (2026-08-25) Prefix 'scan-probe' - viz hlavička souboru. Bez něj mohl
| scanning z jedné IP vyčerpat/zkreslit throttle bucket sdílený s jinými veřejnými
| routami zasaženými ze stejné IP, a naopak.
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