<?php
/**
 * @file ShopCategoryController.php
 * @path app/Http/Controllers/Api/Shop/ShopCategoryController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages CRUD operations for shop product categories, including hierarchical relationships, validation logic for deletion, and audit logging.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction(). Doménově beze změny (ShopLog::class).
 *
 * @bugfix-note (2026-10-23) unknown id → 500 instead of 404 in update / destroy (findOrFail inside try).
 * @bugfix-note (2026-10-23) `sort_by` / `sort_direction` went straight into `orderBy()` - an
 *   unknown column or direction answered 500 (open finding #5). Sorting now goes through
 *   AppliesSafeSorting (real table columns only, asc / desc only, default otherwise).
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopCategory;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopCategoryResource;
use App\Http\Requests\Shop\ShopCategory\StoreShopCategoryRequest;
use App\Http\Requests\Shop\ShopCategory\UpdateShopCategoryRequest;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use App\Traits\AppliesSafeSorting;

/**
 * @description Controller responsible for maintaining the shop category tree structure.
 * @note Implements guard clauses during deletion to ensure referential integrity for child categories and associated products.
 */
class ShopCategoryController extends Controller
{
    use LogsActivity, AppliesSafeSorting;

    /**
     * Retrieves a list of categories, optionally paginated for the administrative interface.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $query = ShopCategory::with('parent')->withCount('products');

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('name', 'like', "%$s%")
                ->orWhere('slug', 'like', "%$s%"));
        }

        foreach (['parent_id', 'is_active'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        $this->applySorting($query, $request, 'sort_order', 'asc');

        $data = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN)
            ? $query->get()
            : $query->paginate($perPage);

        if ($data instanceof \Illuminate\Support\Collection) {
            return response()->json(ShopCategoryResource::collection($data));
        }

        return response()->json([
            'data'         => ShopCategoryResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * @description Public category list of the storefront (open finding #27): only active
     *   categories whose parent (if any) is active too, always the whole list (it is the
     *   navigation of the catalogue), ordered like the admin tree.
     * @param Request $request Current request (sorting parameters are ignored).
     * @return JsonResponse Array of categories.
     * @note Before, the public route used the admin `index()`: inactive categories were listed
     *   and only 15 per page without `no_pagination`.
     */
    public function publicIndex(Request $request): JsonResponse
    {
        $categories = ShopCategory::with('parent')->withCount('products')
            ->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('parent_id')->orWhereHas('parent', fn ($p) => $p->where('is_active', true)))
            ->orderBy('sort_order')->orderBy('name')
            ->get();

        return response()->json(ShopCategoryResource::collection($categories));
    }

    /**
     * Persists a new category entry.
     */
    public function store(StoreShopCategoryRequest $request): JsonResponse
    {
        try {
            $category = ShopCategory::create($request->validated());
            $this->logAction($request, ShopLog::class, 'create', 'ShopCategory', "Created category: {$category->name}", $category->id, 'ShopCategory');
            return response()->json(new ShopCategoryResource($category), 201);
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopCategory', "Failed to create category: " . $e->getMessage());
            return response()->json(['message' => 'Failed to create category.'], 500);
        }
    }

    /**
     * Returns a specific category with its parent and nested children.
     */
    public function show($id): JsonResponse
    {
        $category = ShopCategory::with(['parent', 'children'])->findOrFail($id);
        return response()->json(new ShopCategoryResource($category));
    }

    /**
     * Updates an existing category.
     */
    public function update(UpdateShopCategoryRequest $request, $id): JsonResponse
    {
        $category = ShopCategory::findOrFail($id);

        try {
            $category->update($request->validated());
            $this->logAction($request, ShopLog::class, 'update', 'ShopCategory', "Updated category ID: {$category->id}", $category->id, 'ShopCategory');
            return response()->json(new ShopCategoryResource($category));
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopCategory', "Failed to update category ID {$id}: " . $e->getMessage(), (int) $id, 'ShopCategory');
            return response()->json(['message' => 'Failed to update category.'], 500);
        }
    }

    /**
     * Deletes a category if no child categories or products are associated with it.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $item = ShopCategory::findOrFail($id);

        try {
            if ($item->children()->exists()) {
                return response()->json([
                    'message' => "Cannot delete '{$item->name}' because it contains subcategories. Please remove or move them first."
                ], 422);
            }

            if ($item->products()->exists()) {
                return response()->json([
                    'message' => "Cannot delete '{$item->name}' because it has assigned products. Please move or delete these products first."
                ], 422);
            }

            $item->delete();
            $this->logAction($request, ShopLog::class, 'delete', 'ShopCategory', "Deleted category: {$item->name}", (int) $id, 'ShopCategory');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopCategory', "Delete error ID {$id}: " . $e->getMessage(), (int) $id, 'ShopCategory');
            Log::error("Delete error (ShopCategory): " . $e->getMessage());
            return response()->json(['message' => 'Deletion failed.'], 500);
        }
    }
}