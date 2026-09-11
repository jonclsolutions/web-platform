<?php
/**
 * @file WebSalesOrderController.php
 * @path app/Http/Controllers/Api/Web/WebSalesOrderController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages sales order lifecycle, including integration with sales leads, multiple file attachment handling, and comprehensive audit logging.
 * @refactor-note (2026) store() resolves lead exclusively via unguessable lead_token
 *      (public_token) in a transaction with lockForUpdate(), which atomically prevents double
 *      submission of the same order form.
 * @refactor-note (2026-2) Confirmation email switched to Mail::queue().
 * @refactor-note (2026-08) attachment_path removed, replaced by web_attachments.
 * @refactor-note (2026-08-6) LOGGING MIGRATION to shared LogsActivity trait instead of
 * local duplicate logAction(). Domain-wise unchanged (WebLog::class).
 *
 * @bugfix-note (2026-08-15) CRITICAL FIX (GDPR): store() now explicitly remaps
 * dataProcessingAgreement/tosAgreement to snake_case DB columns BEFORE calling
 * WebSalesOrder::create().
 *
 * @refactor-note (2026-08-23) BULK DELETE IN A SINGLE REQUEST: added bulkDestroy() -
 * see TableBuilderComponent.onBulkDeleteClick() (calls POST web/sales_orders/bulk-delete).
 * INTENTIONALLY replicates THE SAME logic as destroy() (cleanup of attachments from disk via
 * deleteAllAttachments() when force_delete=true), not generic Model::destroy($ids).
 * @note This resource is NOT a good candidate for future bulk import - store() has
 * an atomic binding to lead_token (lockForUpdate transaction consuming a single-use
 * link) and requires explicit GDPR consent (data_processing_agreement/tos_agreement),
 * which cannot be meaningfully "consented to" retroactively for historical imported data.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\{WebSalesOrder, WebSalesLead};
use App\Models\Web\WebLog;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use App\Http\Resources\Web\WebSalesOrderResource;
use App\Http\Requests\Web\WebSalesOrder\{StoreWebSalesOrderRequest, UpdateWebSalesOrderRequest};
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Mail\Web\WebSalesOrderReceived;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * @description Controller responsible for orchestrating sales order processing and tracking.
 * @note Automates sales representative assignment based on linked lead records and manages persistent document storage.
 */
class WebSalesOrderController extends Controller
{
    use HandlesAttachments;
    use LogsActivity;

    /**
     * Storage folder for attachments within public disk.
     */
    private const ATTACHMENT_FOLDER = 'web/sales_orders';

    /**
     * Retrieves a paginated list of sales orders with filtering and eager-loaded lead data.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebSalesOrder::query()->with('lead');
        $query->with(['project:id,order_id']);
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('client_name', 'like', "%$s%")
                ->orWhere('salesman_name', 'like', "%$s%")
                ->orWhere('ico', 'like', "%$s%")
                ->orWhere('client_email', 'like', "%$s%"));
        }
        foreach (['id', 'lead_id', 'ico'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }
        foreach (['client_name', 'salesman_name', 'client_email'] as $f) {
            if ($request->filled($f)) $query->where($f, 'like', '%' . $request->input($f) . '%');
        }

        if ($request->filled('created_at')) $query->whereDate('created_at', $request->created_at);

        $sortBy = $request->input('sort_by', 'id');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, WebLog::class, 'export', 'WebSalesOrder', "Bulk export of sales orders.");
            return WebSalesOrderResource::collection($query->get());
        }

        $data = $query->paginate($perPage);

        return response()->json([
            'data'         => WebSalesOrderResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Stores a new sales order and, if a valid lead token is provided, atomically links it
     * to the corresponding lead while marking that lead's public link as consumed.
     */
    public function store(StoreWebSalesOrderRequest $request): JsonResponse
    {
        $leadToken = $request->input('lead_token');

        try {
            $validated = $request->safe()->except(['attachments', 'lead_id']);

            $validated['data_processing_agreement'] = (bool) ($validated['dataProcessingAgreement'] ?? false);
            $validated['tos_agreement'] = (bool) ($validated['tosAgreement'] ?? false);
            unset($validated['dataProcessingAgreement'], $validated['tosAgreement']);

            if ($leadToken) {
                $order = DB::transaction(function () use ($leadToken, $validated) {
                    $lead = WebSalesLead::where('public_token', $leadToken)
                        ->lockForUpdate()
                        ->first();

                    if (!$lead) {
                        abort(404, 'The link is invalid or has expired.');
                    }

                    if ($lead->public_token_used_at) {
                        abort(410, 'This form has already been submitted once and the link cannot be used again.');
                    }

                    $validated['lead_id'] = $lead->id;
                    $validated['salesman_name'] = $lead->salesman_name;

                    $order = WebSalesOrder::create($validated);

                    $lead->status = 'Inquiry form submitted';
                    $lead->public_token_used_at = now();
                    $lead->save();

                    return $order;
                });
            } else {
                if (empty($validated['salesman_name'])) {
                    $validated['salesman_name'] = 'Web inquiry (without lead)';
                }
                $order = WebSalesOrder::create($validated);
            }

            $this->storeAttachments($request, $order, self::ATTACHMENT_FOLDER);

            $this->logAction($request, WebLog::class, 'create', 'WebSalesOrder', "Created sales order for: {$order->client_name}", $order->id, 'WebSalesOrder');

            try {
                Mail::to($order->client_email)
                    ->queue(new WebSalesOrderReceived($order));
            } catch (\Throwable $e) {
                $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Failed to send confirmation email: " . $e->getMessage(), $order->id, 'WebSalesOrder');
            }

            return response()->json(new WebSalesOrderResource($order->load(['lead', 'attachments'])), 201);
        } catch (HttpException $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Sales order creation rejected (token): " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Error creating sales order: " . $e->getMessage());
            return response()->json(['message' => 'Sales order creation failed.'], 500);
        }
    }

    /**
     * Retrieves detailed information about a specific order, including soft-deleted ones
     * and its attachments.
     */
    public function show($id): JsonResponse
    {
        $sales_order = WebSalesOrder::withTrashed()->with(['lead', 'attachments'])->findOrFail($id);
        return response()->json(new WebSalesOrderResource($sales_order));
    }

    /**
     * Updates an existing order record. Newly uploaded attachments are ADDED to the
     * existing set (not replaced). Consent fields are intentionally untouched here -
     * see bugfix-note in file header.
     */
    public function update(UpdateWebSalesOrderRequest $request, $id): JsonResponse
    {
        try {
            $order = WebSalesOrder::findOrFail($id);
            $validated = $request->safe()->except(['attachments']);

            $order->update($validated);

            $this->storeAttachments($request, $order, self::ATTACHMENT_FOLDER);

            $this->logAction($request, WebLog::class, 'update', 'WebSalesOrder', "Updated sales order ID: {$order->id}", $order->id, 'WebSalesOrder');
            return response()->json(new WebSalesOrderResource($order->fresh()->load(['lead', 'attachments'])));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Error updating sales order ID {$id}: " . $e->getMessage(), (int) $id, 'WebSalesOrder');
            return response()->json(['message' => 'Sales order update failed.'], 500);
        }
    }

    /**
     * Handles soft or hard deletion of an order.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebSalesOrder::withTrashed()->with('attachments')->findOrFail($id);

            if ($forceDelete) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSalesOrder', "Deleted sales order ID: $id", (int) $id, 'WebSalesOrder');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Error deleting sales order ID $id: " . $e->getMessage(), (int) $id, 'WebSalesOrder');
            return response()->json(['message' => 'Sales order deletion failed.'], 500);
        }
    }

    /**
     * @description Bulk deletes selected sales orders in a single request - see
     * TableBuilderComponent.onBulkDeleteClick() (calls POST web/sales_orders/bulk-delete).
     * Replicates THE SAME logic as destroy() (cleanup of attachments from disk on
     * force_delete=true) - not generic Model::destroy($ids), which would silently skip
     * this cleanup and leave orphaned files in storage/app/public/sales_orders.
     * @param Request $request Body contains { ids: number[], force_delete?: boolean }.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids'          => ['required', 'array', 'min:1', 'max:1000'],
            'ids.*'        => ['integer'],
            'force_delete' => ['sometimes', 'boolean'],
        ]);

        $ids = array_values(array_unique(array_map('intval', $validated['ids'])));
        $forceDelete = filter_var($validated['force_delete'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $requestedCount = count($ids);
        $deletedCount = 0;

        try {
            DB::transaction(function () use ($ids, $forceDelete, &$deletedCount) {
                $items = WebSalesOrder::withTrashed()->with('attachments')->whereIn('id', $ids)->get();

                foreach ($items as $item) {
                    if ($forceDelete) {
                        $this->deleteAllAttachments($item);
                        $item->forceDelete();
                    } else {
                        $item->delete();
                    }
                    $deletedCount++;
                }
            });
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Error during bulk deletion of sales orders: " . $e->getMessage());
            return response()->json(['message' => 'Bulk deletion failed.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebSalesOrder',
            'Bulk ' . ($forceDelete ? 'permanent ' : '') . "deletion of {$deletedCount} sales orders (requested {$requestedCount}, IDs: {$idsPreview}).",
            null,
            'WebSalesOrder'
        );

        return response()->json(['data' => [
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]]);
    }

    /**
     * Restores a previously soft-deleted order.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebSalesOrder::withTrashed()->findOrFail($id);
            $item->restore();
            $this->logAction($request, WebLog::class, 'restore', 'WebSalesOrder', "Restored sales order ID: $id", (int) $id, 'WebSalesOrder');
            return response()->json(new WebSalesOrderResource($item->load(['lead', 'attachments'])));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Error restoring sales order ID $id: " . $e->getMessage(), (int) $id, 'WebSalesOrder');
            return response()->json(['message' => 'Sales order restoration failed.'], 500);
        }
    }

    /**
     * Permanently purges all soft-deleted orders and their associated attachment files.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashedOrders = WebSalesOrder::onlyTrashed()->with('attachments')->get();
            $count = $trashedOrders->count();

            foreach ($trashedOrders as $order) {
                $this->deleteAllAttachments($order);
                $order->forceDelete();
            }

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebSalesOrder', "Emptied sales order trash. Count: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Error emptying sales order trash: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }
}