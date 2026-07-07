<?php
/**
 * @file StoreShopCategoryRequest.php
 * @path app/Http/Requests/Shop/ShopCategory/StoreShopCategoryRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating new shop categories, including automated slug generation.
 */

namespace App\Http\Requests\Shop\ShopCategory;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * @description Handles request validation for new shop categories.
 * @note Automatically generates a slug from the name if absent and ensures category structure integrity.
 */
class StoreShopCategoryRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool { return true; }

    /**
     * Prepare the data for validation.
     * 
     * @return void
     */
    protected function prepareForValidation()
    {
        if (!$this->slug && $this->name) {
            $this->merge(['slug' => Str::slug($this->name)]);
        }

        $this->merge([
            'is_active' => $this->boolean('is_active', false)
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:150',
            'slug' => [
                'required',
                'string',
                'max:150',
                Rule::unique('shop_categories')->where(function ($query) {
                    return $query->where('parent_id', $this->parent_id);
                }),
            ],
            'description' => 'nullable|string',
            'parent_id' => 'nullable|integer|exists:shop_categories,id',
            'image_path' => 'nullable|string|max:255',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}