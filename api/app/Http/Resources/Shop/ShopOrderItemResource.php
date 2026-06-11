<?php

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShopOrderItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product_variant_id' => $this->product_variant_id,
            'product_name' => $this->product_name,
            'variant_name' => $this->variant_name,
            'quantity' => (int) $this->quantity,
            'unit_price' => (float) $this->unit_price,
            'total_price' => (float) $this->total_price,
            
            // 🌟 PŘIDÁNO: Posíláme sazbu DPH do Angularu
            // Pokud by sloupec v DB mohl být NULL, zachrání tě fallback: $this->vat_rate ?? 21
            'vat_rate' => (int) ($this->vat_rate ?? 21),
        ];
    }
}