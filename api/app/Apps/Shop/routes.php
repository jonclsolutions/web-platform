<?php

/**
 * @file routes.php
 * @path app/Apps/Shop/routes.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description API endpoints of the e-shop application: the public catalogue (shop/public), the
 *   checkout (shop/checkout) and the administration (shop/..., signed-in users with permissions).
 *   Loaded by routes/api.php inside the `api` prefix (AppManifest::routesFile()), so every path
 *   here is below /api.
 * @dependencies
 * - App\Apps\Shop\Http\Controllers\*; core PageTitleController (browser titles of the e-shop
 *   pages); middleware `shop.active` (ShopApp::middlewareAliases()), `auth:sanctum`, `permission`.
 */

use App\Http\Controllers\Api\Legal\PageTitleController;
use App\Apps\Shop\Http\Controllers\ShopCategoryController;
use App\Apps\Shop\Http\Controllers\ShopCheckoutController;
use App\Apps\Shop\Http\Controllers\ShopCouponController;
use App\Apps\Shop\Http\Controllers\ShopCustomerController;
use App\Apps\Shop\Http\Controllers\ShopLogController;
use App\Apps\Shop\Http\Controllers\ShopOrderController;
use App\Apps\Shop\Http\Controllers\ShopPaymentMethodController;
use App\Apps\Shop\Http\Controllers\ShopProductController;
use App\Apps\Shop\Http\Controllers\ShopPublicController;
use App\Apps\Shop\Http\Controllers\ShopShippingMethodController;
use App\Apps\Shop\Http\Controllers\ShopSiteSettingController;
use App\Apps\Shop\Http\Controllers\ShopSupplierController;
use Illuminate\Support\Facades\Route;

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
| ADMINISTRATION (signed-in users; every route checks its permission)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:300,1'])->group(function () {
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
            // Confirmation e-mail of an order (E-shop orders → Edit confirmation e-mail).
            Route::get('/order-email-template', [ShopSiteSettingController::class, 'showOrderEmailTemplate'])
                ->middleware('permission:shop-orders-update');
            Route::put('/order-email-template', [ShopSiteSettingController::class, 'updateOrderEmailTemplate'])
                ->middleware('permission:shop-orders-update');
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
});
