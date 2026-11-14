<?php
/**
 * @file UpdateShopSupplierRequest.php
 * @path app/Apps/Shop/Http/Requests/ShopSupplier/UpdateShopSupplierRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation logic for updating existing shop suppliers - the rules and messages of
 *   StoreShopSupplierRequest; the company ID stays unique except for the supplier itself.
 */

namespace App\Apps\Shop\Http\Requests\ShopSupplier;

use Illuminate\Validation\Rule;

/**
 * @description Handles request validation for updating supplier information, ensuring unique identifiers.
 */
class UpdateShopSupplierRequest extends StoreShopSupplierRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        $supplierId = $this->route('supplier') ?? $this->route('id');

        return [
            ...parent::rules(),
            'ico' => ['nullable', 'string', 'max:20', Rule::unique('shop_suppliers', 'ico')->ignore($supplierId)],
        ];
    }
}
