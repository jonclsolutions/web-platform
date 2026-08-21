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
 *      odpovídaly 1:1 klíčům použitým v `admin-routing.module.ts`/`admin-layout.component.html`
 *      na frontendu. `core/roles` a `core/permissions` (matice oprávnění) záměrně NEmají
 *      permission middleware - jsou chráněné výhradně `role_name === 'sysadmin'` kontrolou
 *      přímo v CoreRoleController (edit-roles stránka na frontendu používá `sysadminGuard`,
 *      ne permission systém - viz odůvodnění v CoreRoleController).
 * @refactor-note (2026-08-2) `POST /web/logs`, `POST /shop/logs`, `POST /core/logs`
 *      záměrně BEZ permission middleware (na rozdíl od GET routes ve stejné skupině) -
 *      jde o zápis VLASTNÍHO audit záznamu (např. TableBuilderComponent.logExportActivity()
 *      po exportu tabulky z libovolné admin stránky), ne o čtení cizích logů. Uživatel
 *      s např. jen `web-news-view` musí moct zalogovat export novinek, i když nemá
 *      `web-view-web-logs` na ČTENÍ historie logů - jinak export projde, ale zápis do
 *      auditu tiše spadne na 403. GET (čtení historie) permission vyžaduje i nadále.
 * @refactor-note (2026-08-4) KRITICKÁ BEZPEČNOSTNÍ OCHRANA - implicitní route-model-binding
 *      bug u core/roles (viz CoreRoleController hlavička) a chybějící pořadí routy
 *      `force-delete-all` PŘED `DELETE /{id}` u core/users (Laravel matchuje routy v pořadí
 *      zápisu - string "force-delete-all" by jinak spadl do parametru {id} u destroy() a byl
 *      odmítnut jako neplatné ID). Stejné pořadí (force-delete-all první) je proto dodrženo
 *      důsledně u VŠECH apiResource skupin níže, ne jen u core/users.
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU: permission klíče dosud
 *      gatovaly CELÝ zdroj jedním klíčem (index/store/show/update/destroy/restore dohromady
 *      pod např. `web-view-news`), takže kdokoliv s přístupem na stránku mohl zdroj i mazat
 *      nebo vytvářet, i kdyby měl mít jen právo číst. Klíče nahrazeny sadou 4 granulárních
 *      akcí `{resource}-view / -create / -update / -delete` (restore a force-delete-all
 *      spadají pod `-delete`, protože jde o správu koše = destruktivní akce, ne o čtení).
 *      Zároveň přejmenovány klíče zdrojů, které reálně žijí pod `/core` routou, ale nesly
 *      historický prefix `web-` (administrators, external_links, legal) - nově důsledně
 *      `core-*`. Zdroje s veřejným formulářem (sales_leads, sales_orders, job_applications,
 *      support_tickets) DOSTÁVAJÍ i `-create` navzdory veřejné routě mimo tuto skupinu -
 *      admin/obchodník může založit záznam i ručně přes tento interní `apiResource`
 *      endpoint (jiná URL, jiná autentizace, ale stejná `store()` metoda). `web-edit-legal`
 *      rozdělen na `core-legal-documents-*` (GDPR/TOS/Cookies texty) a `core-legal-config-*`
 *      (firemní config + sociální sítě), protože jde o dva věcně odlišné zdroje, které dřív
 *      sdílely jeden klíč. Migrace permission tabulek (core_permissions,
 *      core_role_permissions) proběhla samostatným SQL skriptem mimo Laravel migrace
 *      (projekt migrace nepoužívá, jede z SQL dumpu).
 * @refactor-note (2026-08-15) PŘESUN SHOP MAINTENANCE Z CORE DO SHOP SEKCE. Endpoint
 *      `core/settings` přestal gatovat shop toggle - `shop-set-maintenance-mode` permission
 *      klíč přesunut na nový vyhrazený blok `shop/settings`, obsluhovaný
 *      `ShopSiteSettingController`. Veřejný `shop/public/settings` endpoint přepojen z
 *      `CoreSiteSettingController::publicShow` na `ShopSiteSettingController::publicShow`.
 * @refactor-note (2026-08-15) PŘESUN WEB MAINTENANCE Z CORE DO WEB SEKCE + ZRUŠENÍ
 *      `core/settings`. Po přesunu shop (viz výše) zůstala v `core_site_settings` už jen
 *      web maintenance - tabulka i controller (`CoreSiteSettingController`,
 *      `App\Models\Core\CoreSiteSetting`, `core_site_settings`) proto ZRUŠENY ÚPLNĚ, ne jen
 *      vyprázdněny. Web maintenance přesunuta do nového bloku `web/settings`
 *      (`WebSiteSettingController`, `App\Models\Web\WebSiteSetting`, tabulka
 *      `web_site_settings`), gatováno stávajícím klíčem `web-set-maintenance-mode`
 *      (beze změny názvu, jen endpoint). Veřejný `web/public/status`
 *      (`WebPublicController::getStatus`) zůstává jediným public endpointem pro web status -
 *      žádný nový `web/public/settings` nebyl zaveden, protože ani dřív neexistoval.
 *      `core-settings-view`/`core-settings-update` permission klíče smazány (SQL skript),
 *      protože už nemají co gatovat. Zbylé klíče `web-view-web-logs`, `web-view-dashboard`,
 *      `web-view-personal-info` (selfParam výjimka), `web-view-edit-website`, `view-deleted`,
 *      `view-web`, `view-eshop`, `view-core`, `core-view-welcome-page`, celá shop sekce
 *      (nižší priorita, granularizace plánována v budoucím tasku) a `core/roles` +
 *      `core/permissions` (chráněno sysadmin kontrolou) - beze změny.
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
    Route::get('settings', [ShopSiteSettingController::class, 'publicShow']);

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

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

Route::post('/login/verify-2fa', [AuthController::class, 'verifyTwoFactor'])
    ->middleware('throttle:10,1');

Route::post('/login/resend-2fa', [AuthController::class, 'resendTwoFactor'])
    ->middleware('throttle:login-2fa-resend');

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

Route::get('/download-file/{folder}/{file}', [PublicFileDownloadController::class, 'download'])
    ->where('file', '.*');

Route::get('/view-file/{folder}/{file}', [PublicFileDownloadController::class, 'view'])
    ->where('file', '.*');

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

        // ── core/users ────────────────────────────────────────────────────
        // {id} routy mají 'selfParam' => id (viz CheckPermission) - vlastní účet
        // (personal-info stránka) je dostupný i bez core-administrators-*.
        // Routy BEZ {id} (index/store/force-delete-all) sebe-výjimku nemají.
        // @refactor-note (2026-08-5): klíč přejmenován web-manage-administrators ->
        // core-administrators-{view,create,update,delete} (granularizace + sjednocení
        // prefixu na core-, protože zdroj reálně žije pod /core routou).
        Route::prefix('users')->group(function () {
            // POZOR: 'force-delete-all' MUSÍ být definovaná před 'DELETE /{id}' -
            // Laravel matchuje routy v pořadí zápisu, jinak by string "force-delete-all"
            // spadl do parametru {id} destroy() a byl odmítnut jako neplatné ID.
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
            Route::post('/{id}/restore', [UserController::class, 'restore'])
                ->middleware('permission:core-administrators-delete');
            Route::delete('/{id}', [UserController::class, 'destroy'])
                ->middleware('permission:core-administrators-delete');
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

        // ── web/external_links → přejmenováno na core-external-links-* ────
        // @refactor-note (2026-08-5): web-manage-external-links -> core-external-links-*
        // (sjednocení prefixu, zdroj žije pod /core stránkou External Links).
        Route::prefix('external_links')->group(function () {
            Route::delete('/force-delete-all', [CoreExternalLinkController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:core-external-links-delete');
            Route::get('/',      [CoreExternalLinkController::class, 'index'])
                ->middleware('permission:core-external-links-view');
            Route::post('/',     [CoreExternalLinkController::class, 'store'])
                ->middleware('permission:core-external-links-create');
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
        // Pozn.: external_links jsou navíc scoped na vlastníka přímo v kontroleru
        // (viz WebExternalLinkContCoreExternalLinkControllerroller - plně soukromé per uživatel), permission
        // middleware tady jen ověřuje, že uživatel má na stránku vůbec přístup.

    });

    /*
    |----------------------------------------------------------------------
    | SHOP
    |----------------------------------------------------------------------
    | @note (2026-08-5) Shop sekce zatím NENÍ granularizována (view/create/update/delete)
    | - nižší priorita, plánováno do budoucího tasku. Klíče beze změny.
    | @refactor-note (2026-08-15) Blok `shop/settings` (maintenance toggle) přesunutý
    |    z bývalého core/settings - viz ShopSiteSettingController a hlavička souboru.
    */
    Route::prefix('shop')->group(function () {

        // Přepínač údržby e-shopu (dashboard karta). Přesunuto z core/settings.
        Route::prefix('settings')->group(function () {
            Route::get('/', [ShopSiteSettingController::class, 'show'])
                ->middleware('permission:shop-set-maintenance-mode');
            Route::put('/', [ShopSiteSettingController::class, 'update'])
                ->middleware('permission:shop-set-maintenance-mode');
        });

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
    | @refactor-note (2026-08-15) Blok `web/settings` (maintenance toggle) nově
    |    přesunutý z bývalého core/settings - viz WebSiteSettingController a
    |    hlavička souboru. `web-set-maintenance-mode` permission klíč beze změny.
    */
    Route::prefix('web')->group(function () {

        // Přepínač údržby webu (dashboard karta). Přesunuto z core/settings.
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
        // @refactor-note (2026-08-5): web-view-job-applications -> web-job-applications-*.
        // '-create' zachováno i pro tuto interní apiResource routu (jiná URL/auth než
        // veřejný POST /job_applications výše) - admin/HR může uchazeče založit ručně.
        Route::prefix('job_applications')->group(function () {
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

        
        // web/logs — stejný princip: POST (zápis exportu/akce z libovolné web stránky)
        // bez permission middleware, GET (čtení historie) s permission.
        Route::prefix('logs')->group(function () {
            Route::get('/',     [WebLogController::class, 'index'])
                ->middleware('permission:web-view-web-logs');
            Route::post('/',    [WebLogController::class, 'store']);
            Route::get('/{id}', [WebLogController::class, 'show'])
                ->middleware('permission:web-view-web-logs');
        });

        // ── web/support_tickets ────────────────────────────────────────────
        // @refactor-note (2026-08-5): web-view-support-tickets -> web-support-tickets-*.
        // '-create' přidáno záměrně - tickety jsou INTERNÍ (na ICT), žádná veřejná routa
        // pro ně neexistuje, takže store() musí být gatovaný stejně jako ostatní akce.
        Route::prefix('support_tickets')->group(function () {
            Route::delete('/force-delete-all', [WebSupportTicketController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-support-tickets-delete');
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
        // @note (2026-08-5) Granularizováno JAKO PRVNÍ v samostatném dřívějším kroku:
        // web-view-user-requests -> web-user-requests-{view,create,update,delete}.
        Route::prefix('raw_request_commissions')->group(function () {
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
        // @refactor-note (2026-08-5): web-view-sales-orders -> web-sales-orders-*.
        // '-create' zachováno i pro tuto interní apiResource routu (jiná URL/auth než
        // veřejný POST /sales_orders výše) - obchodník může objednávku založit ručně.
        Route::prefix('sales_orders')->group(function () {
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
        // @refactor-note (2026-08-5): web-view-news -> web-news-*.
        Route::prefix('news')->group(function () {
            Route::delete('/force-delete-all', [WebNewsController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-news-delete');
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
        // @refactor-note (2026-08-5): web-view-sales-leads -> web-sales-leads-*.
        // generate-link je de facto úprava leadu (vytváří/vrací public_token) -> -update.
        Route::prefix('sales_leads')->group(function () {
            Route::delete('/force-delete-all', [WebSalesLeadController::class, 'forceDeleteAllTrashed'])
                ->middleware('permission:web-sales-leads-delete');
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
            // Vygeneruje/vrátí public_token daného leadu + sestavenou URL na order_form.
            Route::post('/{id}/generate-link', [WebSalesLeadController::class, 'generateLink'])
                ->middleware('permission:web-sales-leads-update');
        });
    });

    /*
    |----------------------------------------------------------------------
    | LEGAL — spravováno na core/edit-legal stránce (GDPR/TOS/Cookies)
    |----------------------------------------------------------------------
    | @refactor-note (2026-08-5): web-edit-legal rozdělen na dva věcně odlišné zdroje,
    | které dřív sdílely jeden klíč: core-legal-documents-* (texty GDPR/TOS/Cookies)
    | a core-legal-config-* (firemní config + sociální sítě v patičce).
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