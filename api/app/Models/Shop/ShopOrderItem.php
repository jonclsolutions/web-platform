<?php
/**
 * @file ShopOrderItem.php
 * @path app/Models/Shop/ShopOrderItem.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model representing an individual line item in a customer order.
 * @bugfix-note (2026-10-23) `vat_rate` was not a column / fillable: the rate computed at checkout
 *   or sent by the admin was silently dropped and every recalculation, the resource and the
 *   invoice used 21 % (open finding #21, EU VAT). The rate of the sale is stored now
 *   (database/migrations/2026_10_23_shop_orders_vat_contact_retention.sql).
 * @refactor-note (2026-10-23) `adjustStock()` - one place for the stock movement of a line
 *   (status changes of the order and item edits, finding #24).
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @description Manages details for specific products or variants purchased within an order.
 * * @property int $id Unique item identifier.
 * @property int $order_id Parent order relationship.
 * @property string $product_name Name of the product at time of purchase.
 * @property float $vat_rate VAT rate in % at the time of the sale.
 */
class ShopOrderItem extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'shop_order_items';

    /**
     * @var bool Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'order_id',
        'product_id',
        'product_variant_id',
        'product_name',
        'variant_name',
        'quantity',
        'unit_price',
        'total_price',
        'vat_rate',
        'created_at',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
        'vat_rate' => 'decimal:2',
        'quantity' => 'integer',
        'created_at' => 'datetime',
    ];

    /**
     * Get the parent order.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(ShopOrder::class, 'order_id');
    }

    /**
     * Get the product associated with this item.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(ShopProduct::class, 'product_id');
    }

    /**
     * Get the product variant associated with this item.
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ShopProductVariant::class, 'product_variant_id');
    }

    /**
     * Returns a display-friendly name combining product and variant info.
     *
     * @return string
     */
    public function getDisplayName(): string
    {
        if ($this->variant_name) {
            return "{$this->product_name} - {$this->variant_name}";
        }
        return $this->product_name;
    }

    /**
     * @description Moves pieces of this line's variant (then re-sums the parent product) or
     *   product. Unknown (deleted) products / variants are skipped.
     * @param int $pieces Pieces added to the stock (negative = taken out of the stock).
     * @return void
     */
    public function adjustStock(int $pieces): void
    {
        if ($pieces === 0) {
            return;
        }

        if ($this->product_variant_id) {
            $variant = ShopProductVariant::find($this->product_variant_id);
            if ($variant) {
                $variant->increment('stock_quantity', $pieces);
                ShopProductVariant::forceSyncParentStock($variant->product_id);
            }
            return;
        }

        ShopProduct::whereKey($this->product_id)->increment('stock_quantity', $pieces);
    }

    /**
     * @description VAT rate of a product / variant from the catalogue: the variant's own price
     *   row, else the product's price row, else the given fallback (e.g. sent by the admin form),
     *   else 21 %.
     * @param int $productId Product id.
     * @param int|null $variantId Variant id or null.
     * @param float|int|string|null $fallback Rate used when the catalogue has none.
     * @return float VAT rate in %.
     */
    public static function catalogueVatRate(int $productId, ?int $variantId, float|int|string|null $fallback = null): float
    {
        $rate = null;
        if ($variantId) {
            $rate = ShopProductPrice::where('variant_id', $variantId)->value('vat_rate');
        }
        $rate ??= ShopProductPrice::where('product_id', $productId)->whereNull('variant_id')->value('vat_rate');

        return (float) ($rate ?? $fallback ?? 21);
    }
}
