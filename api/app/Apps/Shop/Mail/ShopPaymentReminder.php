<?php
/**
 * @file ShopPaymentReminder.php
 * @path app/Apps/Shop/Mail/ShopPaymentReminder.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Payment reminder of an unpaid bank-transfer order (N days after the order): the
 *   pay-by day and the payment details. Sent by UnpaidOrders (audit B-04); see ShopUnpaidOrderMail.
 */

namespace App\Apps\Shop\Mail;

class ShopPaymentReminder extends ShopUnpaidOrderMail
{
    /** @description See ShopUnpaidOrderMail::kind(). */
    protected function kind(): string
    {
        return 'reminder';
    }
}
