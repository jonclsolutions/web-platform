<?php
/**
 * @file ShopCoupon.php
 * @path app/Models/Shop/ShopCoupon.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model representing discount coupons for the shop.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;

/**
 * @description Manages discount codes, including validation logic for usage and time-based constraints.
 * 
 * @property string $code The unique coupon code.
 * @property bool $is_active Whether the coupon is enabled.
 */
class ShopCoupon extends Model
{
    use SoftDeletes;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'code',
        'description',
        'discount_type',
        'discount_value',
        'max_usage',
        'usage_count',
        'min_order_amount',
        'applies_to',
        'valid_from',
        'valid_until',
        'is_active',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'is_active' => 'boolean',
        'discount_value' => 'decimal:2',
        'min_order_amount' => 'decimal:2',
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
        'max_usage' => 'integer',
        'usage_count' => 'integer',
    ];

    /**
     * Validate if the coupon is applicable based on activity, duration, usage limits, and order value.
     *
     * @param float $currentTotal The total amount of the current order.
     * @return bool
     */
    public function isValid(float $currentTotal = 0): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $now = Carbon::now();
        if ($this->valid_from && $this->valid_from->isFuture()) {
            return false;
        }
        if ($this->valid_until && $this->valid_until->isPast()) {
            return false;
        }

        if ($this->max_usage > 0 && $this->usage_count >= $this->max_usage) {
            return false;
        }

        if ($this->min_order_amount > 0 && $currentTotal < (float)$this->min_order_amount) {
            return false;
        }

        return true;
    }
}