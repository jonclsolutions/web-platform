<?php

namespace App\Http\Requests\Shop\ShopOrder;

use App\Models\Shop\ShopProduct;
use App\Models\Shop\ShopProductVariant;
use Illuminate\Foundation\Http\FormRequest;

class StoreShopOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // 👤 Kontaktní údaje zákazníka (místo původního customer_id)
            'email'                => ['required', 'email', 'max:150'],
            'first_name'           => ['required', 'string', 'max:100'],
            'last_name'            => ['required', 'string', 'max:100'],
            'phone'                => ['required', 'string', 'max:20'],
            'company'              => ['nullable', 'string', 'max:150'],

            // 📦 Stavy & Metody
            'payment_method_id'    => ['required', 'exists:shop_payment_methods,id'],
            'shipping_method_id'   => ['required', 'exists:shop_shipping_methods,id'],
            'coupon_id'            => ['nullable', 'exists:shop_coupons,id'],
            'status'               => ['required', 'in:pending,confirmed,processing,shipped,delivered,returned,canceled'],
            'payment_status'       => ['required', 'in:pending,paid,failed,refunded,cod,unpaid'], // Přidán 'unpaid' pro jistotu z frontendu
            
            // 📍 Adresa doručení
            'shipping_address'     => ['required', 'string', 'max:255'],
            'shipping_city'        => ['required', 'string', 'max:100'],
            'shipping_postal_code' => ['required', 'string', 'max:20'],
            'shipping_country'     => ['required', 'string', 'max:50'],
            'notes'                => ['nullable', 'string', 'max:1000'],
            
            // 🛍️ Položky objednávky
            'items'                => ['required', 'array', 'min:1'],
            'items.*.product_id'   => ['required', 'exists:shop_products,id'],
            'items.*.product_variant_id' => ['nullable', 'exists:shop_product_variants,id'],
            
            // Tvoje zachovaná logika kontroly skladu
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
                            $fail("U varianty '{$variant->variant_name}' je na skladě pouze {$variant->stock_quantity} ks.");
                        }
                    } else {
                        $product = ShopProduct::find($productId);
                        if ($product && $value > $product->stock_quantity) {
                            $fail("U produktu '{$product->name}' je na skladě pouze {$product->stock_quantity} ks.");
                        }
                    }
                }
            ],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.vat_rate'   => ['nullable', 'integer'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required'            => 'Email zákazníka je povinný.',
            'first_name.required'       => 'Jméno zákazníka je povinné.',
            'last_name.required'        => 'Příjmení zákazníka je povinné.',
            'phone.required'            => 'Telefonní číslo je povinné.',
            'items.required'            => 'Objednávka mustí obsahovat alespoň jednu položku.',
            'items.*.quantity.min'      => 'Počet kusů musí být alespoň 1.',
            'items.*.quantity.required' => 'Množství je povinné.',
        ];
    }
}