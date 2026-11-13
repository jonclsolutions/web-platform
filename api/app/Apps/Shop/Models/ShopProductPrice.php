<?php
/**
 * @file ShopProductPrice.php
 * @path app/Apps/Shop/Models/ShopProductPrice.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Model for managing granular pricing data for products and variants.
 */

namespace App\Apps\Shop\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @description Stores currency-specific pricing, VAT rates, and cost data for margin calculations.
 * * @property float $vat_rate The tax percentage applied.
 * @property float $cost_price_eur The cost price of the item in EUR.
 */
class ShopProductPrice extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'shop_product_prices';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'product_id',
        'variant_id',
        'vat_rate',
        'price_eur_with_vat',
        'price_eur_without_vat',
        'cost_price_eur',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'vat_rate'              => 'float',
        'price_eur_with_vat'    => 'float',
        'price_eur_without_vat' => 'float',
        'cost_price_eur'        => 'float',
    ];

    /**
     * Get the parent product.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(ShopProduct::class, 'product_id');
    }
}