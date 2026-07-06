<?php
/**
 * @file StoreShopProductRequest.php
 * @path app/Http/Requests/Shop/ShopProduct/StoreShopProductRequest.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating new shop products, including support for variants, localized descriptions, and multi-category assignments.
 */

namespace App\Http\Requests\Shop\ShopProduct;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

/**
 * @description Handles request validation for product creation.
 * @note Performs automated slug generation and enforces business rules like preventing active status for uncategorized products.
 */
class StoreShopProductRequest extends FormRequest
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
            'category_id'    => 'nullable|integer|exists:shop_categories,id',
            'category_ids'   => 'nullable|array',
            'category_ids.*' => 'integer|exists:shop_categories,id',
            'supplier_id'    => 'nullable|integer|exists:shop_suppliers,id',

            'name'              => 'required|string|max:200',
            'slug'              => 'nullable|string|max:200|unique:shop_products,slug',
            'description'       => 'nullable|string',
            'short_description' => 'nullable|string|max:500',

            'name_en'              => 'nullable|string|max:200',
            'description_en'       => 'nullable|string',
            'short_description_en' => 'nullable|string|max:500',

            'prices'                       => 'required|array',
            'prices.vat_rate'              => 'required|numeric|min:0',
            'prices.price_eur_without_vat' => 'required|numeric|gt:0',
            'prices.price_eur_with_vat'    => 'required|numeric|gt:0',
            'prices.cost_price_eur'        => 'nullable|numeric|min:0',

            'sku'                => 'nullable|string|max:50|unique:shop_products,sku',
            'stock_quantity'     => 'nullable|integer|min:0',
            'stock_warning_level'=> 'nullable|integer|min:0',

            'is_active' => [
                'boolean',
                function ($attribute, $value, $fail) {
                    $hasCategory = $this->filled('category_id') || ($this->filled('category_ids') && count((array)$this->input('category_ids')) > 0);
                    if ($value && !$hasCategory) {
                        $fail('Produkt nelze nastavit jako aktivní, pokud nemá přiřazenou žádnou kategorii.');
                    }
                }
            ],
            'is_featured'=> 'boolean',

            'images'               => 'nullable|array|max:10',
            'images.*.file'        => 'required_with:images|image|mimes:jpeg,png,jpg,webp|max:5120',
            'images.*.alt_text'    => 'nullable|string|max:200',
            'images.*.is_primary'  => 'boolean',
            'images.*.sort_order'  => 'nullable|integer|min:0',

            'variants'                             => 'nullable|array|max:50',
            'variants.*.variant_name'              => 'required_with:variants|string|max:100',
            'variants.*.attribute_1_name'          => 'nullable|string|max:50',
            'variants.*.attribute_1_value'         => 'nullable|string|max:100',
            'variants.*.attribute_2_name'          => 'nullable|string|max:50',
            'variants.*.attribute_2_value'         => 'nullable|string|max:100',
            'variants.*.sku_variant'               => 'nullable|string|max:50|unique:shop_product_variants,sku_variant',
            'variants.*.stock_quantity'            => 'nullable|integer|min:0',

            'variants.*.prices'                          => 'required_with:variants|array',
            'variants.*.prices.vat_rate'                 => 'required_with:variants.*.prices|numeric|min:0',
            'variants.*.prices.price_eur_without_vat'    => 'required_with:variants.*.prices|numeric|gt:0',
            'variants.*.prices.price_eur_with_vat'       => 'required_with:variants.*.prices|numeric|gt:0',
            'variants.*.prices.cost_price_eur'           => 'nullable|numeric|min:0',
        ];
    }

    /**
     * Get custom messages for validation errors.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'name.required'                            => 'Název produktu je povinný.',
            'prices.price_eur_without_vat.required'    => 'Cena v EUR bez DPH je povinná.',
            'prices.price_eur_without_vat.gt'          => 'Cena v EUR bez DPH musí být větší než 0.',
            'prices.price_eur_with_vat.gt'             => 'Cena v EUR s DPH musí být větší než 0.',
        ];
    }

    /**
     * Prepare data for validation, including generating slugs and setting defaults.
     *
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if ($this->filled('name') && ! $this->filled('slug')) {
            $this->merge(['slug' => $this->generateSlug($this->input('name'))]);
        }

        $this->merge([
            'is_active'           => $this->boolean('is_active'),
            'is_featured'         => $this->boolean('is_featured'),
            'stock_quantity'      => $this->input('stock_quantity', 0),
            'stock_warning_level' => $this->input('stock_warning_level', 10),
        ]);
    }

    /**
     * Generate a URL-friendly slug.
     *
     * @param string $name
     * @return string
     */
    private function generateSlug(string $name): string
    {
        return Str::slug($name, '-');
    }
}