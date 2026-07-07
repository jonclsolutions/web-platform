<?php
/**
 * @file UpdateShopProductRequest.php
 * @path app/Http/Requests/Shop/ShopProduct/UpdateShopProductRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating existing shop products, handling dynamic associations and variant management.
 */

namespace App\Http\Requests\Shop\ShopProduct;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * @description Handles request validation for product updates.
 * @note Implements complex uniqueness checks for variants and ensures data consistency during partial updates.
 */
class UpdateShopProductRequest extends FormRequest
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
        $productId = $this->route('product') ?: $this->route('id');

        return [
            'category_id'    => 'nullable|integer|exists:shop_categories,id',
            'category_ids'   => 'nullable|array',
            'category_ids.*' => 'integer|exists:shop_categories,id',

            'supplier_id' => 'nullable|integer|exists:shop_suppliers,id',

            'name'              => 'required|string|max:200',
            'slug'              => 'nullable|string|max:200|unique:shop_products,slug,' . $productId,
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

            'sku'                => 'nullable|string|max:50|unique:shop_products,sku,' . $productId,
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

            'images'              => 'nullable|array|max:10',
            'images.*.id'         => 'nullable|integer|exists:shop_product_images,id',
            'images.*.file'       => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
            'images.*.alt_text'   => 'nullable|string|max:200',
            'images.*.is_primary' => 'boolean',
            'images.*.sort_order' => 'nullable|integer|min:0',
            'delete_images'       => 'nullable|array',
            'delete_images.*'     => 'integer|exists:shop_product_images,id',

            'variants'                    => 'nullable|array|max:50',
            'variants.*.id'               => 'nullable|integer|exists:shop_product_variants,id',
            'variants.*.variant_name'     => 'required_with:variants|string|max:100',
            'variants.*.attribute_1_name' => 'nullable|string|max:50',
            'variants.*.attribute_1_value'=> 'nullable|string|max:100',
            'variants.*.attribute_2_name' => 'nullable|string|max:50',
            'variants.*.attribute_2_value'=> 'nullable|string|max:100',

            'variants.*.sku_variant' => [
                'nullable', 'string', 'max:50',
                function ($attribute, $value, $fail) {
                    preg_match('/variants\.(\d+)\.sku_variant/', $attribute, $matches);
                    $index     = $matches[1] ?? null;
                    $variantId = $this->input("variants.{$index}.id");

                    $exists = DB::table('shop_product_variants')
                        ->where('sku_variant', $value)
                        ->when($variantId, fn($q) => $q->where('id', '!=', $variantId))
                        ->exists();

                    if ($exists) {
                        $fail('Varianta SKU "' . $value . '" již existuje.');
                    }
                },
            ],

            'variants.*.stock_quantity' => 'nullable|integer|min:0',

            'variants.*.prices'                       => 'required_with:variants|array',
            'variants.*.prices.vat_rate'              => 'required_with:variants.*.prices|numeric|min:0',
            'variants.*.prices.price_eur_without_vat' => 'required_with:variants.*.prices|numeric|min:0',
            'variants.*.prices.price_eur_with_vat'    => 'required_with:variants.*.prices|numeric|min:0',
            'variants.*.prices.cost_price_eur'        => 'nullable|numeric|min:0',

            'delete_variants'   => 'nullable|array',
            'delete_variants.*' => 'integer|exists:shop_product_variants,id',
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
            'category_id.exists'                    => 'Vybraná kategorie neexistuje.',
            'category_ids.*.exists'                 => 'Jedna z vybraných kategorií neexistuje.',
            'name.required'                         => 'Název produktu je povinný.',
            'sku.unique'                            => 'Tento SKU kód již používá jiný produkt.',
            'images.*.file.image'                   => 'Soubor musí být obrázek.',
            'images.*.file.max'                     => 'Obrázek je příliš velký (max 5MB).',
            'variants.*.sku_variant.unique'         => 'Varianta SKU už existuje.',
        ];
    }

    /**
     * Prepare data for validation.
     *
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if ($this->filled('name') && (! $this->filled('slug') || $this->has('auto_slug'))) {
            $this->merge(['slug' => $this->generateSlug($this->input('name'))]);
        }

        $this->merge([
            'is_active'           => $this->boolean('is_active'),
            'is_featured'         => $this->boolean('is_featured'),
            'stock_warning_level' => $this->input('stock_warning_level', 10),
        ]);

        if (! $this->filled('category_id') && $this->filled('category_ids')) {
            $ids = (array) $this->input('category_ids');
            if (! empty($ids)) {
                $this->merge(['category_id' => (int) $ids[0]]);
            }
        }
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