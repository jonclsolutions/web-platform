<?php
/**
 * @file ShopOrderItemResource.php
 * @path app/Http/Resources/Shop/ShopOrderItemResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for individual order line items.
 */

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms order item data, including pricing details and VAT rates for frontend calculations.
 */
class ShopOrderItemResource extends JsonResource
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
            'id'                 => $this->id,
            'product_id'         => $this->product_id,
            'product_variant_id' => $this->product_variant_id,
            'product_name'       => $this->product_name,
            'variant_name'       => $this->variant_name,
            'quantity'           => (int) $this->quantity,
            'unit_price'         => (float) $this->unit_price,
            'total_price'        => (float) $this->total_price,
            'vat_rate'           => (int) ($this->vat_rate ?? 21),
        ];
    }
}