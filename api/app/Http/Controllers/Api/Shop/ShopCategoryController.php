<?php
/**
 * @file ShopCategoryController.php
 * @path app/Http/Controllers/Api/Shop/ShopCategoryController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages CRUD operations for shop product categories, including hierarchical relationships, validation logic for deletion, and audit logging.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopCategory;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopCategoryResource;
use App\Http\Requests\Shop\ShopCategory\StoreShopCategoryRequest;
use App\Http\Requests\Shop\ShopCategory\UpdateShopCategoryRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller responsible for maintaining the shop category tree structure.
 * @note Implements guard clauses during deletion to ensure referential integrity for child categories and associated products.
 */
class ShopCategoryController extends Controller
{
    /**
     * Retrieves a list of categories, optionally paginated for the administrative interface.
     *
     * @param Request $request The incoming request containing search, filters, and pagination parameters.
     * @return JsonResponse Returns either a collection or a paginated JSON response formatted for GenericTable.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $query = ShopCategory::with('parent')->withCount('products');

        // Apply search filtering
        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('name', 'like', "%$s%")
                ->orWhere('slug', 'like', "%$s%"));
        }

        // Apply attribute filtering
        foreach (['parent_id', 'is_active'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        $query->orderBy($request->input('sort_by', 'sort_order'), $request->input('sort_direction', 'asc'));

        // Handle pagination toggling
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
     * Persists a new category entry.
     *
     * @param StoreShopCategoryRequest $request Validated request data.
     * @return JsonResponse The newly created category resource.
     */
    public function store(StoreShopCategoryRequest $request): JsonResponse
    {
        try {
            $category = ShopCategory::create($request->validated());
            $this->logAction($request, 'create', 'ShopCategory', "Created category: {$category->name}", $category->id);
            return response()->json(new ShopCategoryResource($category), 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to create category.'], 500);
        }
    }

    /**
     * Returns a specific category with its parent and nested children.
     *
     * @param int $id The category ID.
     * @return JsonResponse The requested category resource.
     */
    public function show($id): JsonResponse
    {
        $category = ShopCategory::with(['parent', 'children'])->findOrFail($id);
        return response()->json(new ShopCategoryResource($category));
    }

    /**
     * Updates an existing category.
     *
     * @param UpdateShopCategoryRequest $request Validated update data.
     * @param int $id The category ID.
     * @return JsonResponse The updated category resource.
     */
    public function update(UpdateShopCategoryRequest $request, $id): JsonResponse
    {
        try {
            $category = ShopCategory::findOrFail($id);
            $category->update($request->validated());
            $this->logAction($request, 'update', 'ShopCategory', "Updated category ID: {$category->id}", $category->id);
            return response()->json(new ShopCategoryResource($category));
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to update category.'], 500);
        }
    }

    /**
     * Deletes a category if no child categories or products are associated with it.
     *
     * @param Request $request Incoming request.
     * @param int $id The category ID.
     * @return JsonResponse Status 204 on success, or 422 with an error message.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $item = ShopCategory::findOrFail($id);

            // Prevent deletion if tree structure exists
            if ($item->children()->exists()) {
                return response()->json([
                    'message' => "Cannot delete '{$item->name}' because it contains subcategories. Please remove or move them first."
                ], 422);
            }

            // Prevent deletion if products are assigned
            if ($item->products()->exists()) {
                return response()->json([
                    'message' => "Cannot delete '{$item->name}' because it has assigned products. Please move or delete these products first."
                ], 422);
            }

            $item->delete();
            $this->logAction($request, 'delete', 'ShopCategory', "Deleted category: {$item->name}", $id);
            return response()->json(null, 204);
            
        } catch (\Exception $e) {
            Log::error("Delete error (ShopCategory): " . $e->getMessage());
            return response()->json(['message' => 'Deletion failed.'], 500);
        }
    }

    /**
     * Logs administrative actions to the central audit system.
     *
     * @param Request $request The request context.
     * @param string $eventType Action type.
     * @param string $module Module identification.
     * @param string $description Audit message.
     * @param int|null $affectedId Target entity ID.
     * @return void
     */
    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null): void
    {
        try {
            $user = $request->user() ?? auth('sanctum')->user();
            ShopLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => $description,
                'affected_entity_type' => 'ShopCategory',
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user ? ($user->full_name ?? $user->user_email) : 'System'
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (ShopCategory): " . $e->getMessage());
        }
    }
}