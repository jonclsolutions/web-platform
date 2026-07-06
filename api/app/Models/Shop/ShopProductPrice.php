<?php
/**
 * @file ShopProductPrice.php
 * @path app/Models/Shop/ShopProductPrice.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model for managing granular pricing data for products and variants.
 */

namespace App\Models\Shop;

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
        'price_czk_with_vat',
        'price_czk_without_vat',
        'price_eur_with_vat',
        'price_eur_without_vat',
        'cost_price_czk',
        'cost_price_eur',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'vat_rate'              => 'float',
        'price_czk_with_vat'    => 'float',
        'price_czk_without_vat' => 'float',
        'price_eur_with_vat'    => 'float',
        'price_eur_without_vat' => 'float',
        'cost_price_czk'        => 'float',
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