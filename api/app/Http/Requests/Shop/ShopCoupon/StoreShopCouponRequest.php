<?php
/**
 * @file StoreShopCouponRequest.php
 * @path App\Http\Requests\Shop\ShopCoupon\StoreShopCouponRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for storing new discount coupons.
 */

namespace App\Http\Requests\Shop\ShopCoupon;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for coupon creation, including type casting for boolean flags.
 */
class StoreShopCouponRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool { return true; }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
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
            'is_active' => 'required|in:0,1,true,false,boolean',
        ];
    }

    /**
     * Prepare data for validation.
     * 
     * @return void
     */
    protected function prepareForValidation()
    {
        if ($this->has('is_active')) {
            $this->merge([
                'is_active' => filter_var($this->is_active, FILTER_VALIDATE_BOOLEAN),
            ]);
        }
    }

    /**
     * Define custom error messages.
     *
     * @return array
     */
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