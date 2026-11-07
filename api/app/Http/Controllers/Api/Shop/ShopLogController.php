<?php
/**
 * @file ShopLogController.php
 * @path app/Http/Controllers/Api/Shop/ShopLogController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Read/write access to the shop-domain audit log (shop_logs) - e-commerce activity
 * across products, orders, customers, coupons, categories, suppliers, shipping and payment
 * methods. The endpoints are shared by AuditLogController; this class only names the model and
 * the resource.
 * @dependencies
 * - App\Http\Controllers\Api\AuditLogController: index / store / show.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Resources\Shop\ShopLogResource;
use App\Models\Shop\ShopLog;

class ShopLogController extends AuditLogController
{
    /** @description Model of shop_logs. */
    protected function model(): string
    {
        return ShopLog::class;
    }

    /** @description Resource of one shop_logs row. */
    protected function resource(): string
    {
        return ShopLogResource::class;
    }
}
