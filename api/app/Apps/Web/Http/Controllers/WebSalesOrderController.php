<?php
/**
 * @file WebSalesOrderController.php
 * @path app/Apps/Web/Http/Controllers/WebSalesOrderController.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages sales order lifecycle, including integration with sales leads, multiple file attachment handling, and comprehensive audit logging.
 *
 * @note This resource is NOT a good candidate for future bulk import - store() has
 * an atomic binding to lead_token (lockForUpdate transaction consuming a single-use
 * link) and requires explicit GDPR consent (data_processing_agreement/tos_agreement),
 * which cannot be meaningfully "consented to" retroactively for historical imported data.
 */

namespace App\Apps\Web\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\Web\Models\WebSalesOrder;
use App\Apps\Web\Models\WebSalesLead;
use App\Apps\Web\Models\WebLog;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use App\Apps\Web\Http\Resources\WebSalesOrderResource;
use App\Apps\Web\Http\Requests\WebSalesOrder\StoreWebSalesOrderRequest;
use App\Apps\Web\Http\Requests\WebSalesOrder\UpdateWebSalesOrderRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Apps\Web\Mail\WebSalesOrderReceived;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpKernel\Exception\HttpException;
use App\Traits\AppliesSafeSorting;

/**
 * @description Controller responsible for orchestrating sales order processing and tracking.
 * @note Automates sales representative assignment based on linked lead records and manages persistent document storage.
 */
class WebSalesOrderController extends Controller
{
    use HandlesAttachments, AppliesSafeSorting;
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

        $this->applySorting($query, $request, 'id', 'desc');

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, WebLog::class, 'export', 'WebSalesOrder', "Bulk export of sales orders.");
            return $this->respond(WebSalesOrderResource::collection($query->get()));
        }

        $data = $query->paginate($perPage);

        return $this->respondPaginated($data, WebSalesOrderResource::class);
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

                    if ($lead->publicTokenExpired()) {
                        throw new \Illuminate\Http\Exceptions\HttpResponseException(
                            response()->json(['message' => 'The link has expired.', 'error_code' => 'LINK_EXPIRED'], 410)
                        );
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
                report($e); // full detail (class, file, trace) to the core log
                $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Failed to send confirmation email: " . $e->getMessage(), $order->id, 'WebSalesOrder');
            }

            return $this->respond(new WebSalesOrderResource($order->load(['lead', 'attachments'])), 201);
        } catch (HttpException $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Sales order creation rejected (token): " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
            // Expired lead link (410 LINK_EXPIRED) - the prepared answer as it is.
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', 'Sales order creation rejected (token): link expired');
            return $e->getResponse();
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
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
        return $this->respond(new WebSalesOrderResource($sales_order));
    }

    /**
     * Updates an existing order record. Newly uploaded attachments are ADDED to the
     * existing set (not replaced). Consent fields are intentionally untouched here (they
     * are recorded once, by the customer, on the public form).
     */
    public function update(UpdateWebSalesOrderRequest $request, $id): JsonResponse
    {
        $order = WebSalesOrder::findOrFail($id);

        try {
            $validated = $request->safe()->except(['attachments']);

            $order->update($validated);

            $this->storeAttachments($request, $order, self::ATTACHMENT_FOLDER);

            $this->logAction($request, WebLog::class, 'update', 'WebSalesOrder', "Updated sales order ID: {$order->id}", $order->id, 'WebSalesOrder');
            return $this->respond(new WebSalesOrderResource($order->fresh()->load(['lead', 'attachments'])));
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Error updating sales order ID {$id}: " . $e->getMessage(), (int) $id, 'WebSalesOrder');
            return response()->json(['message' => 'Sales order update failed.'], 500);
        }
    }

    /**
     * Handles soft or hard deletion of an order.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $item = WebSalesOrder::withTrashed()->with('attachments')->findOrFail($id);

        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);

            if ($forceDelete) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSalesOrder', "Deleted sales order ID: $id", (int) $id, 'WebSalesOrder');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
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
            report($e); // full detail (class, file, trace) to the core log
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

        return $this->respond([
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]);
    }

    /**
     * Restores a previously soft-deleted order.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $item = WebSalesOrder::withTrashed()->findOrFail($id);

        try {
            $item->restore();
            $this->logAction($request, WebLog::class, 'restore', 'WebSalesOrder', "Restored sales order ID: $id", (int) $id, 'WebSalesOrder');
            return $this->respond(new WebSalesOrderResource($item->load(['lead', 'attachments'])));
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
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
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Error emptying sales order trash: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }
}