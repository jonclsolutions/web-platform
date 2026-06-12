<?php

namespace App\Http\Requests\Shop\ShopPaymentMethod;

use Illuminate\Foundation\Http\FormRequest;

class UpdateShopPaymentMethodRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            
            // Bankovní údaje (měnitelné pro manuální převod)
            'bank_account_number' => 'nullable|string|max:50',
            'bank_account_code' => 'nullable|string|max:10',
            'bank_iban' => 'nullable|string|max:34',
            'bank_swift_bic' => 'nullable|string|max:11',
            
            'variable_symbol_type' => 'required|in:order_number,phone_number,none',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            
            // Konfigurace (např. Stripe webhooky/klíče, které lze upravit z detailu)
            'config' => 'nullable|array',
        ];
    }
}