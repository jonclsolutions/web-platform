<?php
/**
 * @file UpdateShopPaymentMethodRequest.php
 * @path app/Http/Requests/Shop/ShopPaymentMethod/UpdateShopPaymentMethodRequest.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating existing shop payment methods, including bank details and gateway configurations.
 */

namespace App\Http\Requests\Shop\ShopPaymentMethod;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for updating payment method settings.
 * @note Supports both manual bank transfer details and dynamic gateway configurations.
 */
class UpdateShopPaymentMethodRequest extends FormRequest
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
            'name'                 => ['required', 'string', 'max:100'],
            'description'          => ['nullable', 'string'],
            'price'                => ['required', 'numeric', 'min:0'],
            
            // Banking details for manual transfer methods
            'bank_account_number'  => ['nullable', 'string', 'max:50'],
            'bank_account_code'    => ['nullable', 'string', 'max:10'],
            'bank_iban'            => ['nullable', 'string', 'max:34'],
            'bank_swift_bic'       => ['nullable', 'string', 'max:11'],
            
            'variable_symbol_type' => ['required', 'in:order_number,phone_number,none'],
            'is_active'            => ['boolean'],
            'sort_order'           => ['integer'],
            
            // Flexible configuration array for payment gateway integration
            'config'               => ['nullable', 'array'],
        ];
    }
}