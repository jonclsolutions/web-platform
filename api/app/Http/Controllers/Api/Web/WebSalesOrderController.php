<?php
/**
 * @file WebSalesOrderController.php
 * @path app/Http/Controllers/Api/Web/WebSalesOrderController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages sales order (realizace) lifecycle, including integration with sales leads, file attachment handling, and comprehensive audit logging.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\{WebSalesOrder, WebSalesLead};
use App\Models\Web\WebLog;
use App\Http\Resources\Web\WebSalesOrderResource;
use App\Http\Requests\Web\WebSalesOrder\{StoreWebSalesOrderRequest, UpdateWebSalesOrderRequest};
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\{Log, Storage};

/**
 * @description Controller responsible for orchestrating sales order processing and tracking.
 * @note Automates sales representative assignment based on linked lead records and manages persistent document storage.
 */
class WebSalesOrderController extends Controller
{
    /**
     * Retrieves a paginated list of sales orders with filtering and eager-loaded lead data.
     *
     * @param Request $request
     * @return JsonResponse|mixed Paginated dataset or collection.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebSalesOrder::query()->with('lead');
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        // Fulltext search
        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('client_name', 'like', "%$s%")
                ->orWhere('salesman_name', 'like', "%$s%")
                ->orWhere('ico', 'like', "%$s%")
                ->orWhere('client_email', 'like', "%$s%"));
        }

        // Filtering
        foreach (['id', 'lead_id', 'ico'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }
        
        foreach (['client_name', 'salesman_name', 'client_email'] as $f) {
            if ($request->filled($f)) $query->where($f, 'like', '%' . $request->input($f) . '%');
        }

        if ($request->filled('created_at')) $query->whereDate('created_at', $request->created_at);

        // Sorting
        $sortBy = $request->input('sort_by', 'id');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, 'export', 'WebSalesOrder', "Hromadný export realizací.");
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
     * Stores a new sales order and links it to an existing lead.
     *
     * @param StoreWebSalesOrderRequest $request
     * @return JsonResponse
     * @throws \Exception
     */
    public function store(StoreWebSalesOrderRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();

            if ($request->hasFile('attachment')) {
                $validated['attachment_path'] = $request->file('attachment')->store('orders', 'public');
            }

            if (!empty($validated['lead_id'])) {
                $lead = WebSalesLead::find($validated['lead_id']);
                if ($lead) {
                    $validated['salesman_name'] = $lead->salesman_name;
                    $lead->update(['status' => 'Poptávkový formulář odeslán']);
                }
            }

            if (empty($validated['salesman_name'])) {
                $validated['salesman_name'] = 'Webová poptávka (bez leadu)';
            }

            $order = WebSalesOrder::create($validated);
            
            $this->logAction($request, 'create', 'WebSalesOrder', "Vytvořena realizace pro: {$order->client_name}", $order->id);
            
            return response()->json(new WebSalesOrderResource($order->load('lead')), 201);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesOrder', "Chyba při vytváření realizace: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření realizace selhalo.'], 500);
        }
    }

    /**
     * Retrieves detailed information about a specific order, including soft-deleted ones.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $sales_order = WebSalesOrder::withTrashed()->findOrFail($id);
        $sales_order->load('lead');
        
        return response()->json(new WebSalesOrderResource($sales_order));
    }

    /**
     * Updates an existing order record and replaces associated file attachments.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     * @throws \Exception
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $order = WebSalesOrder::findOrFail($id);
            $data = $request->all();

            if ($request->hasFile('attachment')) {
                if ($order->attachment_path) {
                    Storage::disk('public')->delete($order->attachment_path);
                }
                $data['attachment_path'] = $request->file('attachment')->store('orders', 'public');
            }

            $order->update($data);
            
            $this->logAction($request, 'update', 'WebSalesOrder', "Aktualizace realizace ID: {$order->id}", $order->id);
            
            return response()->json(new WebSalesOrderResource($order->load('lead')));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesOrder', "Chyba při aktualizaci realizace ID {$id}: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Aktualizace realizace selhala.'], 500);
        }
    }

    /**
     * Handles soft or hard deletion of an order, including file cleanup.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebSalesOrder::withTrashed()->findOrFail($id);
            
            if ($forceDelete) {
                if ($item->attachment_path) {
                    Storage::disk('public')->delete($item->attachment_path);
                }
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSalesOrder', "Smazání realizace ID: $id", $id);
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesOrder', "Chyba při mazání realizace ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Smazání realizace selhalo.'], 500);
        }
    }

    /**
     * Restores a previously soft-deleted order.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebSalesOrder::withTrashed()->findOrFail($id);
            $item->restore();
            
            $this->logAction($request, 'restore', 'WebSalesOrder', "Obnova realizace ID: $id", $id);
            
            return response()->json(new WebSalesOrderResource($item->load('lead')));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesOrder', "Chyba při obnově realizace ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Obnova realizace selhala.'], 500);
        }
    }

    /**
     * Permanently purges all soft-deleted orders and their associated files.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashedOrders = WebSalesOrder::onlyTrashed()->get();
            $count = $trashedOrders->count();

            foreach ($trashedOrders as $order) {
                if ($order->attachment_path) {
                    Storage::disk('public')->delete($order->attachment_path);
                }
                $order->forceDelete();
            }

            $this->logAction($request, 'force_delete_all', 'WebSalesOrder', "Hromadné smazání koše realizací. Počet: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesOrder', "Chyba při vysypávání koše realizací: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }

    /**
     * Logs administrative or automated events to the system log.
     *
     * @param Request $request
     * @param string $eventType
     * @param string $module
     * @param string $description
     * @param int|null $affectedId
     * @return void
     */
    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null)
    {
        try {
            $user = $request->user() ?? auth('sanctum')->user();

            WebLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => $description,
                'affected_entity_type' => 'WebSalesOrder',
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => json_encode($request->except(['attachment']), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user ? $user->user_email : 'system/public'
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (WebSalesOrder): " . $e->getMessage());
        }
    }
}