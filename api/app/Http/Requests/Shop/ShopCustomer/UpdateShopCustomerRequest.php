<?php
/**
 * @file UpdateShopCustomerRequest.php
 * @path app/Http/Requests/Shop/ShopCustomer/UpdateShopCustomerRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating existing shop customer profiles.
 */

namespace App\Http\Requests\Shop\ShopCustomer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @description Handles request validation for updating customer records, ensuring email and user association uniqueness while ignoring the current record ID.
 */
class UpdateShopCustomerRequest extends FormRequest
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
        // Identify the record being updated from the route (e.g., /api/customers/{customer})
        $customerId = $this->route('customer') ?? $this->route('id');

        return [
            'user_id' => [
                'nullable', 
                'integer', 
                'exists:users,id', 
                Rule::unique('shop_customers', 'user_id')->ignore($customerId)
            ],
            'email' => [
                'required', 
                'email', 
                'max:150', 
                Rule::unique('shop_customers', 'email')->ignore($customerId)
            ],
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
            'email.unique'        => 'Tento email již používá jiný zákazník.',
            'first_name.required' => 'Jméno je povinné.',
            'last_name.required'  => 'Příjmení je povinné.',
            'phone.regex'         => 'Zadejte platné telefonní číslo.',
        ];
    }
}