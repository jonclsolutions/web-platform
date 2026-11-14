<?php
/**
 * @file ShopLogController.php
 * @path app/Apps/Shop/Http/Controllers/ShopLogController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Read access to the shop-domain audit log (shop_logs) - e-commerce activity
 * across products, orders, customers, coupons, categories, suppliers, shipping and payment
 * methods. The endpoints are shared by AuditLogController; this class only names the model.
 * @dependencies
 * - App\Http\Controllers\Api\AuditLogController: index / show.
 */

namespace App\Apps\Shop\Http\Controllers;

use App\Http\Controllers\Api\AuditLogController;
use App\Apps\Shop\Models\ShopLog;

class ShopLogController extends AuditLogController
{
    /** @description Model of shop_logs. */
    protected function model(): string
    {
        return ShopLog::class;
    }
}
