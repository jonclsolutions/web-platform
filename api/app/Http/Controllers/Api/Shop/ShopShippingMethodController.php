<?php
/**
 * @file ShopShippingMethodController.php
 * @path app/Http/Controllers/Api/Shop/ShopShippingMethodController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Controller managing shipping methods, including filtering, lifecycle operations, and administrative logging. Implements safety checks to protect system-critical hardcoded shipping methods from modification or deletion.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopShippingMethod;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopShippingMethodResource;
use App\Http\Requests\Shop\ShopShippingMethod\{StoreShopShippingMethodRequest, UpdateShopShippingMethodRequest};
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Manages CRUD operations for shop shipping configurations.
 * @note Enforces business rules regarding immutable (hardcoded) shipping logic.
 */
class ShopShippingMethodController extends Controller
{
    /**
     * Retrieves a paginated list of shipping methods with filtering support.
     *
     * @param Request $request Filter, sort, and pagination parameters.
     * @return JsonResponse Returns either a standard paginated response or a full collection.
     */
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

    /**
     * Persists a new shipping method into the system.
     *
     * @param StoreShopShippingMethodRequest $request Validated shipping method data.
     * @return JsonResponse Created resource details.
     * @throws \Exception On database failure.
     */
    public function store(StoreShopShippingMethodRequest $request): JsonResponse
    {
        try {
            $method = ShopShippingMethod::create($request->validated());
            $this->logAction($request, 'create', 'ShopShippingMethod', "Vytvořen způsob dopravy: {$method->name}", $method->id);
            return response()->json(new ShopShippingMethodResource($method), 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Chyba při vytváření dopravy.',
                'debug_error' => $e->getMessage(),
                'line' => $e->getLine()
            ], 500);
        }
    }

    /**
     * Retrieves a single shipping method by ID.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $method = ShopShippingMethod::withTrashed()->findOrFail($id);
        return response()->json(new ShopShippingMethodResource($method));
    }

    /**
     * Updates an existing shipping method, enforcing integrity rules for hardcoded methods.
     *
     * @param UpdateShopShippingMethodRequest $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(UpdateShopShippingMethodRequest $request, $id): JsonResponse
    {
        try {
            $method = ShopShippingMethod::withTrashed()->findOrFail($id);
            
            $data = $request->validated();
            
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

    /**
     * Removes a shipping method from the system. Prevents deletion of hardcoded entries.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $item = ShopShippingMethod::withTrashed()->findOrFail($id);
        
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

    /**
     * Restores a previously soft-deleted shipping method.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $item = ShopShippingMethod::withTrashed()->findOrFail($id);
        $item->restore();
        $this->logAction($request, 'restore', 'ShopShippingMethod', "Obnova dopravy ID: $id", $id);
        return response()->json(new ShopShippingMethodResource($item));
    }

    /**
     * Logs administrative actions for audit tracking.
     *
     * @param Request $request
     * @param string $eventType
     * @param string $module
     * @param string $description
     * @param int|null $affectedId
     * @return void
     */
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