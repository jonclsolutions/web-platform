<?php
/**
 * @file ShopOrderResource.php
 * @path app/Http/Resources/Shop/ShopOrderResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for complete sales orders.
 */

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Aggregates order data, including customer, payment, shipping, and item details.
 */
class ShopOrderResource extends JsonResource
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
            'id'                   => $this->id,
            'order_number'         => $this->order_number,
            'customer_id'          => $this->customer_id,
            'customer'             => new ShopCustomerResource($this->whenLoaded('customer')),
            'status'               => $this->status,
            'status_label'         => $this->getStatusLabel(),
            'payment_status'       => $this->payment_status,
            'payment_status_label' => $this->getPaymentStatusLabel(),
            'total_amount'         => (float) $this->total_amount,
            'shipping_amount'      => (float) $this->shipping_amount,
            'tax_amount'           => (float) $this->tax_amount,
            'discount_amount'      => (float) $this->discount_amount,
            'final_amount'         => (float) $this->final_amount,
            'coupon_id'            => $this->coupon_id,
            'coupon'               => new ShopCouponResource($this->whenLoaded('coupon')),
            'payment_method_id'    => $this->payment_method_id,
            'payment_method'       => new ShopPaymentMethodResource($this->whenLoaded('paymentMethod')),
            'shipping_method_id'   => $this->shipping_method_id,
            'shipping_method'      => new ShopShippingMethodResource($this->whenLoaded('shippingMethod')),
            'shipping_address'     => $this->shipping_address,
            'shipping_city'        => $this->shipping_city,
            'shipping_postal_code' => $this->shipping_postal_code,
            'shipping_country'     => $this->shipping_country,
            'notes'                => $this->notes,
            'items'                => ShopOrderItemResource::collection($this->whenLoaded('items')),
            'items_count'          => $this->whenLoaded('items', fn() => $this->items->count()),
            'paid_at'              => $this->paid_at?->toIso8601String(),
            'shipped_at'           => $this->shipped_at?->toIso8601String(),
            'delivered_at'         => $this->delivered_at?->toIso8601String(),
            'created_at'           => $this->created_at->toIso8601String(),
            'updated_at'           => $this->updated_at->toIso8601String(),
            'deleted_at'           => $this->deleted_at?->toIso8601String(),
        ];
    }
}