<?php
/**
 * @file ShopPaymentMethod.php
 * @path app/Apps/Shop/Models/ShopPaymentMethod.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Model representing available payment options for the shop.
 */

namespace App\Apps\Shop\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @description Manages payment configurations, including bank details for manual payments and provider flags.
 * * @property string $code Internal code for the payment method.
 * @property bool $is_active Toggle for method availability in checkout.
 */
class ShopPaymentMethod extends Model
{
    use SoftDeletes;

    /**
     * @description Codes of the bank transfers (the fixed set of data/shop_payment_methods.php) -
     *   the orders the customer pays later: payment details in the e-mails, reminder and
     *   automatic cancellation when unpaid (UnpaidOrders, audit B-04).
     */
    public const BANK_TRANSFER_CODES = ['bank_transfer_cz', 'bank_transfer_sepa'];

    /**
     * @var string The table associated with the model.
     */
    protected $table = 'shop_payment_methods';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'code',
        'name',
        'image_path',
        'description',
        'price',
        'provider',
        'is_external',
        'bank_account_number',
        'bank_account_code',
        'bank_iban',
        'bank_swift_bic',
        'variable_symbol_type',
        'is_active',
        'sort_order',
        'config',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'is_active' => 'boolean',
        'is_external' => 'boolean',
        'price' => 'decimal:2',
        'sort_order' => 'integer',
        'config' => 'array',
    ];

    /**
     * @description Whether the method is a bank transfer (see BANK_TRANSFER_CODES).
     * @return bool
     */
    public function isBankTransfer(): bool
    {
        return in_array($this->code, self::BANK_TRANSFER_CODES, true);
    }

    /**
     * @description Payment details of a bank transfer for the e-mails of an order: account
     *   (number / bank code), IBAN, SWIFT / BIC and the variable symbol of `variable_symbol_type`
     *   (see variableSymbol()); only the filled ones. Empty for other methods or without an
     *   account / IBAN.
     * @param ShopOrder $order The order to pay.
     * @return array<string, string> label key (ShopOrderEmailTemplate) => value
     */
    public function paymentDetails(ShopOrder $order): array
    {
        $account = trim((string) $this->bank_account_number);
        $iban = trim((string) $this->bank_iban);
        if (!$this->isBankTransfer() || ($account === '' && $iban === '')) {
            return [];
        }
        $code = trim((string) $this->bank_account_code);

        return array_filter([
            'label_account'         => $account !== '' ? $account . ($code !== '' ? '/' . $code : '') : '',
            'label_iban'            => $iban,
            'label_swift'           => trim((string) $this->bank_swift_bic),
            'label_variable_symbol' => $this->variableSymbol($order),
        ], fn (string $value) => $value !== '');
    }

    /**
     * @description Variable symbol of an order (digits only, at most 10): `order_number` - the order
     *   number (YYYYMM + 4 digits); `phone_number` - the digits of the buyer's phone, a longer one
     *   (with the country code) shortened to its last 9 digits (the national number of CZ / SK);
     *   `none` - none ('').
     * @param ShopOrder $order The order.
     * @return string
     */
    public function variableSymbol(ShopOrder $order): string
    {
        $digits = match ($this->variable_symbol_type) {
            'order_number' => preg_replace('/\D/', '', (string) $order->order_number),
            'phone_number' => preg_replace('/\D/', '', (string) ($order->contact()['phone'] ?? '')),
            default        => '',
        };

        return strlen($digits) > 10 ? substr($digits, -9) : $digits;
    }
}