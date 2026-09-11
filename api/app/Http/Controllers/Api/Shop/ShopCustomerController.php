<?php
/**
 * @file ShopCustomerController.php
 * @path app/Http/Controllers/Api/Shop/ShopCustomerController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages CRUD operations for shop customers, including soft-delete lifecycle management, comprehensive audit logging, and bulk trash cleanup.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction() - doménově beze změny (ShopLog::class). Zároveň
 * ODSTRANĚNA ladicí `Log::info()` volání rozeseta po store()/update()/destroy()/
 * restore()/forceDeleteAllTrashed() (payload celého requestu do laravel.log při KAŽDÉM
 * volání) - jde o pozůstatek z debugování, v produkci zbytečně plní log soubor a u
 * zákaznických dat (jméno, e-mail, adresa) navíc zbytečně duplikuje osobní údaje mimo
 * řízený audit trail (`shop_logs`), což je z pohledu GDPR/data minimalizace nežádoucí.
 * `forceDeleteAllTrashed()` dosud neměl žádné auditní volání do `shop_logs` - doplněno.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopCustomer;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopCustomerResource;
use App\Http\Requests\Shop\ShopCustomer\StoreShopCustomerRequest;
use App\Http\Requests\Shop\ShopCustomer\UpdateShopCustomerRequest;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller handling shop customer account administration.
 * @note Implements soft-delete logic to preserve order history integrity while allowing administrative cleanup of inactive accounts.
 */
class ShopCustomerController extends Controller
{
    use LogsActivity;

    /**
     * Retrieves a paginated list of customers with optional search and status filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = ShopCustomer::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) =>
                $q->where('email', 'like', "%$s%")
                  ->orWhere('first_name', 'like', "%$s%")
                  ->orWhere('last_name', 'like', "%$s%")
                  ->orWhere('phone', 'like', "%$s%")
            );
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $sortBy = $request->input('sort_by', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        $data = $noPagination ? $query->get() : $query->paginate($perPage);

        if ($noPagination) {
            return response()->json(ShopCustomerResource::collection($data));
        }

        return response()->json([
            'data' => ShopCustomerResource::collection($data->items()),
            'total' => $data->total(),
            'per_page' => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page' => $data->lastPage(),
        ]);
    }

    /**
     * Creates a new customer account.
     */
    public function store(StoreShopCustomerRequest $request): JsonResponse
    {
        try {
            $customer = ShopCustomer::create($request->validated());

            $this->logAction($request, ShopLog::class, 'create', 'ShopCustomer', "Created customer: {$customer->getFullName()}", $customer->id, 'ShopCustomer');
            return response()->json(new ShopCustomerResource($customer), 201);
        } catch (\Exception $e) {
            Log::error("ShopCustomer creation error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopCustomer', "Customer creation failed: " . $e->getMessage());
            return response()->json(['message' => 'Customer creation failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Retrieves details for a specific customer.
     */
    public function show($id): JsonResponse
    {
        $customer = ShopCustomer::findOrFail($id);
        return response()->json(new ShopCustomerResource($customer));
    }

    /**
     * Updates an existing customer profile.
     */
    public function update(UpdateShopCustomerRequest $request, $id): JsonResponse
    {
        try {
            $customer = ShopCustomer::findOrFail($id);
            $customer->update($request->validated());

            $this->logAction($request, ShopLog::class, 'update', 'ShopCustomer', "Updated customer: {$customer->getFullName()}", $customer->id, 'ShopCustomer');
            return response()->json(new ShopCustomerResource($customer));
        } catch (\Exception $e) {
            Log::error("ShopCustomer update error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopCustomer', "Update failed ID {$id}: " . $e->getMessage(), (int) $id, 'ShopCustomer');
            return response()->json(['message' => 'Update failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Deletes a customer account using soft or hard deletion.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $customer = ShopCustomer::withTrashed()->findOrFail($id);

            $forceDelete ? $customer->forceDelete() : $customer->delete();

            $this->logAction($request, ShopLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'ShopCustomer', "Deleted customer ID: $id", (int) $id, 'ShopCustomer');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error("ShopCustomer delete error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopCustomer', "Deletion failed ID {$id}: " . $e->getMessage(), (int) $id, 'ShopCustomer');
            return response()->json(['message' => 'Deletion failed.'], 500);
        }
    }

    /**
     * Restores a previously soft-deleted customer account.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $customer = ShopCustomer::withTrashed()->findOrFail($id);
            $customer->restore();

            $this->logAction($request, ShopLog::class, 'restore', 'ShopCustomer', "Restored customer ID: $id", (int) $id, 'ShopCustomer');
            return response()->json(new ShopCustomerResource($customer));
        } catch (\Exception $e) {
            Log::error("ShopCustomer restore error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopCustomer', "Restoration failed ID {$id}: " . $e->getMessage(), (int) $id, 'ShopCustomer');
            return response()->json(['message' => 'Restoration failed.'], 500);
        }
    }

    /**
     * Permanently purges all soft-deleted customers.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashedCustomers = ShopCustomer::onlyTrashed()->get();
            $count = $trashedCustomers->count();

            foreach ($trashedCustomers as $customer) {
                $customer->forceDelete();
            }

            $this->logAction($request, ShopLog::class, 'force_delete_all', 'ShopCustomer', "Customer bin cleanup. Count: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error("ShopCustomer force delete all error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopCustomer', "Cleanup failed: " . $e->getMessage());
            return response()->json(['message' => 'Cleanup failed.'], 500);
        }
    }
}