<?php
/**
 * @file StoreShopCustomerRequest.php
 * @path app/Http/Requests/Shop/ShopCustomer/StoreShopCustomerRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating new shop customer profiles.
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
            'email.required'      => 'Email je povinný.',
            'email.email'         => 'Zadejte platný email.',
            'email.max'           => 'Email může mít maximálně 150 znaků.',
            'email.unique'        => 'Tento email už je zaregistrován.',
            'first_name.required' => 'Jméno je povinné.',
            'first_name.max'      => 'Jméno může mít maximálně 100 znaků.',
            'last_name.required'  => 'Příjmení je povinné.',
            'last_name.max'       => 'Příjmení může mít maximálně 100 znaků.',
            'phone.regex'         => 'Zadejte platné telefonní číslo.',
            'is_active.required'  => 'Status aktivace je povinný.',
        ];
    }
}