<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopShippingMethod;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopShippingMethodResource;
use App\Http\Requests\Shop\ShopShippingMethod\{StoreShopShippingMethodRequest, UpdateShopShippingMethodRequest};
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ShopShippingMethodController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = ShopShippingMethod::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('code', 'like', "%$s%")
                ->orWhere('name', 'like', "%$s%")
                ->orWhere('description', 'like', "%$s%"));
        }

        // Filtry na shodu - POUZE pokud jsou specifikovány v requesti
        foreach (['shipping_type', 'is_active', 'requires_pickup_point', 'allows_cod'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        $query->orderBy($request->input('sort_by', 'sort_order'), $request->input('sort_direction', 'asc'));

        $data = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN) 
            ? $query->get() 
            : $query->paginate($perPage);

        return response()->json($data instanceof \Illuminate\Support\Collection 
            ? ShopShippingMethodResource::collection($data) 
            : [
                'data' => ShopShippingMethodResource::collection($data->items()),
                'total' => $data->total(),
                'per_page' => $data->perPage(),
                'current_page' => $data->currentPage(),
                'last_page' => $data->lastPage(),
            ]);
    }

    public function store(StoreShopShippingMethodRequest $request): JsonResponse
    {
        try {
            $method = ShopShippingMethod::create($request->validated());
            $this->logAction($request, 'create', 'ShopShippingMethod', "Vytvořen způsob dopravy: {$method->name}", $method->id);
            return response()->json(new ShopShippingMethodResource($method), 201);
        } catch (\Exception $e) {
            return response()->json([
        'message' => 'Chyba při vytváření dopravy.',
        'debug_error' => $e->getMessage(), // Tady uvidíš, co je špatně
        'line' => $e->getLine()
    ], 500);
        }
    }

    public function show($id): JsonResponse
    {
        $method = ShopShippingMethod::withTrashed()->findOrFail($id);
        return response()->json(new ShopShippingMethodResource($method));
    }

    public function update(UpdateShopShippingMethodRequest $request, $id): JsonResponse
{
    try {
        $method = ShopShippingMethod::withTrashed()->findOrFail($id);
        
        $data = $request->validated();
        
        // OCHRANA: Pokud je metoda hardcoded, kód se nesmí změnit
        if ($method->isHardcoded()) {
            unset($data['code']); 
        }

        $method->update($data);
        $this->logAction($request, 'update', 'ShopShippingMethod', "Aktualizace dopravy: {$method->name}", $method->id);
        return response()->json(new ShopShippingMethodResource($method));
    } catch (\Exception $e) {
        return response()->json(['message' => 'Aktualizace selhala.'], 500);
    }
}

    public function destroy(Request $request, $id): JsonResponse
{
    $item = ShopShippingMethod::withTrashed()->findOrFail($id);
    
    // OCHRANA: Zákaz mazání systémových metod
    if ($item->isHardcoded()) {
        return response()->json([
            'message' => 'Tuto systémovou metodu dopravy (Osobní odběr / Nejbližší dopravce) nelze smazat.'
        ], 403);
    }

    $force = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
    $force ? $item->forceDelete() : $item->delete();
    
    $this->logAction($request, $force ? 'hard_delete' : 'soft_delete', 'ShopShippingMethod', "Smazání dopravy ID: $id", $id);
    return response()->json(null, 204);
}
    public function restore(Request $request, $id): JsonResponse
    {
        $item = ShopShippingMethod::withTrashed()->findOrFail($id);
        $item->restore();
        $this->logAction($request, 'restore', 'ShopShippingMethod', "Obnova dopravy ID: $id", $id);
        return response()->json(new ShopShippingMethodResource($item));
    }

    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null): void
    {
        try {
            $user = $request->user();
            ShopLog::create([
                'origin' => $request->ip(),
                'event_type' => $eventType,
                'module' => $module,
                'description' => $description,
                'affected_entity_type' => 'ShopShippingMethod',
                'affected_entity_id' => $affectedId,
                'user_id' => $user?->id,
                'context_data' => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_id_plain' => (string)($user?->id ?? '0'),
                'user_plain' => $user ? ($user->full_name ?? $user->user_email) : 'Systém'
            ]);
        } catch (\Exception $e) { Log::error("Log error: " . $e->getMessage()); }
    }
}