<?php
/**
 * @file ShopPaymentMethodController.php
 * @path app/Http/Controllers/Api/Shop/ShopPaymentMethodController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages configuration and status of shop payment methods, with strict protections against deletion or unauthorized modification of system-critical payment logic.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopPaymentMethod;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopPaymentMethodResource;
use App\Http\Requests\Shop\ShopPaymentMethod\StoreShopPaymentMethodRequest;
use App\Http\Requests\Shop\ShopPaymentMethod\UpdateShopPaymentMethodRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller for managing payment method configurations.
 * @note Prevents destruction and structural changes to ensure consistency with hardcoded gateway providers.
 */
class ShopPaymentMethodController extends Controller
{
    /**
     * Retrieves a paginated list of payment methods with optional filtering by status or provider.
     *
     * @param Request $request Incoming request with search, provider, or active status filters.
     * @return JsonResponse Paginated result or full collection.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = ShopPaymentMethod::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('name', 'like', "%$s%")
                ->orWhere('code', 'like', "%$s%")
                ->orWhere('provider', 'like', "%$s%"));
        }

        foreach (['provider', 'is_active', 'is_external'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        $query->orderBy($request->input('sort_by', 'sort_order'), $request->input('sort_direction', 'asc'));

        $data = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN) 
            ? $query->get() 
            : $query->paginate($perPage);

        return response()->json($data instanceof \Illuminate\Support\Collection 
            ? ShopPaymentMethodResource::collection($data) 
            : [
                'data' => ShopPaymentMethodResource::collection($data->items()),
                'total' => $data->total(),
                'per_page' => $data->perPage(),
                'current_page' => $data->currentPage(),
                'last_page' => $data->lastPage(),
            ]);
    }

    /**
     * Attempts to create a new payment method.
     *
     * @param StoreShopPaymentMethodRequest $request Validated request data.
     * @return JsonResponse Error 403 as creation is restricted.
     */
    public function store(StoreShopPaymentMethodRequest $request): JsonResponse
    {
        return response()->json(['message' => 'Vytváření nových platebních metod je zakázáno.'], 403);
    }

    /**
     * Retrieves details for a specific payment method.
     *
     * @param int $id The method ID.
     * @return JsonResponse The payment method resource.
     */
    public function show($id): JsonResponse
    {
        $method = ShopPaymentMethod::withTrashed()->findOrFail($id);
        return response()->json(new ShopPaymentMethodResource($method));
    }

    /**
     * Updates an existing payment method while protecting core fields.
     *
     * @param UpdateShopPaymentMethodRequest $request Validated update data.
     * @param int $id The method ID.
     * @return JsonResponse The updated resource.
     * @throws \Exception On failure.
     */
    public function update(UpdateShopPaymentMethodRequest $request, $id): JsonResponse
    {
        try {
            $method = ShopPaymentMethod::withTrashed()->findOrFail($id);
            $validated = $request->validated();
            
            unset($validated['code']);
            unset($validated['provider']);

            $method->update($validated);

            $this->logAction($request, 'update', 'ShopPaymentMethod', "Aktualizace platební metody: {$method->name}", $method->id);

            return response()->json(new ShopPaymentMethodResource($method));
            
        } catch (\Exception $e) {
            Log::error("Payment method update error: " . $e->getMessage());
            return response()->json(['message' => 'Aktualizace selhala.'], 500);
        }
    }

    /**
     * Attempts to delete a payment method.
     *
     * @param Request $request Incoming request.
     * @param int $id The method ID.
     * @return JsonResponse Error 403 as deletion is prohibited.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        return response()->json(['message' => 'Systémové platební metody nelze smazat, pouze deaktivovat.'], 403);
    }

    /**
     * Restores a previously soft-deleted payment method.
     *
     * @param Request $request Incoming request.
     * @param int $id The method ID.
     * @return JsonResponse The restored resource.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $item = ShopPaymentMethod::withTrashed()->findOrFail($id);
        $item->restore();
        $this->logAction($request, 'restore', 'ShopPaymentMethod', "Obnova platební metody ID: $id", $id);
        return response()->json(new ShopPaymentMethodResource($item));
    }

    /**
     * Logs administrative actions to the central audit system.
     *
     * @param Request $request Request context.
     * @param string $eventType Operation type.
     * @param string $module Module identification.
     * @param string $description Audit entry description.
     * @param int|null $affectedId Entity ID.
     * @return void
     */
    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null): void
    {
        try {
            $user = $request->user() ?? auth('sanctum')->user();
            ShopLog::create([
                'origin' => $request->ip(),
                'event_type' => $eventType,
                'module' => $module,
                'description' => $description,
                'affected_entity_type' => 'ShopPaymentMethod',
                'affected_entity_id' => $affectedId,
                'user_id' => $user?->id,
                'context_data' => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_id_plain' => (string)($user?->id ?? '0'),
                'user_plain' => $user ? ($user->full_name ?? $user->user_email) : 'Systém'
            ]);
        } catch (\Exception $e) { Log::error("Log error: " . $e->getMessage()); }
    }
}