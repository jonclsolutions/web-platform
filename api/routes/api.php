<?php

/**
 * @file routes/api.php
 * @path routes/api.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Defines all application API endpoints, including public access for the frontend, checkout processes, and protected administrative routes.
 * @refactor-note (2026) Přidána veřejná routa `public/sales-leads/{token}` (WebSalesLeadController::showByToken)
 *      pro OrderFormComponent - dohledání leadu podle neuhodnutelného public_token místo
 *      interního `id`. Do chráněné `web/sales_leads` skupiny přidána `POST /{id}/generate-link`
 *      (WebSalesLeadController::generateLink) pro adminy k vygenerování/znovuvyzvednutí
 *      tohoto tokenu. Viz WebSalesLead.php (getOrCreatePublicToken) a WebSalesOrderController::store()
 *      pro navazující atomickou ochranu proti dvojímu odeslání formuláře.
 * @refactor-note (2026-2) `sales_orders` (veřejný, bez auth) doplněn o `throttle:10,1` -
 *      endpoint posílá potvrzovací e-mail na libovolnou `client_email` ze vstupu, takže bez
 *      limitu šlo použít k emailovému bombardování cizí adresy (a poškození doménové
 *      reputace odesílatele). Ostatní veřejné endpointy (login, forgot-password) throttle
 *      už měly, tenhle ho chybně neměl.
 * @refactor-note (2026-08) KRITICKÁ BEZPEČNOSTNÍ OCHRANA: doplněn middleware `permission:...`
 *      na VŠECHNY chráněné admin/core/web/shop/legal endpointy. Dřív existoval permission
 *      systém pouze jako Angular route metadata (`data: { permission }`) - Laravel ho nikdy
 *      nekontroloval, takže jakýkoliv přihlášený uživatel mohl zavolat libovolný endpoint
 *      přímo (mimo UI) bez ohledu na svou roli/oprávnění. Permission klíče u každé skupiny
 *      odpovídají 1:1 klíčům použitým v `admin-routing.module.ts`/`admin-layout.component.html`
 *      na frontendu. `core/users/{id}` routy (show/update/change-password) navíc používají
 *      `selfParam` variantu (`permission:web-manage-administrators,id`), aby zůstaly
 *      dostupné běžnému uživateli pro VLASTNÍ účet (stránka personal-info) i bez
 *      administrátorského oprávnění - viz CheckPermission middleware. `core/roles` a
 *      `core/permissions` (matice oprávnění) záměrně NEmají permission middleware - jsou
 *      chráněné výhradně `role_name === 'sysadmin'` kontrolou přímo v CoreRoleController
 *      (edit-roles stránka na frontendu používá `sysadminGuard`, ne permission systém -
 *      viz odůvodnění v CoreRoleController).
 * @refactor-note (2026-08-2) `POST /web/logs`, `POST /shop/logs`, `POST /core/logs`
 *      záměrně BEZ permission middleware (na rozdíl od GET routes ve stejné skupině) -
 *      jde o zápis VLASTNÍHO audit záznamu (např. TableBuilderComponent.logExportActivity()
 *      po exportu tabulky z libovolné admin stránky), ne o čtení cizích logů. Uživatel
 *      s např. jen `web-view-news` musí moct zalogovat export novinek, i když nemá
 *      `web-view-web-logs` na ČTENÍ historie logů - jinak export projde, ale zápis do
 *      auditu tiše spadne na 403. GET (čtení historie) permission vyžaduje i nadále.
 * @refactor-note (2026-08-3) `CheckPermission` middleware nyní podporuje více klíčů
 *      oddělených `|` (logika OR - stačí kterýkoliv z nich). `core/settings` proto gatuje
 *      `web-view-web-settings|shop-set-maitanance-mode`, protože `CoreSiteSettingController`
 *      obsluhuje jak plný formulář "Firemní údaje", tak rychlý přepínač údržby e-shopu
 *      v headeru - dvě různé skupiny uživatelů, které se nemusí překrývat. (Poznámka:
 *      samotná logika/UX přepínače údržby řešena v samostatném navazujícím tasku.)
 */

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Auth\PasswordResetController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\TranslationController;
use App\Http\Controllers\Api\Core\CoreRoleController;
use App\Http\Controllers\Api\Core\CorePermissionController;
use App\Http\Controllers\Api\Core\CoreSiteSettingController;
use App\Http\Controllers\Api\Legal\DocumentSectionController;
use App\Http\Controllers\Api\Legal\SiteConfigurationController;
use App\Http\Controllers\Api\Web\WebRawRequestCommissionController;
use App\Http\Controllers\Api\Web\WebLogController;
use App\Http\Controllers\Api\Web\WebSalesLeadController;
use App\Http\Controllers\Api\Web\WebNewsController;
use App\Http\Controllers\Api\Web\WebSalesOrderController;
use App\Http\Controllers\Api\Web\WebSupportTicketController;
use App\Http\Controllers\Api\Web\WebJobApplicationController;
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
use App\Http\Controllers\Api\Legal\DocumentTypeController;
use App\Http\Controllers\Api\Web\WebExternalLinkController;
use App\Http\Controllers\Api\Core\CoreLogController;
use App\Http\Controllers\Api\Web\WebPublicController;
/*
|--------------------------------------------------------------------------
| LANGUAGES — public access (frontend does not require a token)
|--------------------------------------------------------------------------
| Only GET for language lists and translations — no mutations without authorization.
*/
Route::get('languages/{module}', [TranslationController::class, 'getLanguages']);
// New dynamic route for translations grouped by modules (e.g., /api/translations/web/cz)
Route::get('translations/{module}/{lang}', [TranslationController::class, 'show']);

/*
|--------------------------------------------------------------------------
| PUBLIC E-SHOP ROUTES
|--------------------------------------------------------------------------
*/
Route::prefix('shop/public')->group(function () {

    Route::get('status', [ShopPublicController::class, 'getStatus']);
    Route::get('settings', [CoreSiteSettingController::class, 'publicShow']);

    Route::middleware('shop.active')->group(function () {
        Route::get('products', [ShopProductController::class, 'publicIndex']);
        Route::get('products/{slugOrId}', [ShopProductController::class, 'publicShow']);
        Route::get('products/{id}/check-stock', [ShopPublicController::class, 'checkStock'])
            ->middleware('throttle:15,1');
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
| Authentication (public)
|--------------------------------------------------------------------------
*/
Route::get('/sanctum/csrf-cookie', fn(Request $r) => response()->json([], 204));

Route::post('/login',   [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/refresh', [AuthController::class, 'refresh']);

/*
|--------------------------------------------------------------------------
| Password reset (public) — krok 1 (vyžádání odkazu) a krok 5 (nastavení nového hesla)
|--------------------------------------------------------------------------
| Throttle per-IP proti hrubému útoku / enumeraci; interní audit log viz. web_system_logs.
*/
Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword'])
    ->middleware('throttle:5,1');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])
    ->middleware('throttle:10,1');

// Public web forms
Route::post('raw_request_commissions', [WebRawRequestCommissionController::class, 'store']);
Route::post('sales_orders', [WebSalesOrderController::class, 'store'])
    ->middleware('throttle:10,1');
Route::post('job_applications',        [WebJobApplicationController::class, 'store']);

Route::get('/download-file/{folder}/{file}', function ($folder, $file) {
    $path = $folder . '/' . $file;
    if (!Storage::disk('public')->exists($path)) abort(404);
    return Storage::disk('public')->download($path);
})->where('file', '.*');

/*
|--------------------------------------------------------------------------
| Protected Routes (auth:sanctum + rate limit)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:100,1'])->group(function () {

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
    */
    Route::prefix('core')->group(function () {

        // Obsluhuje dva různé přístupové body: plný formulář "Firemní údaje"
        // (web-view-web-settings) i rychlý přepínač údržby e-shopu v headeru
        // (shop-set-maitanance-mode) - viz @refactor-note (2026-08-3) výše.
        // UX/logika samotného přepínače řešena v samostatném navazujícím tasku.
        Route::prefix('settings')->middleware('permission:web-view-web-settings|shop-set-maitanance-mode')->group(function () {
            Route::get('/', [CoreSiteSettingController::class, 'show']);
            Route::put('/', [CoreSiteSettingController::class, 'update']);
        });

        // POST bez permission middleware - zápis vlastního audit záznamu (viz
        // @refactor-note 2026-08-2 v hlavičce souboru). GET (čtení historie) chráněno.
        Route::prefix('logs')->group(function () {
            Route::get('/',     [CoreLogController::class, 'index'])
                ->middleware('permission:view-core');
            Route::post('/',    [CoreLogController::class, 'store']);
            Route::get('/{id}', [CoreLogController::class, 'show'])
                ->middleware('permission:view-core');
        });

        // ── core/users ────────────────────────────────────────────────────
        // {id} routy mají 'selfParam' => id (viz CheckPermission) - vlastní účet
        // (personal-info stránka) je dostupný i bez web-manage-administrators.
        // Routy BEZ {id} (index/store/force-delete-all) sebe-výjimku nemají.
       Route::prefix('users')->group(function () {
            // POZOR: 'force-delete-all' MUSÍ být definovaná před 'DELETE /{id}' -
            // Laravel matchuje routy v pořadí zápisu, jinak by string "force-delete-all"
            // spadl do parametru {id} destroy() a byl odmítnut jako neplatné ID.
            Route::delete('/force-delete-all', [UserController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-manage-administrators');

            Route::get('/',    [UserController::class, 'index'])
                ->middleware('permission:web-manage-administrators');
            Route::post('/',   [UserController::class, 'store'])
                ->middleware('permission:web-manage-administrators');
            Route::get('/{id}', [UserController::class, 'show'])
                ->middleware('permission:web-manage-administrators,id');
            Route::put('/{id}', [UserController::class, 'update'])
                ->middleware('permission:web-manage-administrators,id');
            Route::patch('/{id}', [UserController::class, 'update'])
                ->middleware('permission:web-manage-administrators,id');
            Route::put('/{id}/change-password', [UserController::class, 'changePassword'])
                ->middleware('permission:web-manage-administrators,id');
            Route::post('/{id}/restore', [UserController::class, 'restore'])
                ->middleware('permission:web-manage-administrators');
            Route::delete('/{id}', [UserController::class, 'destroy'])
                ->middleware('permission:web-manage-administrators');
        });

        // Seznam všech oprávnění (řádky matice na stránce správy rolí) - jen čtení,
        // NENÍ gated přes permission middleware. Použito výhradně na edit-roles stránce,
        // která je chráněná sysadminGuard (frontend) + actorIsSysadmin() (backend,
        // viz CoreRoleController).
        Route::get('/permissions', [CorePermissionController::class, 'index']);

        // core/roles - záměrně BEZ permission middleware. Chráněno výhradně
        // role_name === 'sysadmin' kontrolou přímo v CoreRoleController
        // (actorIsSysadmin()) - správa rolí/oprávnění nesmí být gated permission
        // klíčem, protože permission klíče jsou přesně to, co se tu edituje (riziko
        // eskalace privilegií). Viz CoreRoleController hlavička souboru.
        Route::prefix('roles')->group(function () {
            // POZOR: 'store' je záměrně mimo apiResource níže (viz ->except),
            // takže musí mít explicitní routu zde - bez ní vytvoření role vůbec nešlo zavolat.
            Route::post('/',                   [CoreRoleController::class, 'store']);
            Route::post('/{id}/restore',       [CoreRoleController::class, 'restore']);
            Route::delete('/force-delete-all', [CoreRoleController::class, 'forceDeleteAllTrashed']);
            Route::get('/{id}',                [CoreRoleController::class, 'show']);
            // Synchronizace oprávnění role z maticového UI ("Uložit oprávnění" u sloupce role).
            Route::put('/{id}/permissions',    [CoreRoleController::class, 'syncPermissions']);
        });
        Route::apiResource('roles', CoreRoleController::class)
            ->except(['store', 'create', 'edit'])
            ->parameters(['roles' => 'id']);
    });

    /*
    |----------------------------------------------------------------------
    | SHOP
    |----------------------------------------------------------------------
    */
    Route::prefix('shop')->group(function () {

        // Products
        Route::prefix('products')->middleware('permission:shop-manage-products')->group(function () {
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
            Route::get('/{id}',                [ShopCustomerController::class, 'show']);
            Route::post('/{id}/restore',       [ShopCustomerController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopCustomerController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('customers', ShopCustomerController::class)
            ->parameters(['customers' => 'id'])
            ->middleware('permission:shop-manage-customers');

        // Orders
        Route::prefix('orders')->middleware('permission:shop-view-orders')->group(function () {
            Route::get('/{id}',                [ShopOrderController::class, 'show']);
            Route::post('/{id}/restore',       [ShopOrderController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopOrderController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('orders', ShopOrderController::class)
            ->parameters(['orders' => 'id'])
            ->middleware('permission:shop-view-orders');

        // Suppliers
        Route::prefix('suppliers')->middleware('permission:shop-manage-suppliers')->group(function () {
            Route::get('/{id}',                [ShopSupplierController::class, 'show']);
            Route::post('/{id}/restore',       [ShopSupplierController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopSupplierController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('suppliers', ShopSupplierController::class)
            ->parameters(['suppliers' => 'id'])
            ->middleware('permission:shop-manage-suppliers');

        // Shop Logs — stejný princip jako core/logs výše: POST bez permission middleware
        // (zápis vlastního audit záznamu z jakékoliv shop stránky), GET s permission.
        Route::prefix('logs')->group(function () {
            Route::get('/',     [ShopLogController::class, 'index'])
                ->middleware('permission:shop-view-logs');
            Route::post('/',    [ShopLogController::class, 'store']);
            Route::get('/{id}', [ShopLogController::class, 'show'])
                ->middleware('permission:shop-view-logs');
        });

        // Coupons
        Route::prefix('coupons')->middleware('permission:shop-view-reports')->group(function () {
            Route::get('/{id}',                [ShopCouponController::class, 'show']);
            Route::post('/{id}/restore',       [ShopCouponController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopCouponController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('coupons', ShopCouponController::class)
            ->parameters(['coupons' => 'id'])
            ->middleware('permission:shop-view-reports');

        // Categories
        Route::prefix('categories')->middleware('permission:shop-manage-categories')->group(function () {
            Route::get('/{id}', [ShopCategoryController::class, 'show']);
        });
        Route::apiResource('categories', ShopCategoryController::class)
            ->parameters(['categories' => 'id'])
            ->middleware('permission:shop-manage-categories');

        // Shipping Methods
        Route::prefix('shipping_methods')->middleware('permission:shop-manage-shipping-methods')->group(function () {
            Route::get('/{id}',                [ShopShippingMethodController::class, 'show']);
            Route::post('/{id}/restore',       [ShopShippingMethodController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopShippingMethodController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('shipping_methods', ShopShippingMethodController::class)
            ->parameters(['shipping_methods' => 'id'])
            ->middleware('permission:shop-manage-shipping-methods');

        // Payment Methods
        Route::prefix('payment_methods')->middleware('permission:shop-manage-payment-methods')->group(function () {
            Route::get('/{id}', [ShopPaymentMethodController::class, 'show']);
        });
        Route::apiResource('payment_methods', ShopPaymentMethodController::class)
            ->only(['index', 'update'])
            ->parameters(['payment_methods' => 'id'])
            ->middleware('permission:shop-manage-payment-methods');

        // TODO (budoucí task): EditEshopController zatím neexistuje. Až vznikne, doplnit
        // sem routy s middlewarem permission:shop-view-edit-eshop (stejný klíč, jaký
        // používá EditEshopComponent na frontendu).
    });

    /*
    |----------------------------------------------------------------------
    | WEB
    |----------------------------------------------------------------------
    */
    Route::prefix('web')->group(function () {

        Route::prefix('job_applications')->middleware('permission:web-view-job-applications')->group(function () {
            Route::get('/{id}',                [WebJobApplicationController::class, 'show']);
            Route::post('/{id}/restore',       [WebJobApplicationController::class, 'restore']);
            Route::delete('/force-delete-all', [WebJobApplicationController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('job_applications', WebJobApplicationController::class)
            ->parameters(['job_applications' => 'id'])
            ->middleware('permission:web-view-job-applications');

        Route::prefix('external_links')->middleware('permission:web-manage-external-links')->group(function () {
            Route::get('/{id}',                [WebExternalLinkController::class, 'show']);
            Route::post('/{id}/restore',       [WebExternalLinkController::class, 'restore']);
            Route::delete('/force-delete-all', [WebExternalLinkController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('external_links', WebExternalLinkController::class)
            ->parameters(['external_links' => 'id'])
            ->middleware('permission:web-manage-external-links');
        // Pozn.: external_links jsou navíc scoped na vlastníka přímo v kontroleru
        // (viz WebExternalLinkController - plně soukromé per uživatel), permission
        // middleware tady jen ověřuje, že uživatel má na stránku vůbec přístup.

        // web/logs — stejný princip: POST (zápis exportu/akce z libovolné web stránky)
        // bez permission middleware, GET (čtení historie) s permission.
        Route::prefix('logs')->group(function () {
            Route::get('/',     [WebLogController::class, 'index'])
                ->middleware('permission:web-view-web-logs');
            Route::post('/',    [WebLogController::class, 'store']);
            Route::get('/{id}', [WebLogController::class, 'show'])
                ->middleware('permission:web-view-web-logs');
        });

        Route::prefix('support_tickets')->middleware('permission:web-view-support-tickets')->group(function () {
            Route::get('/{id}',                [WebSupportTicketController::class, 'show']);
            Route::post('/{id}/restore',       [WebSupportTicketController::class, 'restore']);
            Route::delete('/force-delete-all', [WebSupportTicketController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('support_tickets', WebSupportTicketController::class)
            ->parameters(['support_tickets' => 'id'])
            ->middleware('permission:web-view-support-tickets');

        Route::prefix('raw_request_commissions')->middleware('permission:web-view-user-requests')->group(function () {
            Route::get('/{id}',                [WebRawRequestCommissionController::class, 'show']);
            Route::post('/{id}/restore',       [WebRawRequestCommissionController::class, 'restore']);
            Route::delete('/force-delete-all', [WebRawRequestCommissionController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('raw_request_commissions', WebRawRequestCommissionController::class)
            ->parameters(['raw_request_commissions' => 'id'])
            ->middleware('permission:web-view-user-requests');

        Route::prefix('sales_orders')->middleware('permission:web-view-sales-orders')->group(function () {
            Route::get('/{id}',                [WebSalesOrderController::class, 'show']);
            Route::post('/{id}/restore',       [WebSalesOrderController::class, 'restore']);
            Route::delete('/force-delete-all', [WebSalesOrderController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('sales_orders', WebSalesOrderController::class)
            ->parameters(['sales_orders' => 'id'])
            ->middleware('permission:web-view-sales-orders');

        Route::prefix('news')->middleware('permission:web-view-news')->group(function () {
            Route::get('/{id}',                [WebNewsController::class, 'show']);
            Route::post('/{id}/restore',       [WebNewsController::class, 'restore']);
            Route::delete('/force-delete-all', [WebNewsController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('news', WebNewsController::class)
            ->parameters(['news' => 'id'])
            ->middleware('permission:web-view-news');

        Route::prefix('sales_leads')->middleware('permission:web-view-sales-leads')->group(function () {
            Route::get('/{id}',                [WebSalesLeadController::class, 'show']);
            Route::post('/{id}/restore',       [WebSalesLeadController::class, 'restore']);
            Route::delete('/force-delete-all', [WebSalesLeadController::class, 'forceDeleteAllTrashed']);
            // Vygeneruje/vrátí public_token daného leadu + sestavenou URL na order_form.
            Route::post('/{id}/generate-link', [WebSalesLeadController::class, 'generateLink']);
        });
        Route::apiResource('sales_leads', WebSalesLeadController::class)
            ->parameters(['sales_leads' => 'id'])
            ->middleware('permission:web-view-sales-leads');
    });

    /*
    |----------------------------------------------------------------------
    | LEGAL — spravováno na core/edit-legal stránce (GDPR/TOS/Cookies)
    |----------------------------------------------------------------------
    */
    Route::prefix('legal')->middleware('permission:web-edit-legal')->group(function () {

        Route::get('document-types', [DocumentTypeController::class, 'index']);   // ← nový řádek

        Route::prefix('document-sections')->group(function () {
            Route::get('/',      [DocumentSectionController::class, 'index']);
            Route::post('/',     [DocumentSectionController::class, 'store']);
            Route::get('/{id}',  [DocumentSectionController::class, 'show']);
            Route::put('/{id}',  [DocumentSectionController::class, 'update']);
            Route::delete('/{id}', [DocumentSectionController::class, 'destroy']);
        });

        Route::prefix('config')->group(function () {
            Route::get('/',             [SiteConfigurationController::class, 'index']);
            Route::put('/settings',     [SiteConfigurationController::class, 'updateSettings']);
            Route::post('/social',      [SiteConfigurationController::class, 'storeSocial']);
            Route::put('/social/{id}',  [SiteConfigurationController::class, 'updateSocial']);
            Route::delete('/social/{id}', [SiteConfigurationController::class, 'destroySocial']);
        });
    });
});