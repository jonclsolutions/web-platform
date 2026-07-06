<?php
/**
 * @file ShopCustomerController.php
 * @path app/Http/Controllers/Api/Shop/ShopCustomerController.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Manages CRUD operations for shop customers, including soft-delete lifecycle management, comprehensive audit logging, and bulk trash cleanup.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopCustomer;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopCustomerResource;
use App\Http\Requests\Shop\ShopCustomer\StoreShopCustomerRequest;
use App\Http\Requests\Shop\ShopCustomer\UpdateShopCustomerRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller handling shop customer account administration.
 * @note Implements soft-delete logic to preserve order history integrity while allowing administrative cleanup of inactive accounts.
 */
class ShopCustomerController extends Controller
{
    /**
     * Retrieves a paginated list of customers with optional search and status filtering.
     *
     * @param Request $request Incoming request with filters (search, is_active) and pagination parameters.
     * @return JsonResponse Paginated data or collection formatted for the frontend.
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
     *
     * @param StoreShopCustomerRequest $request Validated registration data.
     * @return JsonResponse The created resource.
     */
    public function store(StoreShopCustomerRequest $request): JsonResponse
    {
        Log::info("ShopCustomer Store started", ['payload' => $request->all()]);

        try {
            $customer = ShopCustomer::create($request->validated());
            Log::info("Customer created", ['id' => $customer->id]);
            
            $this->logAction($request, 'create', 'ShopCustomer', "Created customer: {$customer->getFullName()}", $customer->id);
            return response()->json(new ShopCustomerResource($customer), 201);
        } catch (\Exception $e) {
            Log::error("ShopCustomer creation error: " . $e->getMessage());
            return response()->json(['message' => 'Customer creation failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Retrieves details for a specific customer.
     *
     * @param int $id The customer ID.
     * @return JsonResponse Customer resource.
     */
    public function show($id): JsonResponse
    {
        $customer = ShopCustomer::findOrFail($id);
        return response()->json(new ShopCustomerResource($customer));
    }

    /**
     * Updates an existing customer profile.
     *
     * @param UpdateShopCustomerRequest $request Validated profile data.
     * @param int $id The customer ID.
     * @return JsonResponse The updated resource.
     */
    public function update(UpdateShopCustomerRequest $request, $id): JsonResponse
    {
        Log::info("ShopCustomer Update started", ['id' => $id, 'payload' => $request->all()]);

        try {
            $customer = ShopCustomer::findOrFail($id);
            $customer->update($request->validated());
            
            Log::info("Customer updated", ['id' => $id]);
            $this->logAction($request, 'update', 'ShopCustomer', "Updated customer: {$customer->getFullName()}", $customer->id);
            return response()->json(new ShopCustomerResource($customer));
        } catch (\Exception $e) {
            Log::error("ShopCustomer update error: " . $e->getMessage());
            return response()->json(['message' => 'Update failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Deletes a customer account using soft or hard deletion.
     *
     * @param Request $request Request containing 'force_delete' flag.
     * @param int $id The customer ID.
     * @return JsonResponse 204 No Content.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $customer = ShopCustomer::withTrashed()->findOrFail($id);

            if ($forceDelete) {
                Log::info("Performing hard delete for customer", ['id' => $id]);
                $customer->forceDelete();
            } else {
                Log::info("Performing soft delete for customer", ['id' => $id]);
                $customer->delete();
            }

            $this->logAction($request, $forceDelete ? 'hard_delete' : 'soft_delete', 'ShopCustomer', "Deleted customer ID: $id", $id);
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error("ShopCustomer delete error: " . $e->getMessage());
            return response()->json(['message' => 'Deletion failed.'], 500);
        }
    }

    /**
     * Restores a previously soft-deleted customer account.
     *
     * @param Request $request The incoming request.
     * @param int $id The customer ID.
     * @return JsonResponse The restored resource.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $customer = ShopCustomer::withTrashed()->findOrFail($id);
            $customer->restore();

            Log::info("Customer restored", ['id' => $id]);
            $this->logAction($request, 'restore', 'ShopCustomer', "Restored customer ID: $id", $id);
            return response()->json(new ShopCustomerResource($customer));
        } catch (\Exception $e) {
            Log::error("ShopCustomer restore error: " . $e->getMessage());
            return response()->json(['message' => 'Restoration failed.'], 500);
        }
    }

    /**
     * Permanently purges all soft-deleted customers.
     *
     * @param Request $request The incoming request.
     * @return JsonResponse 204 No Content.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashedCustomers = ShopCustomer::onlyTrashed()->get();
            $count = $trashedCustomers->count();

            foreach ($trashedCustomers as $customer) {
                $customer->forceDelete();
            }

            Log::info("Trashed customers emptied", ['deleted_count' => $count]);
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error("ShopCustomer force delete all error: " . $e->getMessage());
            return response()->json(['message' => 'Cleanup failed.'], 500);
        }
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
                'affected_entity_type' => 'ShopCustomer',
                'affected_entity_id' => $affectedId,
                'user_id' => $user?->id,
                'context_data' => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_id_plain' => (string)($user?->id ?? '0'),
                'user_plain' => $user ? ($user->full_name ?? $user->user_email) : 'System'
            ]);
        } catch (\Exception $e) {
            Log::error("Log action error: " . $e->getMessage());
        }
    }
}