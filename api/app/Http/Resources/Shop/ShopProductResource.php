<?php

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShopProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,

            // Primární kategorie (zpětná kompatibilita — přímý FK)
            'category_id'       => $this->category_id,
            'category'          => new ShopCategoryResource($this->whenLoaded('category')),

            // Všechny kategorie produktu z pivot tabulky
            // Všechny kategorie produktu z pivot tabulky
            'categories' => $this->relationLoaded('categories') && $this->categories 
                ? $this->categories->map(fn($cat) => [
                    'id'         => $cat->id,
                    'name'       => $cat->name,
                    'slug'       => $cat->slug,
                    'is_primary' => (bool) ($cat->pivot?->is_primary ?? false),
                    'sort_order' => (int)  ($cat->pivot?->sort_order ?? 0),
                ])->values()->all()
                : [], // 🔥 Pokud relace chybí nebo je prázdná, Angular dostane bezpečné prázdné pole

            'supplier_id'       => $this->supplier_id,
            'supplier'          => new ShopSupplierResource($this->whenLoaded('supplier')),

            'name'              => $this->name,
            'slug'              => $this->slug,
            'description'       => $this->description,
            'short_description' => $this->short_description,

            // Multi-měnové ceny
            'prices'            => $this->relationLoaded('prices') ? [
                'vat_rate'               => $this->prices ? (float) $this->prices->vat_rate               : 0.0,
                'price_czk_without_vat'  => $this->prices ? (float) $this->prices->price_czk_without_vat  : 0.0,
                'price_czk_with_vat'     => $this->prices ? (float) $this->prices->price_czk_with_vat      : 0.0,
                'price_eur_without_vat'  => $this->prices?->price_eur_without_vat  ? (float) $this->prices->price_eur_without_vat  : null,
                'price_eur_with_vat'     => $this->prices?->price_eur_with_vat     ? (float) $this->prices->price_eur_with_vat      : null,
                'price_usd_without_vat'  => $this->prices?->price_usd_without_vat  ? (float) $this->prices->price_usd_without_vat  : null,
                'price_usd_with_vat'     => $this->prices?->price_usd_with_vat     ? (float) $this->prices->price_usd_with_vat      : null,
            ] : null,

            'sku'                   => $this->sku,
            'stock_quantity'        => $this->stock_quantity,
            'stock_warning_level'   => $this->stock_warning_level,
            'is_active'             => (bool) $this->is_active,
            'is_featured'           => (bool) $this->is_featured,

            'primary_image'     => new ShopProductImageResource($this->whenLoaded('primaryImage')),
            'images'            => ShopProductImageResource::collection($this->whenLoaded('images')),
            'variants'          => ShopProductVariantResource::collection($this->whenLoaded('variants')),

            'reviews_count'     => $this->whenLoaded('reviews', fn() => $this->reviews->count()),
            'average_rating'    => $this->whenLoaded('reviews', fn() => round($this->reviews->avg('rating'), 2)),

            'created_at'        => $this->created_at->toIso8601String(),
            'updated_at'        => $this->updated_at->toIso8601String(),
            'deleted_at'        => $this->deleted_at?->toIso8601String(),
        ];
    }
}