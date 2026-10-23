<?php
/**
 * @file UpdateShopCategoryRequest.php
 * @path app/Http/Requests/Shop/ShopCategory/UpdateShopCategoryRequest.php
 * @project RPSW Web
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
            // @bugfix-note (2026-10-23) `different:id` compared with an `id` INPUT field that is never
            // sent, so a category could be made its own parent (endless tree in the admin /
            // storefront). Now the route id itself is excluded.
            // @bugfix-note (2026-10-23) Open finding #28: a category could still be moved under its OWN
            // descendant (A → B → A), a cycle that made the tree endless / unreachable. The new
            // parent's ancestor chain must not contain the edited category.
            'parent_id' => ['nullable', 'integer', 'exists:shop_categories,id', Rule::notIn([(int) $id]),
                function (string $attribute, mixed $value, \Closure $fail) use ($id) {
                    if ($value !== null && self::isDescendantOf((int) $value, (int) $id)) {
                        $fail('A category cannot be moved under its own subcategory.');
                    }
                }],
            'image_path' => 'nullable|string|max:255',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * @description Whether a category lies below the given one (walks up the parent chain).
     * @param int $categoryId Category to check (the requested new parent).
     * @param int $ancestorId The edited category.
     * @return bool True when `$ancestorId` is an ancestor of `$categoryId`.
     * @note At most 100 levels are walked, so an already broken (cyclic) chain cannot loop forever.
     */
    private static function isDescendantOf(int $categoryId, int $ancestorId): bool
    {
        $current = ShopCategory::whereKey($categoryId)->value('parent_id');
        for ($depth = 0; $current !== null && $depth < 100; $depth++) {
            if ((int) $current === $ancestorId) {
                return true;
            }
            $current = ShopCategory::whereKey($current)->value('parent_id');
        }
        return false;
    }
}
