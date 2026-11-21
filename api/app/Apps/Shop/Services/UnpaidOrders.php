<?php

/**
 * @file UnpaidOrders.php
 * @path app/Apps/Shop/Services/UnpaidOrders.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unpaid orders paid by bank transfer (audit B-04): N days after the order the
 * customer gets a payment reminder (ShopPaymentReminder), M days after it the order is cancelled
 * (status canceled) - the pieces go back to stock (variants too), the use of the coupon is
 * returned and the customer gets an e-mail (ShopOrderCanceled). Run by the scheduler
 * (`shop:unpaid-orders`, ShopApp::schedule()); each step is written to the e-shop log.
 * @note An order is concerned while it waits: status `pending`, payment `pending` / `unpaid`,
 * payment method a bank transfer (ShopPaymentMethod::BANK_TRANSFER_CODES), placed since the rule
 * exists (`unpaid_orders_from`). An order the admin confirmed, paid or cancelled is left alone.
 * The deadlines are in the shop settings (E-shop orders → Unpaid orders), 0 = off.
 * @note Safe to run any time: the reminder is sent once (`payment_reminder_sent_at`), the
 * cancellation re-checks the order under a row lock, so a payment marked meanwhile wins.
 * @dependencies
 * - ShopSiteSetting: deadlines; ShopOrder::restoreStock(): stock; LogsActivity: e-shop log.
 */

namespace App\Apps\Shop\Services;

use App\Apps\Shop\Mail\ShopOrderCanceled;
use App\Apps\Shop\Mail\ShopPaymentReminder;
use App\Apps\Shop\Models\ShopCoupon;
use App\Apps\Shop\Models\ShopLog;
use App\Apps\Shop\Models\ShopOrder;
use App\Apps\Shop\Models\ShopPaymentMethod;
use App\Apps\Shop\Models\ShopSiteSetting;
use App\Traits\LogsActivity;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class UnpaidOrders
{
    use LogsActivity;

    /** @description Payment states of an order that waits for the money. */
    public const WAITING_PAYMENT = ['pending', 'unpaid'];

    /** @description Module of the e-shop log entries. */
    private const LOG_MODULE = 'ShopOrder (Unpaid)';

    /** @description Personal fields kept out of the log context (they are in the e-mails only). */
    private const LOG_PRIVATE_KEYS = ['customer_email', 'customer_first_name', 'customer_last_name', 'customer_phone'];

    /**
     * @description Deadlines of the settings: days after the order (0 = off) and the start of the rule.
     * @return array{reminder: int, cancel: int, from: ?Carbon}
     */
    public static function deadlines(): array
    {
        $settings = ShopSiteSetting::first();

        return [
            'reminder' => (int) ($settings->unpaid_reminder_days ?? 3),
            'cancel'   => (int) ($settings->unpaid_cancel_days ?? 7),
            'from'     => $settings?->unpaid_orders_from,
        ];
    }

    /**
     * @description Day by which the order must be paid (the day of the cancellation), null when
     *   the cancellation is off.
     * @param ShopOrder $order The order.
     * @return Carbon|null
     */
    public static function payBy(ShopOrder $order): ?Carbon
    {
        $cancel = self::deadlines()['cancel'];

        return $cancel > 0 ? $order->created_at->copy()->addDays($cancel) : null;
    }

    /**
     * @description Sends the due reminders and cancels the overdue orders.
     * @param bool $dryRun Only count, change and send nothing.
     * @return array{reminded: int, canceled: int}
     */
    public function run(bool $dryRun = false): array
    {
        $deadlines = self::deadlines();
        $now = now();
        $result = ['reminded' => 0, 'canceled' => 0];

        // Cancel first: an order past both deadlines gets the cancellation only.
        if ($deadlines['cancel'] > 0) {
            foreach ($this->waiting($deadlines['from'])->where('created_at', '<=', $now->copy()->subDays($deadlines['cancel']))->pluck('id') as $id) {
                $result['canceled'] += ($dryRun || $this->cancel($id)) ? 1 : 0;
            }
        }

        if ($deadlines['reminder'] > 0) {
            $query = $this->waiting($deadlines['from'])
                ->whereNull('payment_reminder_sent_at')
                ->where('created_at', '<=', $now->copy()->subDays($deadlines['reminder']));
            if ($deadlines['cancel'] > 0) {
                $query->where('created_at', '>', $now->copy()->subDays($deadlines['cancel']));
            }
            foreach ($query->pluck('id') as $id) {
                $result['reminded'] += ($dryRun || $this->remind($id)) ? 1 : 0;
            }
        }

        return $result;
    }

    /**
     * @description Orders waiting for a bank transfer (see the class note).
     * @param CarbonInterface|null $from Start of the rule (null = all orders).
     * @return Builder
     */
    private function waiting(?CarbonInterface $from): Builder
    {
        return ShopOrder::query()
            ->where('status', 'pending')
            ->whereIn('payment_status', self::WAITING_PAYMENT)
            ->whereHas('paymentMethod', fn (Builder $q) => $q->whereIn('code', ShopPaymentMethod::BANK_TRANSFER_CODES))
            ->when($from, fn (Builder $q) => $q->where('created_at', '>=', $from))
            ->orderBy('id');
    }

    /**
     * @description Sends the reminder of one order once (the mark is set first, a parallel run
     *   does not send it again).
     * @param int $id Order ID.
     * @return bool Whether it was sent now.
     */
    private function remind(int $id): bool
    {
        if (ShopOrder::whereKey($id)->whereNull('payment_reminder_sent_at')->update(['payment_reminder_sent_at' => now()]) === 0) {
            return false;
        }
        $order = ShopOrder::with(['paymentMethod'])->find($id);
        $this->mail($order, new ShopPaymentReminder($order), 'payment reminder');
        $this->log('payment_reminder', "Sent the payment reminder of order {$order->order_number}.", $order);

        return true;
    }

    /**
     * @description Cancels one order: under a row lock re-checks that it still waits, sets it
     *   canceled, returns the pieces to stock and the use of the coupon; then e-mails the customer.
     * @param int $id Order ID.
     * @return bool Whether it was cancelled now.
     */
    private function cancel(int $id): bool
    {
        $order = DB::transaction(function () use ($id) {
            $order = ShopOrder::whereKey($id)->lockForUpdate()->first();
            if (!$order || $order->status !== 'pending' || !in_array($order->payment_status, self::WAITING_PAYMENT, true)) {
                return null;
            }
            $order->update(['status' => 'canceled', 'payment_status' => 'unpaid']);
            $order->load('items');
            $order->restoreStock();
            if ($order->coupon_id) {
                ShopCoupon::whereKey($order->coupon_id)->where('usage_count', '>', 0)->decrement('usage_count');
            }

            return $order;
        });
        if (!$order) {
            return false;
        }

        $this->log('auto_cancel', "Canceled unpaid order {$order->order_number} (no payment in time); stock and coupon returned.", $order);
        $this->mail($order, new ShopOrderCanceled($order), 'cancellation');

        return true;
    }

    /**
     * @description Queues an e-mail to the buyer; a failure is reported and logged, never thrown
     *   (the order change stays).
     * @param ShopOrder $order The order.
     * @param \Illuminate\Mail\Mailable $mail The e-mail.
     * @param string $what Name of the e-mail for the log.
     * @return void
     */
    private function mail(ShopOrder $order, \Illuminate\Mail\Mailable $mail, string $what): void
    {
        $to = $order->contact()['email'] ?? null;
        if (!$to) {
            $this->log('error', "No e-mail address for the {$what} of order {$order->order_number}.", $order);
            return;
        }
        try {
            Mail::to($to)->queue($mail);
        } catch (\Throwable $e) {
            report($e);
            $this->log('error', "Failed to send the {$what} e-mail of order {$order->order_number}: " . $e->getMessage(), $order);
        }
    }

    /**
     * @description E-shop log entry of the scheduler (user "system").
     * @param string $event Event type.
     * @param string $description Text.
     * @param ShopOrder $order The order.
     * @return void
     */
    private function log(string $event, string $description, ShopOrder $order): void
    {
        $this->logAction(request(), ShopLog::class, $event, self::LOG_MODULE, $description, $order->id, 'ShopOrder', self::LOG_PRIVATE_KEYS);
    }
}
