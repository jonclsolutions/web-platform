<?php
/**
 * @file WebSalesOrderController.php
 * @path app/Http/Controllers/Api/Web/WebSalesOrderController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages sales order (realizace) lifecycle, including integration with sales leads, multiple file attachment handling, and comprehensive audit logging.
 * @refactor-note (2026) `store()` přepsán tak, aby lead nikdy nebral z klientem poslaného
 *      `lead_id` (veřejný endpoint - kdokoliv mohl uhodnutím čísla přiřadit objednávku
 *      k cizímu leadu / spustit e-mail cizímu obchodníkovi). Lead se teď resolvuje
 *      výhradně přes neuhodnutelný `lead_token` (public_token) v transakci s
 *      `lockForUpdate()`, což zároveň atomicky brání dvojímu odeslání stejného
 *      objednávkového formuláře (viz `public_token_used_at`).
 * @refactor-note (2026-2) Potvrzovací e-mail přepnut z Mail::send() na Mail::queue() -
 *      na 'sync' driveru beze změny chování, na reálné frontě (redis/database) se pošle
 *      na pozadí, takže request nečeká na SMTP handshake. Endpoint `sales_orders` v
 *      routes/api.php zároveň doplněn o throttle:10,1 (chybějící rate limit u veřejného
 *      endpointu, co posílá e-mail na libovolnou adresu ze vstupu - riziko zneužití k
 *      emailovému bombardování).
 * @refactor-note (2026-08) Jednosouborové pole `attachment_path` KOMPLETNĚ ODSTRANĚNO
 *      (sloupec smazán z DB) - nahrazeno polymorfním `web_attachments` vztahem přes
 *      `HandlesAttachments` trait, podporujícím až 10 příloh na jednu realizaci.
 *      `store()`/`update()`/`destroy()`/`forceDeleteAllTrashed()` upraveny tak, aby už
 *      nikde neodkazovaly na neexistující `attachment_path` sloupec. `update()` navíc
 *      přepsán z `$request->all()` (žádná validace, mass-assignment riziko) na
 *      `UpdateWebSalesOrderRequest` - viz jeho vlastní úprava, potřebná analogicky k
 *      StoreWebSalesOrderRequest.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\{WebSalesOrder, WebSalesLead};
use App\Models\Web\WebLog;
use App\Traits\HandlesAttachments;
use App\Http\Resources\Web\WebSalesOrderResource;
use App\Http\Requests\Web\WebSalesOrder\{StoreWebSalesOrderRequest, UpdateWebSalesOrderRequest};
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\{Log, DB};
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

    /**
     * Storage folder for attachments within public disk.
     */
    private const ATTACHMENT_FOLDER = 'sales_orders';

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
     * Stores a new sales order and, if a valid lead token is provided, atomically links it
     * to the corresponding lead while marking that lead's public link as consumed.
     * Handles up to 10 file attachments (see HandlesAttachments trait).
     *
     * @param StoreWebSalesOrderRequest $request
     * @return JsonResponse
     * @note `lead_id` z `$validated` je vždy zahozeno - endpoint je veřejný (bez auth),
     *       takže klientem poslané `lead_id` nelze nikdy důvěřovat (IDOR - kdokoliv by si
     *       mohl objednávku "podvrhnout" k libovolnému cizímu leadu jen uhodnutím čísla).
     *       Jediná důvěryhodná cesta k napojení na lead je `lead_token`, který zná jen ten,
     *       kdo dostal skutečný odkaz (viz WebSalesLeadController::generateLink/showByToken).
     * @note Přílohy se ukládají AŽ PO úspěšném commitnutí DB transakce (má smysl - soubory
     *       na disk nejsou součástí transakce a nemá cenu je řešit uvnitř lockForUpdate()
     *       bloku). Pokud by transakce spadla (neplatný/použitý token), žádný soubor se
     *       vůbec nezkusí uložit.
     */
    public function store(StoreWebSalesOrderRequest $request): JsonResponse
    {
        $leadToken = $request->input('lead_token');

        try {
            $validated = $request->safe()->except(['attachments', 'lead_id']);

            if ($leadToken) {
                // Lead resolvován + objednávka vytvořena + token invalidován v JEDNÉ
                // transakci s lockForUpdate() - dvě souběžná odeslání stejného odkazu
                // (např. dvě otevřené karty) tak nemohou obě projít kontrolou zároveň.
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

                    // Přímé přiřazení + save() místo update() - 'public_token_used_at'
                    // (a 'public_token') NEJSOU v $fillable u WebSalesLead (a záměrně
                    // nemají být, ať je nejde nastavit hromadným přiřazením zvenčí).
                    // update(['public_token_used_at' => ...]) by tohle pole tiše
                    // zahodilo bez chyby - přímé přiřazení vlastnosti fillable obchází.
                    $lead->status = 'Poptávkový formulář odeslán';
                    $lead->public_token_used_at = now();
                    $lead->save();

                    return $order;
                });
            } else {
                // Obecná poptávka bez navázání na konkrétní lead (např. přímý formulář
                // na webu mimo obchodní proces) - chování zachováno jako dřív.
                if (empty($validated['salesman_name'])) {
                    $validated['salesman_name'] = 'Webová poptávka (bez leadu)';
                }
                $order = WebSalesOrder::create($validated);
            }

            $this->storeAttachments($request, $order, self::ATTACHMENT_FOLDER);

            $this->logAction($request, 'create', 'WebSalesOrder', "Vytvořena realizace pro: {$order->client_name}", $order->id);

            try {
                // queue() místo send(): na 'sync' driveru (Laravel default) se chová
                // identicky jako send() - synchronně, chyby dál zachytí tento catch.
                // Na reálném queue driveru (redis/database) se e-mail odešle na pozadí -
                // request se nečeká na (často pomalý/nedostupný) SMTP handshake.
                Mail::to($order->client_email)
                    ->queue(new WebSalesOrderReceived($order));
            } catch (\Throwable $e) {
                $this->logAction($request, 'error', 'WebSalesOrder', "Nepodařilo se odeslat potvrzovací e-mail: " . $e->getMessage(), $order->id);
            }

            return response()->json(new WebSalesOrderResource($order->load(['lead', 'attachments'])), 201);
        } catch (HttpException $e) {
            // 404/410 z abort() výše (neplatný nebo už použitý token) - srozumitelná
            // zpráva pro klienta, ne obecné 500.
            $this->logAction($request, 'error', 'WebSalesOrder', "Odmítnuto vytvoření realizace (token): " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesOrder', "Chyba při vytváření realizace: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření realizace selhalo.'], 500);
        }
    }

    /**
     * Retrieves detailed information about a specific order, including soft-deleted ones
     * and its attachments.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $sales_order = WebSalesOrder::withTrashed()->with(['lead', 'attachments'])->findOrFail($id);
        return response()->json(new WebSalesOrderResource($sales_order));
    }

    /**
     * Updates an existing order record. Newly uploaded attachments are ADDED to the
     * existing set (not replaced) - admin can remove individual old attachments via a
     * separate endpoint (part 2 of this task).
     *
     * @param UpdateWebSalesOrderRequest $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(UpdateWebSalesOrderRequest $request, $id): JsonResponse
    {
        try {
            $order = WebSalesOrder::findOrFail($id);
            $validated = $request->safe()->except(['attachments']);

            $order->update($validated);

            $this->storeAttachments($request, $order, self::ATTACHMENT_FOLDER);

            $this->logAction($request, 'update', 'WebSalesOrder', "Aktualizace realizace ID: {$order->id}", $order->id);
            return response()->json(new WebSalesOrderResource($order->fresh()->load(['lead', 'attachments'])));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesOrder', "Chyba při aktualizaci realizace ID {$id}: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Aktualizace realizace selhala.'], 500);
        }
    }

    /**
     * Handles soft or hard deletion of an order. On hard delete, all associated attachment
     * files and their DB records are removed too (see HandlesAttachments::deleteAllAttachments()).
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
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
            return response()->json(new WebSalesOrderResource($item->load(['lead', 'attachments'])));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesOrder', "Chyba při obnově realizace ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Obnova realizace selhala.'], 500);
        }
    }

    /**
     * Permanently purges all soft-deleted orders and their associated attachment files.
     *
     * @param Request $request
     * @return JsonResponse
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
                'context_data'         => json_encode($request->except(['attachments']), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user ? $user->user_email : 'system/public'
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (WebSalesOrder): " . $e->getMessage());
        }
    }
}