<?php
/**
 * @file ShopProductResource.php
 * @path app/Http/Resources/Shop/ShopProductResource.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for products including categories, suppliers, and variants.
 */

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms the ShopProduct model into a comprehensive JSON response for the store frontend.
 */
class ShopProductResource extends JsonResource
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
            'id'          => $this->id,
            'category_id' => $this->category_id,
            'category'    => new ShopCategoryResource($this->whenLoaded('category')),
            'categories'  => $this->relationLoaded('categories') && $this->categories
                ? $this->categories->map(fn($cat) => [
                    'id'         => $cat->id,
                    'name'       => $cat->name,
                    'slug'       => $cat->slug,
                    'is_primary' => (bool) ($cat->pivot?->is_primary ?? false),
                    'sort_order' => (int)  ($cat->pivot?->sort_order ?? 0),
                ])->values()->all()
                : [],
            'supplier_id' => $this->supplier_id,
            'supplier'    => new ShopSupplierResource($this->whenLoaded('supplier')),
            'name'              => $this->name,
            'slug'              => $this->slug,
            'description'       => $this->description,
            'short_description' => $this->short_description,
            'name_en'              => $this->name_en,
            'description_en'       => $this->description_en,
            'short_description_en' => $this->short_description_en,
            'prices' => $this->prices ? [
                'vat_rate'              => $this->prices->vat_rate,
                'price_eur_with_vat'    => $this->prices->price_eur_with_vat,
                'price_eur_without_vat' => $this->prices->price_eur_without_vat,
                'cost_price_eur'        => $this->prices->cost_price_eur,
            ] : null,
            'sku'                 => $this->sku,
            'stock_quantity'      => $this->stock_quantity,
            'stock_warning_level' => $this->stock_warning_level,
            'is_active'           => (bool) $this->is_active,
            'is_featured'         => (bool) $this->is_featured,
            'primary_image'       => new ShopProductImageResource($this->whenLoaded('primaryImage')),
            'images'              => ShopProductImageResource::collection($this->whenLoaded('images')),
            'variants'            => ShopProductVariantResource::collection($this->whenLoaded('variants')),
            'reviews_count'       => $this->whenLoaded('reviews', fn() => $this->reviews->count()),
            'average_rating'      => $this->whenLoaded('reviews', fn() => round($this->reviews->avg('rating'), 2)),
            'created_at'          => $this->created_at->toIso8601String(),
            'updated_at'          => $this->updated_at->toIso8601String(),
            'deleted_at'          => $this->deleted_at?->toIso8601String(),
        ];
    }
}