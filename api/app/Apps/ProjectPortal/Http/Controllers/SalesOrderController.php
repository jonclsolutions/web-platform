<?php
/**
 * @file SalesOrderController.php
 * @path app/Apps/ProjectPortal/Http/Controllers/SalesOrderController.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Orders of the project portal: the public order form (store() with the token of a
 * sales lead), the admin list with attachments and audit log, and the editable confirmation
 * e-mail (emailTemplate() / updateEmailTemplate()).
 *
 * @note This resource is NOT a good candidate for future bulk import - store() has
 * an atomic binding to lead_token (lockForUpdate transaction consuming a single-use
 * link) and requires explicit GDPR consent (data_processing_agreement/tos_agreement),
 * which cannot be meaningfully "consented to" retroactively for historical imported data.
 */

namespace App\Apps\ProjectPortal\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Apps\ProjectPortal\Models\SalesLead;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use App\Apps\ProjectPortal\Http\Resources\SalesOrderResource;
use App\Apps\ProjectPortal\Http\Requests\StoreSalesOrderRequest;
use App\Apps\ProjectPortal\Http\Requests\UpdateSalesOrderRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Apps\ProjectPortal\Mail\SalesOrderReceivedMail;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpKernel\Exception\HttpException;
use App\Traits\AppliesSafeSorting;

/**
 * @description Controller responsible for orchestrating sales order processing and tracking.
 * @note Automates sales representative assignment based on linked lead records and manages persistent document storage.
 */
class SalesOrderController extends Controller
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

        $query = SalesOrder::query()->with('lead');
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
            $this->logAction($request, ProjectPortalLog::class, 'export', 'SalesOrder', "Bulk export of sales orders.");
            return $this->respond(SalesOrderResource::collection($query->get()));
        }

        $data = $query->paginate($perPage);

        return $this->respondPaginated($data, SalesOrderResource::class);
    }

    /**
     * Stores a new sales order and, if a valid lead token is provided, atomically links it
     * to the corresponding lead while marking that lead's public link as consumed.
     */
    public function store(StoreSalesOrderRequest $request): JsonResponse
    {
        $leadToken = $request->input('lead_token');

        try {
            $validated = $request->safe()->except(['attachments', 'lead_id']);

            $validated['data_processing_agreement'] = (bool) ($validated['dataProcessingAgreement'] ?? false);
            $validated['tos_agreement'] = (bool) ($validated['tosAgreement'] ?? false);
            unset($validated['dataProcessingAgreement'], $validated['tosAgreement']);

            if ($leadToken) {
                $order = DB::transaction(function () use ($leadToken, $validated) {
                    $lead = SalesLead::where('public_token', $leadToken)
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

                    $order = SalesOrder::create($validated);

                    $lead->status = 'Inquiry form submitted';
                    $lead->public_token_used_at = now();
                    $lead->save();

                    return $order;
                });
            } else {
                if (empty($validated['salesman_name'])) {
                    $validated['salesman_name'] = 'Order without a lead';
                }
                $order = SalesOrder::create($validated);
            }

            $this->storeAttachments($request, $order, self::ATTACHMENT_FOLDER);

            $this->logAction($request, ProjectPortalLog::class, 'create', 'SalesOrder', "Created sales order for: {$order->client_name}", $order->id, 'SalesOrder');

            try {
                Mail::to($order->client_email)
                    ->queue(new SalesOrderReceivedMail($order));
            } catch (\Throwable $e) {
                report($e); // full detail (class, file, trace) to the core log
                $this->logAction($request, ProjectPortalLog::class, 'error', 'SalesOrder', "Failed to send confirmation email: " . $e->getMessage(), $order->id, 'SalesOrder');
            }

            return $this->respond(new SalesOrderResource($order->load(['lead', 'attachments'])), 201);
        } catch (HttpException $e) {
            $this->logAction($request, ProjectPortalLog::class, 'error', 'SalesOrder', "Sales order creation rejected (token): " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
            // Expired lead link (410 LINK_EXPIRED) - the prepared answer as it is.
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, ProjectPortalLog::class, 'error', 'SalesOrder', 'Sales order creation rejected (token): link expired');
            return $e->getResponse();
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, ProjectPortalLog::class, 'error', 'SalesOrder', "Error creating sales order: " . $e->getMessage());
            return response()->json(['message' => 'Sales order creation failed.'], 500);
        }
    }

    /**
     * Retrieves detailed information about a specific order, including soft-deleted ones
     * and its attachments.
     */
    public function show($id): JsonResponse
    {
        $sales_order = SalesOrder::withTrashed()->with(['lead', 'attachments'])->findOrFail($id);
        return $this->respond(new SalesOrderResource($sales_order));
    }

    /**
     * Updates an existing order record. Newly uploaded attachments are ADDED to the
     * existing set (not replaced). Consent fields are intentionally untouched here (they
     * are recorded once, by the customer, on the public form).
     */
    public function update(UpdateSalesOrderRequest $request, $id): JsonResponse
    {
        $order = SalesOrder::findOrFail($id);

        try {
            $validated = $request->safe()->except(['attachments']);

            $order->update($validated);

            $this->storeAttachments($request, $order, self::ATTACHMENT_FOLDER);

            $this->logAction($request, ProjectPortalLog::class, 'update', 'SalesOrder', "Updated sales order ID: {$order->id}", $order->id, 'SalesOrder');
            return $this->respond(new SalesOrderResource($order->fresh()->load(['lead', 'attachments'])));
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, ProjectPortalLog::class, 'error', 'SalesOrder', "Error updating sales order ID {$id}: " . $e->getMessage(), (int) $id, 'SalesOrder');
            return response()->json(['message' => 'Sales order update failed.'], 500);
        }
    }

    /**
     * Handles soft or hard deletion of an order.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $item = SalesOrder::withTrashed()->with('attachments')->findOrFail($id);

        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);

            if ($forceDelete) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, ProjectPortalLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'SalesOrder', "Deleted sales order ID: $id", (int) $id, 'SalesOrder');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, ProjectPortalLog::class, 'error', 'SalesOrder', "Error deleting sales order ID $id: " . $e->getMessage(), (int) $id, 'SalesOrder');
            return response()->json(['message' => 'Sales order deletion failed.'], 500);
        }
    }

    /**
     * @description Bulk deletes selected sales orders in a single request - see
     * TableBuilderComponent.onBulkDeleteClick() (calls POST project-portal/sales_orders/bulk-delete).
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
                $items = SalesOrder::withTrashed()->with('attachments')->whereIn('id', $ids)->get();

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
            $this->logAction($request, ProjectPortalLog::class, 'error', 'SalesOrder', "Error during bulk deletion of sales orders: " . $e->getMessage());
            return response()->json(['message' => 'Bulk deletion failed.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            ProjectPortalLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'SalesOrder',
            'Bulk ' . ($forceDelete ? 'permanent ' : '') . "deletion of {$deletedCount} sales orders (requested {$requestedCount}, IDs: {$idsPreview}).",
            null,
            'SalesOrder'
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
        $item = SalesOrder::withTrashed()->findOrFail($id);

        try {
            $item->restore();
            $this->logAction($request, ProjectPortalLog::class, 'restore', 'SalesOrder', "Restored sales order ID: $id", (int) $id, 'SalesOrder');
            return $this->respond(new SalesOrderResource($item->load(['lead', 'attachments'])));
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, ProjectPortalLog::class, 'error', 'SalesOrder', "Error restoring sales order ID $id: " . $e->getMessage(), (int) $id, 'SalesOrder');
            return response()->json(['message' => 'Sales order restoration failed.'], 500);
        }
    }

    /**
     * Permanently purges all soft-deleted orders and their associated attachment files.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashedOrders = SalesOrder::onlyTrashed()->with('attachments')->get();
            $count = $trashedOrders->count();

            foreach ($trashedOrders as $order) {
                $this->deleteAllAttachments($order);
                $order->forceDelete();
            }

            $this->logAction($request, ProjectPortalLog::class, 'force_delete_all', 'SalesOrder', "Emptied sales order trash. Count: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, ProjectPortalLog::class, 'error', 'SalesOrder', "Error emptying sales order trash: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }

    /**
     * @description Editable confirmation e-mail of an order (VT-15) - subject / title / intro /
     *   outro / labels, each an i18n object keyed by language code.
     * @return JsonResponse { data: { sales_order_email_*_i18n } }
     */
    public function emailTemplate(): JsonResponse
    {
        return $this->respond(ProjectPortalSetting::current()->only(ProjectPortalSetting::SALES_ORDER_TEMPLATE_FIELDS));
    }

    /**
     * @description Saves the editable confirmation e-mail of an order (only the permission of the
     *   route, no password confirmation - texts only).
     * @param Request $request { sales_order_email_*_i18n }.
     * @return JsonResponse { data: { sales_order_email_*_i18n } }
     */
    public function updateEmailTemplate(Request $request): JsonResponse
    {
        $validated = $request->validate(array_fill_keys(ProjectPortalSetting::SALES_ORDER_TEMPLATE_FIELDS, 'sometimes|nullable|array'));

        $settings = ProjectPortalSetting::current();
        $settings->fill($validated)->save();

        $this->logAction($request, ProjectPortalLog::class, 'update', 'ProjectPortalSetting', 'Updated confirmation email template (orders).', $settings->id, 'ProjectPortalSetting');

        return $this->respond($settings->only(ProjectPortalSetting::SALES_ORDER_TEMPLATE_FIELDS));
    }
}
