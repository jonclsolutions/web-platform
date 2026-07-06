<?php
/**
 * @file ShopOrderItem.php
 * @path app/Models/Shop/ShopOrderItem.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model representing an individual line item in a customer order.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @description Manages details for specific products or variants purchased within an order.
 * * @property int $id Unique item identifier.
 * @property int $order_id Parent order relationship.
 * @property string $product_name Name of the product at time of purchase.
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
        'created_at',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
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
}