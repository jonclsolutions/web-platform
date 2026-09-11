<?php
/**
 * @file StoreShopOrderRequest.php
 * @path app/Http/Requests/Shop/ShopOrder/StoreShopOrderRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating new shop orders, including real-time stock availability verification.
 */

namespace App\Http\Requests\Shop\ShopOrder;

use App\Models\Shop\ShopProduct;
use App\Models\Shop\ShopProductVariant;
use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for new shop orders.
 * @note Performs stock level checks for products and product variants before order creation.
 */
class StoreShopOrderRequest extends FormRequest
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
        return [
            'email'                => ['required', 'email', 'max:150'],
            'first_name'           => ['required', 'string', 'max:100'],
            'last_name'            => ['required', 'string', 'max:100'],
            'phone'                => ['required', 'string', 'max:20'],
            'company'              => ['nullable', 'string', 'max:150'],

            'payment_method_id'    => ['required', 'exists:shop_payment_methods,id'],
            'shipping_method_id'   => ['required', 'exists:shop_shipping_methods,id'],
            'coupon_id'            => ['nullable', 'exists:shop_coupons,id'],
            'status'               => ['required', 'in:pending,confirmed,processing,shipped,delivered,returned,canceled'],
            'payment_status'       => ['required', 'in:pending,paid,failed,refunded,cod,unpaid'],
            
            'shipping_address'     => ['required', 'string', 'max:255'],
            'shipping_city'        => ['required', 'string', 'max:100'],
            'shipping_postal_code' => ['required', 'string', 'max:20'],
            'shipping_country'     => ['required', 'string', 'max:50'],
            'notes'                => ['nullable', 'string', 'max:1000'],
            
            'items'                => ['required', 'array', 'min:1'],
            'items.*.product_id'   => ['required', 'exists:shop_products,id'],
            'items.*.product_variant_id' => ['nullable', 'exists:shop_product_variants,id'],
            
            'items.*.quantity' => [
                'required',
                'integer',
                'min:1',
                function ($attribute, $value, $fail) {
    preg_match('/items\.(\d+)\.quantity/', $attribute, $matches);
    $index = $matches[1];

    $item = $this->input("items.{$index}");
    $productId = $item['product_id'];
    $variantId = $item['product_variant_id'] ?? null;

    if ($variantId) {
        $variant = ShopProductVariant::find($variantId);
        if ($variant && $value > $variant->stock_quantity) {
            $fail("Only {$variant->stock_quantity} pcs of variant '{$variant->variant_name}' are in stock.");
        }
    } else {
        $product = ShopProduct::find($productId);
        if ($product && $value > $product->stock_quantity) {
            $fail("Only {$product->stock_quantity} pcs of product '{$product->name}' are in stock.");
        }
    }
}
            ],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.vat_rate'   => ['nullable', 'integer'],
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
        'email.required'            => 'Customer e-mail is required.',
        'first_name.required'       => 'Customer first name is required.',
        'last_name.required'        => 'Customer last name is required.',
        'phone.required'            => 'Phone number is required.',
        'items.required'            => 'The order must contain at least one item.',
        'items.*.quantity.min'      => 'Quantity must be at least 1.',
        'items.*.quantity.required' => 'Quantity is required.',
    ];
}
}