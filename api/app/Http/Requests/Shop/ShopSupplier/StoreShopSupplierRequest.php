<?php
/**
 * @file StoreShopSupplierRequest.php
 * @path app/Http/Requests/Shop/ShopSupplier/StoreShopSupplierRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for registering new shop suppliers.
 *
 * @refactor-note (2026-09-09) BACKLOG "backend fully in English": validation
 * messages translated from Czech.
 */

namespace App\Http\Requests\Shop\ShopSupplier;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for new supplier creation.
 */
class StoreShopSupplierRequest extends FormRequest
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
            'name'           => 'required|string|min:2|max:200',
            'ico'            => 'nullable|string|max:20|unique:shop_suppliers,ico',
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