<?php
/**
 * @file ShopOrderCanceled.php
 * @path app/Apps/Shop/Mail/ShopOrderCanceled.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Automatic cancellation of an unpaid bank-transfer order (M days after the
 *   order). Sent by UnpaidOrders (audit B-04); see ShopUnpaidOrderMail.
 */

namespace App\Apps\Shop\Mail;

class ShopOrderCanceled extends ShopUnpaidOrderMail
{
    /** @description See ShopUnpaidOrderMail::kind(). */
    protected function kind(): string
    {
        return 'canceled';
    }
}
