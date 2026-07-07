<?php
/**
 * @file ShopProductImageResource.php
 * @path app/Http/Resources/Shop/ShopProductImageResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for product imagery.
 */

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms product image metadata, providing resolvable URLs for the frontend.
 */
class ShopProductImageResource extends JsonResource
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
            'id'         => $this->id,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'image_path' => $this->image_path,
            'url'        => $this->getUrl(),
            'alt_text'   => $this->alt_text,
            'is_primary' => (bool)$this->is_primary,
            'sort_order' => $this->sort_order,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}