<?php
/**
 * @file ShopShippingMethod.php
 * @path app/Models/Shop/ShopShippingMethod.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model representing available shipping methods for the shop.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @description Stores configuration for shipping options, including costs, weight limits, and delivery duration.
 */
class ShopShippingMethod extends Model
{
    use SoftDeletes;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'code',
        'name',
        'description',
        'shipping_type',
        'base_price',
        'free_shipping_threshold',
        'max_weight',
        'requires_pickup_point',
        'tracking_url',
        'logo_path',
        'delivery_days_min',
        'delivery_days_max',
        'is_active',
        'sort_order',
        'allows_cod',
        'cod_price',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'base_price' => 'decimal:2',
        'free_shipping_threshold' => 'decimal:2',
        'max_weight' => 'decimal:2',
        'requires_pickup_point' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'delivery_days_min' => 'integer',
        'delivery_days_max' => 'integer',
        'allows_cod' => 'boolean',
        'cod_price' => 'decimal:2',
    ];

    /**
     * Check if the shipping method is hardcoded system-wide.
     * * @return bool
     */
    public function isHardcoded(): bool
    {
        return in_array($this->code, ['local_pickup', 'closest_carrier']);
    }
}