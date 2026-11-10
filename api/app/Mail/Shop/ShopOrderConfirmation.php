<?php
/**
 * @file ShopOrderConfirmation.php
 * @path app/Mail/Shop/ShopOrderConfirmation.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Confirmation e-mail of an e-shop order sent to the buyer right after the checkout,
 * in the language of the storefront (`ShopOrder::lang`): the order number and date, the items,
 * the prices (goods, discount, shipping, total incl. VAT), shipping / payment method, delivery
 * address and contact, the information on the right of withdrawal and the link to the terms and
 * conditions - the confirmation of the concluded contract on a durable medium (Directive
 * 2011/83/EU, Art. 8(7)). Texts from ShopOrderEmailTemplate.
 * @dependencies
 * - ShopOrderEmailTemplate: texts of the language and the amount format; CompanyContactInfo: footer.
 */

namespace App\Mail\Shop;

use App\Models\Shop\ShopOrder;
use App\Support\Mail\CompanyContactInfo;
use App\Support\Mail\ShopOrderEmailTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ShopOrderConfirmation extends Mailable
{
    use Queueable, SerializesModels;

    /** @var array|null Memoized result of ShopOrderEmailTemplate::forLang() - envelope and content need it. */
    private ?array $resolvedTemplate = null;

    /**
     * @param ShopOrder $order The placed order (items, methods and coupon loaded when sent).
     */
    public function __construct(
        public ShopOrder $order
    ) {}

    /**
     * @description Subject of the language + the order number (e.g. "Order confirmation 2026000123").
     * @return Envelope
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: trim($this->template()['subject'] . ' ' . $this->order->order_number),
        );
    }

    /**
     * @description The view with the texts, the order and its formatted amounts.
     * @return Content
     */
    public function content(): Content
    {
        $order = $this->order->loadMissing(['items', 'paymentMethod', 'shippingMethod', 'coupon']);
        $lang = $order->lang;
        $money = fn ($amount) => ShopOrderEmailTemplate::money($amount, $lang);
        $contact = $order->contact();
        $tosUrl = rtrim((string) config('app.frontend_url'), '/') . '/tos';

        return new Content(
            view: 'emails.shop.order-confirmation',
            with: array_merge(CompanyContactInfo::get(), [
                'tpl'     => $this->template(),
                'order'   => $order,
                'contact' => $contact,
                'tosUrl'  => $tosUrl,
                'items'   => $order->items->map(fn ($item) => [
                    'name'      => trim($item->product_name . ($item->variant_name ? ' – ' . $item->variant_name : '')),
                    'quantity'  => (int) $item->quantity,
                    'unit'      => $money($item->unit_price),
                    'total'     => $money($item->total_price),
                ])->all(),
                'amounts' => [
                    'subtotal' => $money($order->total_amount),
                    'discount' => (float) $order->discount_amount > 0 ? '−' . $money($order->discount_amount) : null,
                    'shipping' => $money($order->shipping_amount),
                    'total'    => $money($order->final_amount),
                    'vat'      => $money($order->tax_amount),
                ],
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
