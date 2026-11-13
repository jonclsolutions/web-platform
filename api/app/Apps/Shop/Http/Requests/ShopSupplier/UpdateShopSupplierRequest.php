<?php
/**
 * @file UpdateShopSupplierRequest.php
 * @path app/Apps/Shop/Http/Requests/ShopSupplier/UpdateShopSupplierRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation logic for updating existing shop suppliers.
 */

namespace App\Apps\Shop\Http\Requests\ShopSupplier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @description Handles request validation for updating supplier information, ensuring unique identifiers.
 */
class UpdateShopSupplierRequest extends FormRequest
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
        $supplierId = $this->route('supplier') ?? $this->route('id');

        return [
            'name'           => 'required|string|min:2|max:200',
            'ico'            => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('shop_suppliers', 'ico')->ignore($supplierId),
            ],
            'contact_person' => 'nullable|string|max:150',
            'email'          => 'nullable|email|max:100',
            'phone'          => 'nullable|string|max:20',
            'address'        => 'nullable|string|max:255',
            'city'           => 'nullable|string|max:100',
            'postal_code'    => 'nullable|string|max:10',
            'country'        => 'nullable|string|max:50',
            'payment_terms'  => 'nullable|string|max:100',
            'is_active'      => 'required|boolean',
            'notes'          => 'nullable|string',
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'name.required'      => 'Supplier name is required.',
            'name.min'           => 'Name must be at least 2 characters.',
            'ico.unique'         => 'A supplier with this company ID already exists.',
            'email.email'        => 'Enter a valid e-mail address.',
            'is_active.required' => 'You must specify whether the supplier is active.',
        ];
    }
}