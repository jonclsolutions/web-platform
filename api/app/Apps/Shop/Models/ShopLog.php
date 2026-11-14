<?php
/**
 * @file ShopLog.php
 * @path app/Apps/Shop/Models/ShopLog.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the e-shop (shop_logs): catalogue, orders, payments, customers, coupons,
 *   shipping and payment methods, texts of the e-shop.
 * @dependencies AuditLog (columns, casts, author).
 */

namespace App\Apps\Shop\Models;

use App\Models\Core\AuditLog;

final class ShopLog extends AuditLog
{
    /** @var string Table of the log. */
    protected $table = 'shop_logs';
}
