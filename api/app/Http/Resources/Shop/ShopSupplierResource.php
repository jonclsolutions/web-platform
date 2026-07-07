<?php
/**
 * @file ShopSupplierResource.php
 * @path app/Http/Resources/Shop/ShopSupplierResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for product suppliers.
 */

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms supplier metadata and links to provided products.
 */
class ShopSupplierResource extends JsonResource
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
            'id'             => $this->id,
            'name'           => $this->name,
            'ico'            => $this->ico,
            'contact_person' => $this->contact_person,
            'email'          => $this->email,
            'phone'          => $this->phone,
            'address'        => $this->address,
            'city'           => $this->city,
            'postal_code'    => $this->postal_code,
            'country'        => $this->country,
            'payment_terms'  => $this->payment_terms,
            'is_active'      => (bool)$this->is_active,
            'notes'          => $this->notes,
            'created_at'     => $this->created_at->toIso8601String(),
            'updated_at'     => $this->updated_at->toIso8601String(),
            'deleted_at'     => $this->deleted_at ? $this->deleted_at->toIso8601String() : null,
            'products'       => ShopProductResource::collection($this->whenLoaded('products')),
        ];
    }
}