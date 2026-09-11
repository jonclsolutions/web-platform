<?php
/**
 * @file ShopShippingMethodController.php
 * @path app/Http/Controllers/Api/Shop/ShopShippingMethodController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Controller managing shipping methods, including filtering, lifecycle operations, and administrative logging. Implements safety checks to protect system-critical hardcoded shipping methods from modification or deletion.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction(). Doménově beze změny (ShopLog::class). `store()` už
 * loguje jen v úspěšné větvi (chybová větev nyní také přes logAction() namísto
 * vraceného `debug_error`/`line` v odpovědi - viz poznámka u store() níže, `debug_error`
 * v produkci zbytečně odhaluje interní implementační detaily volajícímu).
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopShippingMethod;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopShippingMethodResource;
use App\Http\Requests\Shop\ShopShippingMethod\{StoreShopShippingMethodRequest, UpdateShopShippingMethodRequest};
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Manages CRUD operations for shop shipping configurations.
 * @note Enforces business rules regarding immutable (hardcoded) shipping logic.
 */
class ShopShippingMethodController extends Controller
{
    use LogsActivity;

    /**
     * Retrieves a paginated list of shipping methods with filtering support.
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
     * @note Chybová větev dřív vracela `debug_error`/`line` přímo klientovi - v produkci
     * to zbytečně odhaluje interní implementační detaily; nahrazeno standardním
     * logAction() zápisem do audit logu a obecnou chybovou hláškou pro klienta.
     */
    public function store(StoreShopShippingMethodRequest $request): JsonResponse
    {
        try {
            $method = ShopShippingMethod::create($request->validated());
            $this->logAction($request, ShopLog::class, 'create', 'ShopShippingMethod', "Created shipping method: {$method->name}", $method->id, 'ShopShippingMethod');
            return response()->json(new ShopShippingMethodResource($method), 201);
        } catch (\Exception $e) {
            Log::error("ShopShippingMethod store error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopShippingMethod', "Error creating shipping method: " . $e->getMessage());
            return response()->json(['message' => 'Error creating shipping method.'], 500);
        }
    }

    /**
     * Retrieves a single shipping method by ID.
     */
    public function show($id): JsonResponse
    {
        $method = ShopShippingMethod::withTrashed()->findOrFail($id);
        return response()->json(new ShopShippingMethodResource($method));
    }

    /**
     * Updates an existing shipping method, enforcing integrity rules for hardcoded methods.
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
            $this->logAction($request, ShopLog::class, 'update', 'ShopShippingMethod', "Updated shipping method: {$method->name}", $method->id, 'ShopShippingMethod');
            return response()->json(new ShopShippingMethodResource($method));
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopShippingMethod', "Update failed for ID {$id}: " . $e->getMessage(), (int) $id, 'ShopShippingMethod');
            return response()->json(['message' => 'Update failed.'], 500);
        }
    }

    /**
     * Removes a shipping method from the system. Prevents deletion of hardcoded entries.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $item = ShopShippingMethod::withTrashed()->findOrFail($id);

        if ($item->isHardcoded()) {
            return response()->json([
                'message' => 'System shipping methods (Personal pickup / Nearest carrier) cannot be deleted.'
            ], 403);
        }

        $force = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
        $force ? $item->forceDelete() : $item->delete();

        $this->logAction($request, ShopLog::class, $force ? 'hard_delete' : 'soft_delete', 'ShopShippingMethod', "Deleted shipping method ID: $id", (int) $id, 'ShopShippingMethod');
        return response()->json(null, 204);
    }

    /**
     * Restores a previously soft-deleted shipping method.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $item = ShopShippingMethod::withTrashed()->findOrFail($id);
        $item->restore();
        $this->logAction($request, ShopLog::class, 'restore', 'ShopShippingMethod', "Restored shipping method ID: $id", (int) $id, 'ShopShippingMethod');
        return response()->json(new ShopShippingMethodResource($item));
    }
}