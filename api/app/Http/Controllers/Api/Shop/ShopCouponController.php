<?php
/**
 * @file ShopCouponController.php
 * @path app/Http/Controllers/Api/Shop/ShopCouponController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Handles CRUD operations for promotional coupons, including soft-delete functionality, restore capabilities, and integrity-checked batch cleanup.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopCoupon;
use App\Models\Shop\ShopLog;
use App\Models\Shop\ShopOrder;
use App\Http\Resources\Shop\ShopCouponResource;
use App\Http\Requests\Shop\ShopCoupon\StoreShopCouponRequest;
use App\Http\Requests\Shop\ShopCoupon\UpdateShopCouponRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller responsible for managing shop coupon lifecycle and audit logs.
 * @note Features specific cleanup logic to ensure coupons linked to existing order history are not permanently destroyed.
 */
class ShopCouponController extends Controller
{
    /**
     * Retrieves a list of coupons with optional filtering and pagination.
     *
     * @param Request $request Request containing filters (discount_type, applies_to, is_active) and pagination flags.
     * @return JsonResponse Paginated coupon data or a collection.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = ShopCoupon::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('code', 'like', "%$s%")
                ->orWhere('description', 'like', "%$s%"));
        }

        foreach (['discount_type', 'applies_to', 'is_active'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        $query->orderBy($request->input('sort_by', 'id'), $request->input('sort_direction', 'desc'));

        $data = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN) 
            ? $query->get() 
            : $query->paginate($perPage);

        return response()->json($data instanceof \Illuminate\Support\Collection 
            ? ShopCouponResource::collection($data) 
            : [
                'data' => ShopCouponResource::collection($data->items()),
                'total' => $data->total(),
                'per_page' => $data->perPage(),
                'current_page' => $data->currentPage(),
                'last_page' => $data->lastPage(),
            ]);
    }

    /**
     * Persists a new coupon.
     *
     * @param StoreShopCouponRequest $request Validated request.
     * @return JsonResponse Created coupon resource.
     */
    public function store(StoreShopCouponRequest $request): JsonResponse
    {
        try {
            $coupon = ShopCoupon::create($request->validated());
            $this->logAction($request, 'create', 'ShopCoupon', "Created coupon: {$coupon->code}", $coupon->id);
            return response()->json(new ShopCouponResource($coupon), 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error creating coupon.'], 500);
        }
    }

    /**
     * Shows details for a specific coupon (including trashed).
     *
     * @param int $id Coupon ID.
     * @return JsonResponse Coupon resource.
     */
    public function show($id): JsonResponse
    {
        $coupon = ShopCoupon::withTrashed()->findOrFail($id);
        return response()->json(new ShopCouponResource($coupon));
    }

    /**
     * Updates an existing coupon.
     *
     * @param UpdateShopCouponRequest $request Validated request.
     * @param int $id Coupon ID.
     * @return JsonResponse Updated coupon resource.
     */
    public function update(UpdateShopCouponRequest $request, $id): JsonResponse
    {
        try {
            $coupon = ShopCoupon::withTrashed()->findOrFail($id);
            $coupon->update($request->validated());
            $this->logAction($request, 'update', 'ShopCoupon', "Updated coupon: {$coupon->code}", $coupon->id);
            return response()->json(new ShopCouponResource($coupon));
        } catch (\Exception $e) {
            return response()->json(['message' => 'Update failed.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted coupons that are not linked to any existing orders.
     *
     * @param Request $request The incoming request.
     * @return JsonResponse 204 No Content.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashed = ShopCoupon::onlyTrashed()->get();
            
            foreach ($trashed as $coupon) {
                // Prevent deletion if coupon exists in order history
                $isUsedInOrders = ShopOrder::where('coupon_id', $coupon->id)->exists();
                
                if (!$isUsedInOrders) {
                    $coupon->forceDelete();
                }
            }

            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error("ShopCoupon forceDeleteAll error: " . $e->getMessage());
            return response()->json(['message' => 'Error clearing coupon trash.'], 500);
        }
    }

    /**
     * Deletes a coupon (soft or hard).
     *
     * @param Request $request Request parameters.
     * @param int $id Coupon ID.
     * @return JsonResponse 204 No Content.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $force = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
        $item = ShopCoupon::withTrashed()->findOrFail($id);
        $force ? $item->forceDelete() : $item->delete();
        $this->logAction($request, $force ? 'hard_delete' : 'soft_delete', 'ShopCoupon', "Deleted coupon ID: $id", $id);
        return response()->json(null, 204);
    }

    /**
     * Restores a soft-deleted coupon.
     *
     * @param Request $request Request object.
     * @param int $id Coupon ID.
     * @return JsonResponse Restored coupon resource.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $item = ShopCoupon::withTrashed()->findOrFail($id);
        $item->restore();
        $this->logAction($request, 'restore', 'ShopCoupon', "Restored coupon ID: $id", $id);
        return response()->json(new ShopCouponResource($item));
    }

    /**
     * Logs administrative actions to the audit table.
     *
     * @param Request $request Request context.
     * @param string $eventType Operation type.
     * @param string $module Module context.
     * @param string $description Log entry text.
     * @param int|null $affectedId Entity ID.
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
                'affected_entity_type' => 'ShopCoupon',
                'affected_entity_id' => $affectedId,
                'user_id' => $user?->id,
                'context_data' => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_id_plain' => (string)($user?->id ?? '0'),
                'user_plain' => $user ? ($user->full_name ?? $user->user_email) : 'System'
            ]);
        } catch (\Exception $e) { Log::error("Log error: " . $e->getMessage()); }
    }
}