<?php
/**
 * @file ShopShippingMethodResource.php
 * @path app/Http/Resources/Shop/ShopShippingMethodResource.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for available shipping methods.
 */

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms shipping provider data for use in checkout and shipping estimation.
 */
class ShopShippingMethodResource extends JsonResource
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
            'id'                      => $this->id,
            'code'                    => $this->code,
            'name'                    => $this->name,
            'description'             => $this->description,
            'shipping_type'           => $this->shipping_type,
            'base_price'              => $this->base_price,
            'allows_cod'              => (bool)$this->allows_cod,
            'cod_price'               => $this->cod_price,
            'free_shipping_threshold' => $this->free_shipping_threshold,
            'max_weight'              => $this->max_weight,
            'requires_pickup_point'   => (bool)$this->requires_pickup_point,
            'tracking_url'            => $this->tracking_url,
            'logo_path'               => $this->logo_path,
            'delivery_days_min'       => $this->delivery_days_min,
            'delivery_days_max'       => $this->delivery_days_max,
            'is_active'               => (bool)$this->is_active,
            'sort_order'              => $this->sort_order,
            'created_at'              => $this->created_at->toIso8601String(),
            'updated_at'              => $this->updated_at->toIso8601String(),
            'deleted_at'              => $this->deleted_at ? $this->deleted_at->toIso8601String() : null,
        ];
    }
}