<?php

namespace App\Http\Requests\Shop\ShopCoupon;

use Illuminate\Foundation\Http\FormRequest;

class StoreShopCouponRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'code' => 'required|string|min:3|max:50|unique:shop_coupons,code',
            'description' => 'nullable|string|max:255',
            'discount_type' => 'required|in:percent,fixed',
            'discount_value' => 'required|numeric|min:0',
            'max_usage' => 'nullable|integer|min:1',
            'min_order_amount' => 'nullable|numeric|min:0',
            'applies_to' => 'required|in:all,products,categories',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date|after_or_equal:valid_from',
            'is_active' => 'required|in:0,1,true,false,boolean', // Robustní validace pro přepínač z frontendu
        ];
    }

    protected function prepareForValidation()
    {
        // Převod stringu "0"/"1" z Angular selectu na skutečný boolean
        if ($this->has('is_active')) {
            $this->merge([
                'is_active' => filter_var($this->is_active, FILTER_VALIDATE_BOOLEAN),
            ]);
        }
    }

    public function messages(): array
    {
        return [
            'code.required' => 'Kód kupónu je povinný.',
            'code.unique' => 'Tento kód kupónu již existuje.',
            'code.min' => 'Kód musí mít alespoň 3 znaky.',
            'discount_type.required' => 'Typ slevy je povinný.',
            'discount_value.required' => 'Hodnota slevy je povinná.',
            'valid_until.after_or_equal' => 'Datum ukončení platnosti nesmí být před datem zahájení.',
        ];
    }
}