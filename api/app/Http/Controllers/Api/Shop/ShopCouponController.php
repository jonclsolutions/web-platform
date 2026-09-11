<?php
/**
 * @file ShopCouponController.php
 * @path app/Http/Controllers/Api/Shop/ShopCouponController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Handles CRUD operations for promotional coupons, including soft-delete functionality, restore capabilities, and integrity-checked batch cleanup.
 *
 * @refactor-note (2026-08-6) LOGGING MIGRATION to shared `LogsActivity` trait instead of
 * local duplicate logAction(). Domain-wise unchanged (ShopLog::class). `forceDeleteAllTrashed()`
 * previously had no audit call - added so that bulk coupon deletion from trash
 * is trackable just like other Shop resources.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopCoupon;
use App\Models\Shop\ShopLog;
use App\Models\Shop\ShopOrder;
use App\Http\Resources\Shop\ShopCouponResource;
use App\Http\Requests\Shop\ShopCoupon\StoreShopCouponRequest;
use App\Http\Requests\Shop\ShopCoupon\UpdateShopCouponRequest;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller responsible for managing shop coupon lifecycle and audit logs.
 * @note Features specific cleanup logic to ensure coupons linked to existing order history are not permanently destroyed.
 */
class ShopCouponController extends Controller
{
    use LogsActivity;

    /**
     * Retrieves a list of coupons with optional filtering and pagination.
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
     */
    public function store(StoreShopCouponRequest $request): JsonResponse
    {
        try {
            $coupon = ShopCoupon::create($request->validated());
            $this->logAction($request, ShopLog::class, 'create', 'ShopCoupon', "Created coupon: {$coupon->code}", $coupon->id, 'ShopCoupon');
            return response()->json(new ShopCouponResource($coupon), 201);
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopCoupon', "Error creating coupon: " . $e->getMessage());
            return response()->json(['message' => 'Error creating coupon.'], 500);
        }
    }

    /**
     * Shows details for a specific coupon (including trashed).
     */
    public function show($id): JsonResponse
    {
        $coupon = ShopCoupon::withTrashed()->findOrFail($id);
        return response()->json(new ShopCouponResource($coupon));
    }

    /**
     * Updates an existing coupon.
     */
    public function update(UpdateShopCouponRequest $request, $id): JsonResponse
    {
        try {
            $coupon = ShopCoupon::withTrashed()->findOrFail($id);
            $coupon->update($request->validated());
            $this->logAction($request, ShopLog::class, 'update', 'ShopCoupon', "Updated coupon: {$coupon->code}", $coupon->id, 'ShopCoupon');
            return response()->json(new ShopCouponResource($coupon));
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopCoupon', "Update failed ID {$id}: " . $e->getMessage(), (int) $id, 'ShopCoupon');
            return response()->json(['message' => 'Update failed.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted coupons that are not linked to any existing orders.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashed = ShopCoupon::onlyTrashed()->get();
            $deletedCount = 0;

            foreach ($trashed as $coupon) {
                $isUsedInOrders = ShopOrder::where('coupon_id', $coupon->id)->exists();

                if (!$isUsedInOrders) {
                    $coupon->forceDelete();
                    $deletedCount++;
                }
            }

            $this->logAction($request, ShopLog::class, 'force_delete_all', 'ShopCoupon', "Emptied coupon trash. Permanently deleted: {$deletedCount} out of " . $trashed->count() . " (the rest are linked to existing orders).");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error("ShopCoupon forceDeleteAll error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopCoupon', "Error clearing coupon trash: " . $e->getMessage());
            return response()->json(['message' => 'Error clearing coupon trash.'], 500);
        }
    }

    /**
     * Deletes a coupon (soft or hard).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $force = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
        $item = ShopCoupon::withTrashed()->findOrFail($id);
        $force ? $item->forceDelete() : $item->delete();
        $this->logAction($request, ShopLog::class, $force ? 'hard_delete' : 'soft_delete', 'ShopCoupon', "Deleted coupon ID: $id", (int) $id, 'ShopCoupon');
        return response()->json(null, 204);
    }

    /**
     * Restores a soft-deleted coupon.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $item = ShopCoupon::withTrashed()->findOrFail($id);
        $item->restore();
        $this->logAction($request, ShopLog::class, 'restore', 'ShopCoupon', "Restored coupon ID: $id", (int) $id, 'ShopCoupon');
        return response()->json(new ShopCouponResource($item));
    }
}