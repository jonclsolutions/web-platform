<?php
/**
 * @file ShopOrder.php
 * @path app/Models/Shop/ShopOrder.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model representing a customer sales order.
 *
 * @refactor-note (2026-10-23) restoreStock() shares the stock movement with the new
 * deductStock() (reopening a cancelled / returned order) - see ShopOrderController::update().
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Log;

/**
 * @description Manages order lifecycle, pricing, shipping information, and inventory interaction.
 * * @property int $id Unique order identifier.
 * @property string $order_number Chronological unique order number.
 * @property string $status Current status of the order.
 * @property float $final_amount Total price including taxes and shipping.
 */
class ShopOrder extends Model
{
    use SoftDeletes;

    /**
     * @var string The table associated with the model.
     */
    protected $table = 'shop_orders';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'customer_id',
        'order_number',
        'status',
        'payment_status',
        'total_amount',
        'shipping_amount',
        'tax_amount',
        'discount_amount',
        'final_amount',
        'coupon_id',
        'payment_method_id',
        'shipping_method_id',
        'shipping_address',
        'shipping_city',
        'shipping_postal_code',
        'shipping_country',
        'notes',
        'paid_at',
        'shipped_at',
        'delivered_at',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'total_amount' => 'decimal:2',
        'shipping_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'final_amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Get the customer associated with the order.
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(ShopCustomer::class, 'customer_id');
    }

    /**
     * Get the order line items.
     */
    public function items(): HasMany
    {
        return $this->hasMany(ShopOrderItem::class, 'order_id');
    }

    /**
     * Get the applied discount coupon.
     */
    public function coupon(): BelongsTo
    {
        return $this->belongsTo(ShopCoupon::class, 'coupon_id');
    }

    /**
     * Get the payment method used.
     */
    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(ShopPaymentMethod::class, 'payment_method_id');
    }

    /**
     * Get the shipping method used.
     */
    public function shippingMethod(): BelongsTo
    {
        return $this->belongsTo(ShopShippingMethod::class, 'shipping_method_id');
    }

    /**
     * Scope to exclude canceled or returned orders.
     */
    public function scopeActive($query)
    {
        return $query->whereNotIn('status', ['canceled', 'returned']);
    }

    /**
     * Scope to include only paid orders.
     */
    public function scopePaid($query)
    {
        return $query->where('payment_status', 'paid');
    }

    /**
     * Scope to include only pending payments.
     */
    public function scopePending($query)
    {
        return $query->where('payment_status', 'pending');
    }

    /**
     * Returns valid order status options.
     */
    public static function getStatusOptions(): array
    {
        return [
            'pending' => 'Čeká na potvrzení',
            'confirmed' => 'Potvrzena',
            'processing' => 'Zpracovávání',
            'shipped' => 'Odeslána',
            'delivered' => 'Doručena',
            'returned' => 'Vrácena',
            'canceled' => 'Zrušena',
        ];
    }

    /**
     * Returns valid payment status options.
     */
    public static function getPaymentStatusOptions(): array
    {
        return [
            'pending' => 'Čeká se na platbu',
            'paid' => 'Zaplacena',
            'failed' => 'Platba selhala',
            'refunded' => 'Vráceny peníze',
            'cod' => 'Dobírka',
        ];
    }

    /**
     * Generates a new unique order number based on the current date sequence.
     */
    public static function generateOrderNumber(): string
    {
        // @bugfix-note (2026-10-23) date('Ym') used the PHP default timezone instead of the
        // application timezone (wrong month around midnight of the 1st) - now(), which also
        // follows the test clock.
        $prefix = now()->format('Ym');
        
        $lastOrder = self::withTrashed()
            ->where('order_number', 'like', $prefix . '%')
            ->orderBy('order_number', 'desc')
            ->first();

        $nextNumber = 1;
        if ($lastOrder) {
            $lastSequence = (int) substr($lastOrder->order_number, -4);
            $nextNumber = $lastSequence + 1;
        }

        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Returns the human-readable label for the current status.
     */
    public function getStatusLabel(): string
    {
        return self::getStatusOptions()[$this->status] ?? $this->status;
    }

    /**
     * Returns the human-readable label for the current payment status.
     */
    public function getPaymentStatusLabel(): string
    {
        return self::getPaymentStatusOptions()[$this->payment_status] ?? $this->payment_status;
    }

    /** @var string[] Statuses in which the ordered pieces are taken out of stock. */
    public const STOCK_HOLDING_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

    /** @var string[] Statuses in which the ordered pieces are back in stock. */
    public const STOCK_RELEASED_STATUSES = ['canceled', 'returned'];

    /**
     * @description Restores stock levels for all items in the order (cancel / return /
     *   permanent delete of a still active order).
     * @return void
     */
    public function restoreStock(): void
    {
        $this->moveStock(+1);
        Log::info("Stock restored for order: {$this->order_number}");
    }

    /**
     * @description Takes the ordered pieces out of stock again - a cancelled / returned
     *   order that is reopened (see ShopOrderController::update()).
     * @return void
     */
    public function deductStock(): void
    {
        $this->moveStock(-1);
        Log::info("Stock deducted again for order: {$this->order_number}");
    }

    /**
     * @description Adds (+1) or removes (-1) the quantity of every item to / from the
     *   variant (then re-sums the parent product) or the product.
     * @param int $direction +1 = back to stock, -1 = out of stock.
     * @return void
     */
    private function moveStock(int $direction): void
    {
        foreach ($this->items as $item) {
            if ($item->product_variant_id) {
                $variant = ShopProductVariant::find($item->product_variant_id);
                if ($variant) {
                    $variant->increment('stock_quantity', $direction * $item->quantity);
                    ShopProductVariant::forceSyncParentStock($variant->product_id);
                }
            } else {
                $product = ShopProduct::find($item->product_id);
                if ($product) {
                    $product->increment('stock_quantity', $direction * $item->quantity);
                }
            }
        }
    }
}