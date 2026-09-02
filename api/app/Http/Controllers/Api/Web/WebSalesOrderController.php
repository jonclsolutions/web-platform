<?php
/**
 * @file WebSalesOrderController.php
 * @path app/Http/Controllers/Api/Web/WebSalesOrderController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages sales order (realizace) lifecycle, including integration with sales leads, multiple file attachment handling, and comprehensive audit logging.
 * @refactor-note (2026) store() resolvuje lead vyhradne pres neuhodnutelny lead_token
 *      (public_token) v transakci s lockForUpdate(), coz atomicky brani dvojimu
 *      odeslani stejneho objednavkoveho formulare.
 * @refactor-note (2026-2) Potvrzovaci e-mail prepnut na Mail::queue().
 * @refactor-note (2026-08) attachment_path odstraneno, nahrazeno web_attachments.
 * @refactor-note (2026-08-6) MIGRACE LOGOVANI na sdileny LogsActivity trait misto
 * lokalni duplicitni logAction(). Domenove beze zmeny (WebLog::class).
 *
 * @bugfix-note (2026-08-15) KRITICKA OPRAVA (GDPR): store() ted explicitne premapuje
 * dataProcessingAgreement/tosAgreement na snake_case DB sloupce PRED volanim
 * WebSalesOrder::create().
 *
 * @refactor-note (2026-08-23) HROMADNE MAZANI V JEDNOM REQUESTU: pridana bulkDestroy() -
 * viz TableBuilderComponent.onBulkDeleteClick() (vola POST web/sales_orders/bulk-delete).
 * ZAMERNE replikuje STEJNOU logiku jako destroy() (uklid priloh z disku pres
 * deleteAllAttachments() pri force_delete=true), ne genericky Model::destroy($ids).
 * @note Tenhle resource NENI dobry kandidat na budouci hromadny import - store() ma
 * atomickou vazbu na lead_token (lockForUpdate transakce spotrebovavajici jednorazovy
 * odkaz) a vyzaduje explicitni GDPR souhlas (data_processing_agreement/tos_agreement),
 * ktery nelze smysluplne "odsouhlasit" retroaktivne za historicka importovana data.
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
            $this->logAction($request, WebLog::class, 'export', 'WebSalesOrder', "Hromadný export realizací.");
            $data = $query->get();
            return WebSalesOrderResource::collection($data);
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
                        abort(404, 'Odkaz je neplatný nebo již expiroval.');
                    }

                    if ($lead->public_token_used_at) {
                        abort(410, 'Tento formulář již byl jednou odeslán a odkaz není možné použít znovu.');
                    }

                    $validated['lead_id'] = $lead->id;
                    $validated['salesman_name'] = $lead->salesman_name;

                    $order = WebSalesOrder::create($validated);

                    $lead->status = 'Poptávkový formulář odeslán';
                    $lead->public_token_used_at = now();
                    $lead->save();

                    return $order;
                });
            } else {
                if (empty($validated['salesman_name'])) {
                    $validated['salesman_name'] = 'Webová poptávka (bez leadu)';
                }
                $order = WebSalesOrder::create($validated);
            }

            $this->storeAttachments($request, $order, self::ATTACHMENT_FOLDER);

            $this->logAction($request, WebLog::class, 'create', 'WebSalesOrder', "Vytvořena realizace pro: {$order->client_name}", $order->id, 'WebSalesOrder');

            try {
                Mail::to($order->client_email)
                    ->queue(new WebSalesOrderReceived($order));
            } catch (\Throwable $e) {
                $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Nepodařilo se odeslat potvrzovací e-mail: " . $e->getMessage(), $order->id, 'WebSalesOrder');
            }

            return response()->json(new WebSalesOrderResource($order->load(['lead', 'attachments'])), 201);
        } catch (HttpException $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Odmítnuto vytvoření realizace (token): " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Chyba při vytváření realizace: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření realizace selhalo.'], 500);
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

            $this->logAction($request, WebLog::class, 'update', 'WebSalesOrder', "Aktualizace realizace ID: {$order->id}", $order->id, 'WebSalesOrder');
            return response()->json(new WebSalesOrderResource($order->fresh()->load(['lead', 'attachments'])));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Chyba při aktualizaci realizace ID {$id}: " . $e->getMessage(), (int) $id, 'WebSalesOrder');
            return response()->json(['message' => 'Aktualizace realizace selhala.'], 500);
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

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSalesOrder', "Smazání realizace ID: $id", (int) $id, 'WebSalesOrder');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Chyba při mazání realizace ID $id: " . $e->getMessage(), (int) $id, 'WebSalesOrder');
            return response()->json(['message' => 'Smazání realizace selhalo.'], 500);
        }
    }

    /**
     * @description Hromadně smaže vybrané realizace JEDNÍM requestem - viz
     * TableBuilderComponent.onBulkDeleteClick() (volá POST web/sales_orders/bulk-delete).
     * Replikuje STEJNOU logiku jako destroy() (úklid příloh z disku při
     * force_delete=true) - ne generický Model::destroy($ids), který by tenhle úklid
     * potichu přeskočil a nechal osiřelé soubory ve storage/app/public/sales_orders.
     * @param Request $request Tělo obsahuje { ids: number[], force_delete?: boolean }.
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
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Chyba při hromadném mazání realizací: " . $e->getMessage());
            return response()->json(['message' => 'Hromadné mazání selhalo.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebSalesOrder',
            'Hromadné ' . ($forceDelete ? 'trvalé ' : '') . "smazání {$deletedCount} realizací (požadováno {$requestedCount}, ID: {$idsPreview}).",
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
            $this->logAction($request, WebLog::class, 'restore', 'WebSalesOrder', "Obnova realizace ID: $id", (int) $id, 'WebSalesOrder');
            return response()->json(new WebSalesOrderResource($item->load(['lead', 'attachments'])));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Chyba při obnově realizace ID $id: " . $e->getMessage(), (int) $id, 'WebSalesOrder');
            return response()->json(['message' => 'Obnova realizace selhala.'], 500);
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

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebSalesOrder', "Hromadné smazání koše realizací. Počet: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesOrder', "Chyba při vysypávání koše realizací: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }
}