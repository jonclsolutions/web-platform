<?php

namespace App\Http\Requests\Shop\ShopSupplier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateShopSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Bezpečné získání ID dodavatele z parametrů routy (zkouší varianty 'supplier' i 'id')
        $supplierId = $this->route('supplier') ?? $this->route('id');

        return [
            'name' => 'required|string|min:2|max:200',
            'ico' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('shop_suppliers', 'ico')->ignore($supplierId), // Bezpečné ignorování aktuálního ID
            ],
            'contact_person' => 'nullable|string|max:150',
            'email' => 'nullable|email|max:100',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:10',
            'country' => 'nullable|string|max:50',
            'payment_terms' => 'nullable|string|max:100',
            'is_active' => 'required|boolean', // Sjednoceno na required podle frontendu
            'notes' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Název dodavatele je povinný.',
            'name.min' => 'Název musí mít alespoň 2 znaky.',
            'ico.unique' => 'Dodavatel s tímto IČO již existuje.',
            'email.email' => 'Zadejte platnou e-mailovou adresu.',
            'is_active.required' => 'Musíte určit, zda je dodavatel aktivní.',
        ];
    }
}