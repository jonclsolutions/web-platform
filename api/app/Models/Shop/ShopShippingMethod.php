<?php

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ShopShippingMethod extends Model
{
    use SoftDeletes;

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

    public function isHardcoded(): bool
    {
        return in_array($this->code, ['local_pickup', 'closest_carrier']);
    }
}