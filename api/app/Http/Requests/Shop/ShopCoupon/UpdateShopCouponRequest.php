<?php
/**
 * @file UpdateShopCouponRequest.php
 * @path App\Http\Requests\Shop\ShopCoupon\UpdateShopCouponRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating existing discount coupons.
 */

namespace App\Http\Requests\Shop\ShopCoupon;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @description Handles validation for coupon updates, excluding current record from uniqueness constraints.
 */
class UpdateShopCouponRequest extends FormRequest
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
            'code.required' => 'The coupon code is required.',
            'code.unique' => 'This coupon code already exists.',
            'discount_type.required' => 'The discount type is required.',
            'discount_value.required' => 'The discount value is required.',
            'valid_until.after_or_equal' => 'The expiration date must be a date after or equal to the start date.',
        ];
    }
}