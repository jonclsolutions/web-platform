<?php
/**
 * @file ShopCategoryResource.php
 * @path app/Http/Resources/Shop/ShopCategoryResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for shop categories, including parent/child relationships.
 */

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * @description Transforms ShopCategory model data, supporting nested children via relationship loading.
 */
class ShopCategoryResource extends JsonResource
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
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'parent_id' => $this->parent_id,
            'image_path' => $this->image_path,
            'is_active' => (bool)$this->is_active,
            'sort_order' => $this->sort_order,
            'products_count' => $this->products_count ?? 0,
            'created_at' => $this->created_at ? Carbon::parse($this->created_at)->toIso8601String() : null,
            'updated_at' => $this->updated_at ? Carbon::parse($this->updated_at)->toIso8601String() : null,
            
            'parent_name' => $this->parent?->name,
            'children' => ShopCategoryResource::collection($this->whenLoaded('children')),
        ];
    }
}