<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

// Importy kontrolerů
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\TranslationController;

use App\Http\Controllers\Api\Core\CoreRoleController;
use App\Http\Controllers\Api\Core\CoreSiteSettingController; // ⚙️ Nový kontroler pro globální konfiguraci

use App\Http\Controllers\Api\Legal\DocumentSectionController;
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
use App\Http\Controllers\Api\Shop\ShopOrderController; // 📦 Objednávky
use App\Http\Controllers\Api\Shop\ShopCustomerController; // 👥 Zákazníci
use App\Http\Controllers\Api\Shop\ShopCheckoutController; // 💳 Importováno pro checkout a platbu
use App\Http\Controllers\Api\Shop\ShopPublicController; // 🌍 Nový veřejný kontroler
use App\Http\Controllers\Api\Legal\SiteConfigurationController; // 🌍 Nový veřejný kontroler

/*
|--------------------------------------------------------------------------
| 🛒 VEŘEJNÉ E-SHOP TRASY (Bez autorizace - Angular ShopPublicService)
|--------------------------------------------------------------------------
*/
Route::prefix('shop/public')->group(function () {
    
    Route::get('status', [ShopPublicController::class, 'getStatus']);
    // ⚙️ VEŘEJNÉ NASTAVENÍ: Angular potřebuje vědět, zda je e-shop aktivní i v době údržby.
    // Proto je tato ruta umístěna MIMO ochranný middleware 'shop.active'.
    Route::get('settings', [CoreSiteSettingController::class, 'publicShow']);

    // Všechny ostatní klientské požadavky spadající pod e-shop se v případě vypnutí zablokují (503)
    Route::middleware('shop.active')->group(function () {
        // Produkty
        Route::get('products', [ShopProductController::class, 'publicIndex']);
        Route::get('products/{slugOrId}', [ShopProductController::class, 'publicShow']);
        
        // ZABEZPEČENO: Kontrola skladu z košíku (Maximálně 15 dotazů za minutu z jedné IP adresy)
        Route::get('products/{id}/check-stock', [ShopPublicController::class, 'checkStock'])
            ->middleware('throttle:15,1');
        
        // Kategorie pro filtry a menu
        Route::get('categories', [ShopCategoryController::class, 'index']);

        // Dopravní a platební metody pro pokladnu
        Route::get('shipping-methods', [ShopPublicController::class, 'getShippingMethods']);
        Route::get('payment-methods', [ShopPublicController::class, 'getPaymentMethods']);

        // Ověření kupónu v košíku
        Route::post('coupons/validate', [ShopPublicController::class, 'validateCoupon']);
    });
});

/*
|--------------------------------------------------------------------------
| 💳 DOKONČENÍ OBJEDNÁVKY (Košík -> Pokladna)
|--------------------------------------------------------------------------
| Jistič pro nákupní proces. Pokud admin vypne shop, okamžitě se zablokuje tvorba objednávek.
*/
Route::prefix('shop/checkout')->middleware('shop.active')->group(function () {
    Route::post('create-order', [ShopCheckoutController::class, 'createOrder']);
    Route::post('simulate-payment', [ShopCheckoutController::class, 'simulatePayment']);
});

/*
|--------------------------------------------------------------------------
| 🌍 VEŘEJNÉ PRÁVNÍ DOKUMENTY (Public Access)
|--------------------------------------------------------------------------
*/
/*
|--------------------------------------------------------------------------
| 🌍 VEŘEJNÉ PRÁVNÍ DOKUMENTY A NASTAVENÍ (Public Access)
|--------------------------------------------------------------------------
*/
Route::prefix('public/legal')->group(function () {
    
    // 1. NEJPRVE statické cesty
    Route::get('/config', [App\Http\Controllers\Api\Legal\SiteConfigurationController::class, 'publicShow']);

    // 2. AŽ POTOM dynamické cesty s parametry (slug)
    Route::get('/{slug}', [App\Http\Controllers\Api\Legal\DocumentSectionController::class, 'publicShow']);
});
/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/
Route::get('/sanctum/csrf-cookie', function (Request $request) {
    return response()->json([], 204);
});

// ZABEZPEČENO: Ochrana proti zkoušení hesel (Brute Force) - max 5 pokusů za minutu
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/refresh', [AuthController::class, 'refresh']);

// 🟢 VEŘEJNÉ FORMULÁŘE (Zvenčí z webu bez /web prefixu)
Route::post('raw_request_commissions', [WebRawRequestCommissionController::class, 'store']);
Route::post('sales_orders', [WebSalesOrderController::class, 'store']);
Route::post('job_applications', [WebJobApplicationController::class, 'store']);

Route::get('/download-file/{folder}/{file}', function ($folder, $file) {
    $path = $folder . '/' . $file;
    if (!Storage::disk('public')->exists($path)) abort(404);
    return Storage::disk('public')->download($path);
})->where('file', '.*');


/*
|--------------------------------------------------------------------------
| Protected Routes (Auth:Sanctum) + PLOŠNÝ RATE LIMITING
|--------------------------------------------------------------------------
*/
// ZABEZPEČENO: Pokud unikne token, útočník je zpomenen limitem 100 požadavků za minutu per IP
Route::middleware(['auth:sanctum', 'throttle:100,1'])->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/save_translations', [TranslationController::class, 'save']);

    /*
    |--------------------------------------------------------------------------
    | ⚙️ SECTION: CORE
    |--------------------------------------------------------------------------
    */
    Route::prefix('core')->group(function () {
        
        // ⚙️ Globální konfigurace a správa údržby e-shopu pro administrátory
        Route::prefix('settings')->group(function () {
            Route::get('/', [CoreSiteSettingController::class, 'show']);
            Route::put('/', [CoreSiteSettingController::class, 'update']);
        });

        // Users
        Route::prefix('users')->group(function () {
            Route::post('/', [UserController::class, 'store']);
            Route::get('/{id}', [UserController::class, 'show']);
            Route::post('/{id}/restore', [UserController::class, 'restore']);
            Route::put('/{id}/change-password', [UserController::class, 'changePassword']);
            Route::delete('/force-delete-all', [UserController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('users', UserController::class)
            ->except(['store', 'create', 'edit'])
            ->parameters(['users' => 'id']);

        // Roles
        Route::prefix('roles')->group(function () {
            Route::post('/{id}/restore', [CoreRoleController::class, 'restore']);
            Route::delete('/force-delete-all', [CoreRoleController::class, 'forceDeleteAllTrashed']);
            Route::get('/{id}', [CoreRoleController::class, 'show']);
        });
        Route::apiResource('roles', CoreRoleController::class)
            ->except(['store', 'create', 'edit'])
            ->parameters(['roles' => 'id']);
    });


    /*
    |--------------------------------------------------------------------------
    | 🛒 SECTION: SHOP
    |--------------------------------------------------------------------------
    */
    Route::prefix('shop')->group(function () {

        // Products (Produkty) 📦
        Route::prefix('products')->group(function () {
            // 🔥 TATO ROUTA ZAJISTÍ BEZPEČNÝ PATCH UPDATE POUZE PRO KATEGORII
            Route::patch('/{id}/category', [ShopProductController::class, 'updateCategory']);
            Route::get('/{id}', [ShopProductController::class, 'show']);
            Route::post('/{id}/restore', [ShopProductController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopProductController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('products', ShopProductController::class)
            ->parameters(['products' => 'id']);

        // Customers (Zákazníci) 👥
        Route::prefix('customers')->group(function () {
            Route::get('/{id}', [ShopCustomerController::class, 'show']);
            Route::post('/{id}/restore', [ShopCustomerController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopCustomerController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('customers', ShopCustomerController::class)
            ->parameters(['customers' => 'id']);

        // Orders (Objednávky) 📋
        Route::prefix('orders')->group(function () {
            Route::get('/{id}', [ShopOrderController::class, 'show']);
            Route::post('/{id}/restore', [ShopOrderController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopOrderController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('orders', ShopOrderController::class)
            ->parameters(['orders' => 'id']);

        // Suppliers (Dodavatelé)
        Route::prefix('suppliers')->group(function () {
            Route::get('/{id}', [ShopSupplierController::class, 'show']);
            Route::post('/{id}/restore', [ShopSupplierController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopSupplierController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('suppliers', ShopSupplierController::class)
            ->parameters(['suppliers' => 'id']);

        // Shop Logs
        Route::prefix('logs')->group(function () {
            Route::get('/', [ShopLogController::class, 'index']);
            Route::post('/', [ShopLogController::class, 'store']);
            Route::get('/{id}', [ShopLogController::class, 'show']);
        });

        // Coupons (Slevové kupóny)
        Route::prefix('coupons')->group(function () {
            Route::get('/{id}', [ShopCouponController::class, 'show']);
            Route::post('/{id}/restore', [ShopCouponController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopCouponController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('coupons', ShopCouponController::class)
            ->parameters(['coupons' => 'id']);

        // Categories (Kategorie)
        Route::prefix('categories')->group(function () {
            Route::get('/{id}', [ShopCategoryController::class, 'show']);
        });
        Route::apiResource('categories', ShopCategoryController::class)
            ->parameters(['categories' => 'id']);

        // Shipping Methods (Doprava)
        Route::prefix('shipping_methods')->group(function () {
            Route::get('/{id}', [ShopShippingMethodController::class, 'show']);
            Route::post('/{id}/restore', [ShopShippingMethodController::class, 'restore']);
            Route::delete('/force-delete-all', [ShopShippingMethodController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('shipping_methods', ShopShippingMethodController::class)
            ->parameters(['shipping_methods' => 'id']);

        // Payment Methods (Platba) 💳
        Route::prefix('payment_methods')->group(function () {
            Route::get('/{id}', [ShopPaymentMethodController::class, 'show']);
        });
        Route::apiResource('payment_methods', ShopPaymentMethodController::class)
            ->only(['index', 'update'])
            ->parameters(['payment_methods' => 'id']);
    });

    /*
    |--------------------------------------------------------------------------
    | 🌍 SECTION: WEB
    |--------------------------------------------------------------------------
    */
    Route::prefix('web')->group(function () {

        // Job Applications
        Route::prefix('job_applications')->group(function () {
            Route::get('/{id}', [WebJobApplicationController::class, 'show']); 
            Route::post('/{id}/restore', [WebJobApplicationController::class, 'restore']);
            Route::delete('/force-delete-all', [WebJobApplicationController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('job_applications', WebJobApplicationController::class)
            ->parameters(['job_applications' => 'id']);

        // Web Logs
        Route::prefix('logs')->group(function () {
            Route::get('/', [WebLogController::class, 'index']);
            Route::post('/', [WebLogController::class, 'store']);
            Route::get('/{id}', [WebLogController::class, 'show']);
        });

        // Support Tickets
        Route::prefix('support_tickets')->group(function () {
            Route::get('/{id}', [WebSupportTicketController::class, 'show']); 
            Route::post('/{id}/restore', [WebSupportTicketController::class, 'restore']);
            Route::delete('/force-delete-all', [WebSupportTicketController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('support_tickets', WebSupportTicketController::class)
            ->parameters(['support_tickets' => 'id']);

        // RawRequestCommission
        Route::prefix('raw_request_commissions')->group(function () {
            Route::get('/{id}', [WebRawRequestCommissionController::class, 'show']);
            Route::post('/{id}/restore', [WebRawRequestCommissionController::class, 'restore']);
            Route::delete('/force-delete-all', [WebRawRequestCommissionController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('raw_request_commissions', WebRawRequestCommissionController::class)
            ->parameters(['raw_request_commissions' => 'id']); 

        // SalesOrder
        Route::prefix('sales_orders')->group(function () {
            Route::get('/{id}', [WebSalesOrderController::class, 'show']); 
            Route::post('/{id}/restore', [WebSalesOrderController::class, 'restore']);
            Route::delete('/force-delete-all', [WebSalesOrderController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('sales_orders', WebSalesOrderController::class)
            ->parameters(['sales_orders' => 'id']); 

        // News
        Route::prefix('news')->group(function () {
            Route::get('/{id}', [WebNewsController::class, 'show']);
            Route::post('/{id}/restore', [WebNewsController::class, 'restore']);
            Route::delete('/force-delete-all', [WebNewsController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('news', WebNewsController::class)
            ->parameters(['news' => 'id']);

        // SalesLeads
        Route::prefix('sales_leads')->group(function () {
            Route::get('/{id}', [WebSalesLeadController::class, 'show']);
            Route::post('/{id}/restore', [WebSalesLeadController::class, 'restore']);
            Route::delete('/force-delete-all', [WebSalesLeadController::class, 'forceDeleteAllTrashed']);
        });
        Route::apiResource('sales_leads', WebSalesLeadController::class)
            ->parameters(['sales_leads' => 'id']);
    });

    // LEGAL
    Route::prefix('legal')->group(function () {

        // Správa sekcí dokumentů
        Route::prefix('document-sections')->group(function () {
            Route::get('/', [DocumentSectionController::class, 'index']);
            Route::post('/', [DocumentSectionController::class, 'store']);
            Route::get('/{id}', [DocumentSectionController::class, 'show']);
            Route::put('/{id}', [DocumentSectionController::class, 'update']);
            Route::delete('/{id}', [DocumentSectionController::class, 'destroy']);
        });

        // Konfigurace webu (firemní údaje + sociální sítě)
        Route::prefix('config')->group(function () {
            Route::get('/', [SiteConfigurationController::class, 'index']);          // GET  /api/legal/config
            Route::put('/settings', [SiteConfigurationController::class, 'updateSettings']); // PUT  /api/legal/config/settings
            Route::post('/social', [SiteConfigurationController::class, 'storeSocial']);     // POST /api/legal/config/social
            Route::put('/social/{id}', [SiteConfigurationController::class, 'updateSocial']); // PUT  /api/legal/config/social/{id}
            Route::delete('/social/{id}', [SiteConfigurationController::class, 'destroySocial']); // DELETE /api/legal/config/social/{id}
        });
    });
});