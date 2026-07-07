<?php
/**
 * @file ShopProductVariantResource.php
 * @path app/Http/Resources/Shop/ShopProductVariantResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for product variants.
 */

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms variant data, providing specific attribute and pricing details.
 */
class ShopProductVariantResource extends JsonResource
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
            'id'                => $this->id,
            'product_id'        => $this->product_id,
            'variant_name'      => $this->variant_name,
            'attribute_1_name'  => $this->attribute_1_name,
            'attribute_1_value' => $this->attribute_1_value,
            'attribute_2_name'  => $this->attribute_2_name,
            'attribute_2_value' => $this->attribute_2_value,
            'sku_variant'       => $this->sku_variant,
            'prices'            => $this->relationLoaded('prices') && $this->prices ? [
                'vat_rate'              => (float) $this->prices->vat_rate,
                'price_eur_without_vat' => (float) $this->prices->price_eur_without_vat,
                'price_eur_with_vat'    => (float) $this->prices->price_eur_with_vat,
                'cost_price_eur'        => (float) $this->prices->cost_price_eur,
            ] : null,
            'images'            => $this->whenLoaded('images', ShopProductImageResource::collection($this->images)),
            'stock_quantity'    => $this->stock_quantity,
            'created_at'        => $this->created_at->toIso8601String(),
            'updated_at'        => $this->updated_at->toIso8601String(),
            'deleted_at'        => $this->deleted_at?->toIso8601String(),
        ];
    }
}