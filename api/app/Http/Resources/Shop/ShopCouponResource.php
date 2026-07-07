<?php
/**
 * @file ShopCouponResource.php
 * @path app/Http/Resources/Shop/ShopCouponResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for shop discount coupons.
 */

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms ShopCoupon model data into standardized ISO-8601 compliant JSON.
 */
class ShopCouponResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'description' => $this->description,
            'discount_type' => $this->discount_type,
            'discount_value' => $this->discount_value,
            'max_usage' => $this->max_usage,
            'usage_count' => $this->usage_count,
            'min_order_amount' => $this->min_order_amount,
            'applies_to' => $this->applies_to,
            'valid_from' => $this->valid_from ? $this->valid_from->toIso8601String() : null,
            'valid_until' => $this->valid_until ? $this->valid_until->toIso8601String() : null,
            'is_active' => (bool)$this->is_active,
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
            'deleted_at' => $this->deleted_at ? $this->deleted_at->toIso8601String() : null,
        ];
    }
}