<?php

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

class ShopCategoryController extends Controller
{
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

        $query->orderBy($request->input('sort_by', 'sort_order'), $request->input('sort_direction', 'asc'));

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

    public function store(StoreShopCategoryRequest $request): JsonResponse
    {
        try {
            $category = ShopCategory::create($request->validated());
            $this->logAction($request, 'create', 'ShopCategory', "Vytvořena kategorie: {$category->name}", $category->id);
            return response()->json(new ShopCategoryResource($category), 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Vytvoření kategorie selhalo.'], 500);
        }
    }

    public function show($id): JsonResponse
    {
        $category = ShopCategory::with(['parent', 'children'])->findOrFail($id);
        return response()->json(new ShopCategoryResource($category));
    }

    public function update(UpdateShopCategoryRequest $request, $id): JsonResponse
    {
        try {
            $category = ShopCategory::findOrFail($id);
            $category->update($request->validated());
            $this->logAction($request, 'update', 'ShopCategory', "Aktualizace kategorie ID: {$category->id}", $category->id);
            return response()->json(new ShopCategoryResource($category));
        } catch (\Exception $e) {
            return response()->json(['message' => 'Aktualizace kategorie selhala.'], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
{
    try {
        $item = ShopCategory::findOrFail($id);

        // 1. Kontrola existence podkategorií
        if ($item->children()->exists()) {
            return response()->json([
                'message' => "Kategorii '{$item->name}' nelze smazat, protože obsahuje podkategorie. Nejdříve je odstraňte nebo přesuňte."
            ], 422);
        }

        // 2. NOVÉ: Kontrola existence přiřazených produktů
        // Předpokládá existenci metody products() v modelu ShopCategory
        if ($item->products()->exists()) {
            return response()->json([
                'message' => "Kategorii '{$item->name}' nelze smazat, protože obsahuje přiřazené produkty. Nejdříve produkty přesuňte do jiné kategorie nebo je smažte."
            ], 422);
        }

        $item->delete();
        $this->logAction($request, 'delete', 'ShopCategory', "Smazána kategorie: {$item->name}", $id);
        return response()->json(null, 204);
        
    } catch (\Exception $e) {
        Log::error("Delete error (ShopCategory): " . $e->getMessage());
        return response()->json(['message' => 'Smazání se nezdařilo.'], 500);
    }
}
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
                'user_plain'           => $user ? ($user->full_name ?? $user->user_email) : 'Systém'
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (ShopCategory): " . $e->getMessage());
        }
    }
}