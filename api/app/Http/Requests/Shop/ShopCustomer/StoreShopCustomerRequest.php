<?php
/**
 * @file StoreShopCustomerRequest.php
 * @path app/Http/Requests/Shop/ShopCustomer/StoreShopCustomerRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating new shop customer profiles.
 *
 * @refactor-note (2026-09-09) BACKLOG "backend fully in English": validation
 * messages translated from Czech.
 */

namespace App\Http\Requests\Shop\ShopCustomer;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for shop customer registration, enforcing data integrity and contact information formatting.
 */
class StoreShopCustomerRequest extends FormRequest
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
            'user_id'     => ['nullable', 'integer', 'exists:users,id', 'unique:shop_customers,user_id'],
            'email'       => ['required', 'email', 'max:150', 'unique:shop_customers,email'],
            'first_name'  => ['required', 'string', 'max:100'],
            'last_name'   => ['required', 'string', 'max:100'],
            'phone'       => ['nullable', 'string', 'max:20', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
            'company'     => ['nullable', 'string', 'max:150'],
            'address'     => ['nullable', 'string', 'max:255'],
            'city'        => ['nullable', 'string', 'max:100'],
            'postal_code' => ['nullable', 'string', 'max:10'],
            'country'     => ['nullable', 'string', 'max:50'],
            'is_active'   => ['required', 'boolean'],
            'notes'       => ['nullable', 'string', 'max:1000'],
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
            'email.required'      => 'E-mail is required.',
            'email.email'         => 'Enter a valid e-mail address.',
            'email.max'           => 'E-mail can be at most 150 characters.',
            'email.unique'        => 'This e-mail is already registered.',
            'first_name.required' => 'First name is required.',
            'first_name.max'      => 'First name can be at most 100 characters.',
            'last_name.required'  => 'Last name is required.',
            'last_name.max'       => 'Last name can be at most 100 characters.',
            'phone.regex'         => 'Enter a valid phone number.',
            'is_active.required'  => 'Activation status is required.',
        ];
    }
}