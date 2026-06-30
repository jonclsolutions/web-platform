<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

// Importy kontrolerů
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\TranslationController;

use App\Http\Controllers\Api\Core\CoreRoleController;
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

/*
|--------------------------------------------------------------------------
| 🌐 JAZYKY — veřejné načtení (frontend nepotřebuje token)
|--------------------------------------------------------------------------
| Jen GET seznam jazyků a překlady — žádné mutace bez autorizace.
*/
Route::get('languages/{module}', [TranslationController::class, 'getLanguages']);
// Nová dynamická routa pro překlady rozdělená podle modulů (např. /api/translations/web/cz)
Route::get('translations/{module}/{lang}', [TranslationController::class, 'show']);
/*
|--------------------------------------------------------------------------
| 🛒 VEŘEJNÉ E-SHOP TRASY
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
| 💳 POKLADNA
|--------------------------------------------------------------------------
*/
Route::prefix('shop/checkout')->middleware('shop.active')->group(function () {
    Route::post('create-order', [ShopCheckoutController::class, 'createOrder']);
    Route::post('simulate-payment', [ShopCheckoutController::class, 'simulatePayment']);
});

/*
|--------------------------------------------------------------------------
| 🌍 VEŘEJNÉ PRÁVNÍ DOKUMENTY A NASTAVENÍ
|--------------------------------------------------------------------------
*/
Route::prefix('public/legal')->group(function () {
    Route::get('/config', [SiteConfigurationController::class, 'publicShow']);
    Route::get('/{slug}', [DocumentSectionController::class, 'publicShow']);
});

/*
|--------------------------------------------------------------------------
| Autentizace (public)
|--------------------------------------------------------------------------
*/
Route::get('/sanctum/csrf-cookie', fn(Request $r) => response()->json([], 204));

Route::post('/login',   [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/refresh', [AuthController::class, 'refresh']);

// Veřejné formuláře z webu
Route::post('raw_request_commissions', [WebRawRequestCommissionController::class, 'store']);
Route::post('sales_orders',            [WebSalesOrderController::class, 'store']);
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

    // ── Překlady ──────────────────────────────────────────────
    // Nyní přijímá i modul, aby věděl, kam JSON uložit
    Route::post('/save_translations/{module}', [TranslationController::class, 'save']);

// ── Jazyky — mutace jsou chráněné ─────────────────────────
    Route::prefix('languages')->group(function () {
        // POST uložení seznamu
        Route::post('/{module}',     [TranslationController::class, 'saveLanguages']);
        // Ikonky
        Route::post('/{module}/{code}/icon', [TranslationController::class, 'storeLanguageIcon']);
        // Smazání
        Route::delete('/{module}/{code}',    [TranslationController::class, 'destroyLanguage']);
    });

    /*
    |----------------------------------------------------------------------
    | ⚙️ CORE
    |----------------------------------------------------------------------
    */
    Route::prefix('core')->group(function () {

        Route::prefix('settings')->group(function () {
            Route::get('/', [CoreSiteSettingController::class, 'show']);
            Route::put('/', [CoreSiteSettingController::class, 'update']);
        });

        Route::prefix('users')->group(function () {
            Route::post('/',                         [UserController::class, 'store']);
            Route::get('/{id}',                      [UserController::class, 'show']);
            Route::post('/{id}/restore',             [UserController::class, 'restore']);
            Route::put('/{id}/change-password',      [UserController::class, 'changePassword']);
            Route::delete('/force-delete-all',       [UserController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('users', UserController::class)
            ->except(['store', 'create', 'edit'])
            ->parameters(['users' => 'id']);

        Route::prefix('roles')->group(function () {
            Route::post('/{id}/restore',       [CoreRoleController::class, 'restore']);
            Route::delete('/force-delete-all', [CoreRoleController::class, 'forceDeleteAllTrashed']);
            Route::get('/{id}',                [CoreRoleController::class, 'show']);
        });
        Route::apiResource('roles', CoreRoleController::class)
            ->except(['store', 'create', 'edit'])
            ->parameters(['roles' => 'id']);
    });

    /*
    |----------------------------------------------------------------------
    | 🛒 SHOP
    |----------------------------------------------------------------------
    */
    Route::prefix('shop')->group(function () {

        // Products
        Route::prefix('products')->group(function () {
            Route::patch('/{id}/category',     [ShopProductController::class, 'updateCategory']);
            Route::get('/{id}',                [ShopProductController::class, 'show']);
            Route::post('/{id}/restore',       [ShopProductController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopProductController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('products', ShopProductController::class)
            ->parameters(['products' => 'id']);

        // Customers
        Route::prefix('customers')->group(function () {
            Route::get('/{id}',                [ShopCustomerController::class, 'show']);
            Route::post('/{id}/restore',       [ShopCustomerController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopCustomerController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('customers', ShopCustomerController::class)
            ->parameters(['customers' => 'id']);

        // Orders
        Route::prefix('orders')->group(function () {
            Route::get('/{id}',                [ShopOrderController::class, 'show']);
            Route::post('/{id}/restore',       [ShopOrderController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopOrderController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('orders', ShopOrderController::class)
            ->parameters(['orders' => 'id']);

        // Suppliers
        Route::prefix('suppliers')->group(function () {
            Route::get('/{id}',                [ShopSupplierController::class, 'show']);
            Route::post('/{id}/restore',       [ShopSupplierController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopSupplierController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('suppliers', ShopSupplierController::class)
            ->parameters(['suppliers' => 'id']);

        // Shop Logs
        Route::prefix('logs')->group(function () {
            Route::get('/',     [ShopLogController::class, 'index']);
            Route::post('/',    [ShopLogController::class, 'store']);
            Route::get('/{id}', [ShopLogController::class, 'show']);
        });

        // Coupons
        Route::prefix('coupons')->group(function () {
            Route::get('/{id}',                [ShopCouponController::class, 'show']);
            Route::post('/{id}/restore',       [ShopCouponController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopCouponController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('coupons', ShopCouponController::class)
            ->parameters(['coupons' => 'id']);

        // Categories
        Route::prefix('categories')->group(function () {
            Route::get('/{id}', [ShopCategoryController::class, 'show']);
        });
        Route::apiResource('categories', ShopCategoryController::class)
            ->parameters(['categories' => 'id']);

        // Shipping Methods
        Route::prefix('shipping_methods')->group(function () {
            Route::get('/{id}',                [ShopShippingMethodController::class, 'show']);
            Route::post('/{id}/restore',       [ShopShippingMethodController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopShippingMethodController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('shipping_methods', ShopShippingMethodController::class)
            ->parameters(['shipping_methods' => 'id']);

        // Payment Methods
        Route::prefix('payment_methods')->group(function () {
            Route::get('/{id}', [ShopPaymentMethodController::class, 'show']);
        });
        Route::apiResource('payment_methods', ShopPaymentMethodController::class)
            ->only(['index', 'update'])
            ->parameters(['payment_methods' => 'id']);
    });

    /*
    |----------------------------------------------------------------------
    | 🌍 WEB
    |----------------------------------------------------------------------
    */
    Route::prefix('web')->group(function () {

        Route::prefix('job_applications')->group(function () {
            Route::get('/{id}',                [WebJobApplicationController::class, 'show']);
            Route::post('/{id}/restore',       [WebJobApplicationController::class, 'restore']);
            Route::delete('/force-delete-all', [WebJobApplicationController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('job_applications', WebJobApplicationController::class)
            ->parameters(['job_applications' => 'id']);

        Route::prefix('logs')->group(function () {
            Route::get('/',     [WebLogController::class, 'index']);
            Route::post('/',    [WebLogController::class, 'store']);
            Route::get('/{id}', [WebLogController::class, 'show']);
        });

        Route::prefix('support_tickets')->group(function () {
            Route::get('/{id}',                [WebSupportTicketController::class, 'show']);
            Route::post('/{id}/restore',       [WebSupportTicketController::class, 'restore']);
            Route::delete('/force-delete-all', [WebSupportTicketController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('support_tickets', WebSupportTicketController::class)
            ->parameters(['support_tickets' => 'id']);

        Route::prefix('raw_request_commissions')->group(function () {
            Route::get('/{id}',                [WebRawRequestCommissionController::class, 'show']);
            Route::post('/{id}/restore',       [WebRawRequestCommissionController::class, 'restore']);
            Route::delete('/force-delete-all', [WebRawRequestCommissionController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('raw_request_commissions', WebRawRequestCommissionController::class)
            ->parameters(['raw_request_commissions' => 'id']);

        Route::prefix('sales_orders')->group(function () {
            Route::get('/{id}',                [WebSalesOrderController::class, 'show']);
            Route::post('/{id}/restore',       [WebSalesOrderController::class, 'restore']);
            Route::delete('/force-delete-all', [WebSalesOrderController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('sales_orders', WebSalesOrderController::class)
            ->parameters(['sales_orders' => 'id']);

        Route::prefix('news')->group(function () {
            Route::get('/{id}',                [WebNewsController::class, 'show']);
            Route::post('/{id}/restore',       [WebNewsController::class, 'restore']);
            Route::delete('/force-delete-all', [WebNewsController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('news', WebNewsController::class)
            ->parameters(['news' => 'id']);

        Route::prefix('sales_leads')->group(function () {
            Route::get('/{id}',                [WebSalesLeadController::class, 'show']);
            Route::post('/{id}/restore',       [WebSalesLeadController::class, 'restore']);
            Route::delete('/force-delete-all', [WebSalesLeadController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('sales_leads', WebSalesLeadController::class)
            ->parameters(['sales_leads' => 'id']);
    });

    /*
    |----------------------------------------------------------------------
    | LEGAL
    |----------------------------------------------------------------------
    */
    Route::prefix('legal')->group(function () {

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