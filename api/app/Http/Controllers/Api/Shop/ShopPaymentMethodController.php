<?php
/**
 * @file ShopPaymentMethodController.php
 * @path app/Http/Controllers/Api/Shop/ShopPaymentMethodController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages configuration and status of shop payment methods, with strict protections against deletion or unauthorized modification of system-critical payment logic.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction(). Doménově beze změny (ShopLog::class).
 *
 * @refactor-note (2026-10-23) Removed `store()`, `destroy()` and `restore()`: payment methods
 * are fixed gateway integrations, the routes expose only index / show / update (`store()`
 * even referenced the non-existent StoreShopPaymentMethodRequest) - unreachable code.
 *
 * @bugfix-note (2026-10-23) unknown id → 500 instead of 404 in update (findOrFail inside try).
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopPaymentMethod;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopPaymentMethodResource;
use App\Http\Requests\Shop\ShopPaymentMethod\UpdateShopPaymentMethodRequest;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller for managing payment method configurations.
 * @note Prevents destruction and structural changes to ensure consistency with hardcoded gateway providers.
 */
class ShopPaymentMethodController extends Controller
{
    use LogsActivity;

    /**
     * Retrieves a paginated list of payment methods with optional filtering by status or provider.
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
     * Retrieves details for a specific payment method.
     */
    public function show($id): JsonResponse
    {
        $method = ShopPaymentMethod::withTrashed()->findOrFail($id);
        return response()->json(new ShopPaymentMethodResource($method));
    }

    /**
     * Updates an existing payment method while protecting core fields.
     */
    public function update(UpdateShopPaymentMethodRequest $request, $id): JsonResponse
    {
        $method = ShopPaymentMethod::withTrashed()->findOrFail($id);

        try {
            $validated = $request->validated();

            unset($validated['code']);
            unset($validated['provider']);

            $method->update($validated);

            $this->logAction($request, ShopLog::class, 'update', 'ShopPaymentMethod', "Updated payment method: {$method->name}", $method->id, 'ShopPaymentMethod');

            return response()->json(new ShopPaymentMethodResource($method));

        } catch (\Exception $e) {
            Log::error("Payment method update error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopPaymentMethod', "Update failed for ID {$id}: " . $e->getMessage(), (int) $id, 'ShopPaymentMethod');
            return response()->json(['message' => 'Update failed.'], 500);
        }
    }
}
