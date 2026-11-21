<?php
/**
 * @file ShopUnpaidOrderMail.php
 * @path app/Apps/Shop/Mail/ShopUnpaidOrderMail.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared e-mail of an unpaid bank-transfer order (UnpaidOrders, audit B-04) in the
 * language of the order: the payment reminder (ShopPaymentReminder - with the pay-by day and the
 * payment details) and the automatic cancellation (ShopOrderCanceled). Texts from
 * ShopOrderEmailTemplate (`reminder_*` / `canceled_*` and the labels of the confirmation), view
 * `shop::emails.unpaid-order`.
 * @dependencies
 * - ShopOrderEmailTemplate: texts and amounts; UnpaidOrders::payBy(); CompanyContactInfo: footer.
 */

namespace App\Apps\Shop\Mail;

use App\Apps\Shop\Models\ShopOrder;
use App\Apps\Shop\Services\UnpaidOrders;
use App\Apps\Shop\Support\ShopOrderEmailTemplate;
use App\Support\Mail\CompanyContactInfo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

abstract class ShopUnpaidOrderMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @var array|null Memoized result of ShopOrderEmailTemplate::forLang(). */
    private ?array $resolvedTemplate = null;

    /**
     * @param ShopOrder $order The unpaid order.
     */
    public function __construct(
        public ShopOrder $order
    ) {}

    /**
     * @description Which e-mail it is - the prefix of its texts ('reminder' / 'canceled').
     * @return string
     */
    abstract protected function kind(): string;

    /**
     * @description Subject of the language + the order number (e.g. "Payment reminder 2026000123").
     * @return Envelope
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: trim($this->template()['labels'][$this->kind() . '_subject'] . ' ' . $this->order->order_number),
        );
    }

    /**
     * @description The view with the texts, the order, its total and - in the reminder - the
     *   pay-by day and the payment details.
     * @return Content
     */
    public function content(): Content
    {
        $order = $this->order->loadMissing(['paymentMethod']);
        $reminder = $this->kind() === 'reminder';
        $payBy = $reminder ? UnpaidOrders::payBy($order) : null;

        return new Content(
            view: 'shop::emails.unpaid-order',
            with: array_merge(CompanyContactInfo::get(), [
                'tpl'            => $this->template(),
                'kind'           => $this->kind(),
                'order'          => $order,
                'contact'        => $order->contact(),
                'total'          => ShopOrderEmailTemplate::money($order->final_amount, $order->lang),
                'payBy'          => $payBy?->format('d.m.Y'),
                'paymentDetails' => $reminder && $order->paymentMethod ? $order->paymentMethod->paymentDetails($order) : [],
            ]),
        );
    }

    /**
     * @description No attachments.
     * @return array
     */
    public function attachments(): array
    {
        return [];
    }

    /**
     * @description Template texts of the order's language (computed once).
     * @return array
     */
    private function template(): array
    {
        return $this->resolvedTemplate ??= ShopOrderEmailTemplate::forLang($this->order->lang);
    }
}
