<?php
/**
 * @file UpdateShopCategoryRequest.php
 * @path app/Http/Requests/Shop/ShopCategory/UpdateShopCategoryRequest.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating existing shop categories.
 */

namespace App\Http\Requests\Shop\ShopCategory;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use App\Models\Shop\ShopCategory;

/**
 * @description Handles request validation for category updates.
 * @note Implements conditional slug generation and scoped uniqueness checks for nested categories.
 */
class UpdateShopCategoryRequest extends FormRequest
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
        if ($this->has('name') && !$this->filled('slug')) {
            $this->merge(['slug' => Str::slug($this->name)]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        $id = $this->route('id');
        
        return [
            'name' => 'sometimes|required|string|max:150',
            'slug' => [
                'sometimes',
                'required',
                'string',
                'max:150',
                Rule::unique('shop_categories')->where(function ($query) {
                    $parentId = $this->has('parent_id') 
                        ? $this->parent_id 
                        : ShopCategory::where('id', $this->route('id'))->value('parent_id');
                        
                    return $query->where('parent_id', $parentId);
                })->ignore($id),
            ],
            'description' => 'nullable|string',
            'parent_id' => 'nullable|integer|exists:shop_categories,id|different:id',
            'image_path' => 'nullable|string|max:255',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}