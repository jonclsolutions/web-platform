<?php
/**
 * @file UpdateShopOrderRequest.php
 * @path app/Http/Requests/Shop/ShopOrder/UpdateShopOrderRequest.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating existing shop orders, including customer contact details, shipping info, and order line items.
 */

namespace App\Http\Requests\Shop\ShopOrder;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for updating shop orders.
 * @note Implements business logic checks for coupon validity during updates and ensures order item integrity.
 */
class UpdateShopOrderRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        $orderId = $this->route('id') ?? $this->route('order');

        return [
            'email'                => ['sometimes', 'required', 'email', 'max:150'],
            'first_name'           => ['sometimes', 'required', 'string', 'max:100'],
            'last_name'            => ['sometimes', 'required', 'string', 'max:100'],
            'phone'                => ['sometimes', 'required', 'string', 'max:20'],
            'company'              => ['nullable', 'string', 'max:150'],

            'payment_method_id'    => ['sometimes', 'required', 'exists:shop_payment_methods,id'],
            'shipping_method_id'   => ['sometimes', 'required', 'exists:shop_shipping_methods,id'],
            
            'coupon_id' => [
                'nullable',
                'exists:shop_coupons,id',
                function ($attribute, $value, $fail) use ($orderId) {
                    if (!$value) return;

                    $order = \App\Models\Shop\ShopOrder::find($orderId);
                    if ($order && $order->coupon_id == $value) {
                        return;
                    }

                    $coupon = \App\Models\Shop\ShopCoupon::find($value);
                    if ($coupon && method_exists($coupon, 'isValid') && !$coupon->isValid()) {
                        $fail('Tento kupón již není platný a nelze jej k objednávce nově přiřadit.');
                    }
                }
            ],

            'status'               => ['sometimes', 'required', 'in:pending,confirmed,processing,shipped,delivered,returned,canceled'],
            'payment_status'       => ['sometimes', 'required', 'in:pending,paid,failed,refunded,cod,unpaid'],
            'shipping_address'     => ['sometimes', 'required', 'string', 'max:255'],
            'shipping_city'        => ['sometimes', 'required', 'string', 'max:100'],
            'shipping_postal_code' => ['sometimes', 'required', 'string', 'max:10'],
            'shipping_country'     => ['sometimes', 'required', 'string', 'max:50'],
            'notes'                => ['nullable', 'string', 'max:1000'],
            
            'items'                      => ['sometimes', 'required', 'array', 'min:1'],
            'items.*.id'                 => ['nullable', 'integer', 'exists:shop_order_items,id'],
            'items.*.product_id'         => ['required_with:items', 'exists:shop_products,id'],
            'items.*.product_variant_id' => ['nullable', 'exists:shop_product_variants,id'],
            'items.*.quantity'           => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_price'         => ['required_with:items', 'numeric', 'min:0'],
            'items.*.vat_rate'           => ['nullable', 'integer'],
            
            'delete_items'               => ['nullable', 'array'],
            'delete_items.*'             => ['integer', 'exists:shop_order_items,id'],
            'paid_at'                    => ['nullable', 'date'],
            'shipped_at'                 => ['nullable', 'date'],
            'delivered_at'               => ['nullable', 'date'],
        ];
    }

    /**
     * Get custom error messages for validator errors.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'items.min'            => 'Objednávka musí obsahovat alespoň jednu položku.',
            'items.*.quantity.min' => 'Počet kusů musí být alespoň 1.',
        ];
    }
}