<?php

namespace App\Http\Requests\Shop\ShopCoupon;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateShopCouponRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        // Ošetření názvu parametru v routě (buď 'coupons' nebo 'id')
        $id = $this->route('coupon') ?? $this->route('id');

        return [
            'code' => [
                'required',
                'string',
                'min:3',
                'max:50',
                Rule::unique('shop_coupons', 'code')->ignore($id),
            ],
            'description' => 'nullable|string|max:255',
            'discount_type' => 'required|in:percent,fixed',
            'discount_value' => 'required|numeric|min:0',
            'max_usage' => 'nullable|integer|min:1',
            'min_order_amount' => 'nullable|numeric|min:0',
            'applies_to' => 'required|in:all,products,categories',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date|after_or_equal:valid_from',
            'is_active' => 'required|in:0,1,true,false,boolean',
        ];
    }

    protected function prepareForValidation()
    {
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
            'discount_type.required' => 'Typ slevy je povinný.',
            'discount_value.required' => 'Hodnota slevy je povinná.',
            'valid_until.after_or_equal' => 'Datum ukončení platnosti nesmí být před datem zahájení.',
        ];
    }
}