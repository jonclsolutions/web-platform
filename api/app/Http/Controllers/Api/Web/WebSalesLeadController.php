<?php
/**
 * @file WebSalesLeadController.php
 * @path app/Http/Controllers/Api/Web/WebSalesLeadController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Controller responsible for managing sales lead lifecycle, including filtering, lifecycle state management (soft-delete), and comprehensive administrative audit logging.
 * @refactor-note (2026) Přidány `generateLink()` (admin - vygeneruje/vrátí public_token pro
 *      sdílení odkazu na objednávkový formulář) a `showByToken()` (VEŘEJNÁ metoda bez auth -
 *      pro OrderFormComponent na frontendu). `showByToken()` záměrně nevrací plný
 *      WebSalesLeadResource (ten obsahuje interní CRM pole jako `salesman_name`, `status`,
 *      `priority`, `rejection_reason`, `next_step` - to vše je neveřejné), ale jen úzkou
 *      podmnožinu polí, která zákazník na objednávkovém formuláři reálně potřebuje.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebSalesLead;
use App\Models\Web\WebLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use App\Http\Requests\Web\WebSalesLead\StoreWebSalesLeadRequest;
use App\Http\Resources\Web\WebSalesLeadResource;

/**
 * @description Manages sales lead data operations within the CRM subsystem.
 * @note Implements logging for all data mutations and export operations to ensure accountability.
 */
class WebSalesLeadController extends Controller
{
    /**
     * Retrieves a list of sales leads based on filtering and pagination criteria.
     *
     * @param Request $request Filter parameters (search, status, priority, channel, dates) and sorting settings.
     * @return JsonResponse Paginated data or full collection on export.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebSalesLead::query();
        
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        // Fulltext Search
        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('subject_name', 'like', "%$s%")
                ->orWhere('contact_person', 'like', "%$s%")
                ->orWhere('contact_email', 'like', "%$s%")
                ->orWhere('description', 'like', "%$s%"));
        }

        // Exact match filters
        foreach (['id', 'status', 'priority', 'source_channel'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        // Partial match filters
        foreach (['subject_name', 'contact_person', 'contact_email', 'contact_phone', 'location', 'salesman_name'] as $f) {
            if ($request->filled($f)) $query->where($f, 'like', '%' . $request->input($f) . '%');
        }

        if ($request->filled('created_at')) $query->whereDate('created_at', $request->created_at);
        if ($request->filled('last_contact_date')) $query->whereDate('last_contact_date', $request->last_contact_date);

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortDirection = in_array(strtolower($request->input('sort_direction')), ['asc', 'desc']) 
            ? $request->input('sort_direction') 
            : 'desc';
        
        $query->orderBy($sortBy, $sortDirection);

        // Execution
        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        
        if ($noPagination) {
            $this->logAction($request, 'export', 'WebSalesLead', "Hromadný export obchodních leadů.");
            $data = $query->get();
            return response()->json(WebSalesLeadResource::collection($data));
        }

        $data = $query->paginate($perPage);

        return response()->json([
            'data'         => WebSalesLeadResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Persists a new sales lead, assigning default owner data if available.
     *
     * @param StoreWebSalesLeadRequest $request Validated input.
     * @return JsonResponse Created lead resource.
     * @throws \Exception On database failure.
     */
    public function store(StoreWebSalesLeadRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $user = $request->user() ?? auth('sanctum')->user();

            if (empty($validated['salesman_name']) && $user) {
                $validated['salesman_name'] = $user->full_name ?? $user->user_email;
            }

            if (empty($validated['user_id']) && $user) {
                $validated['user_id'] = $user->id;
            }

            $lead = WebSalesLead::create($validated);
            
            $this->logAction($request, 'create', 'WebSalesLead', "Vytvořen nový lead: {$lead->subject_name}", $lead->id);
            
            return response()->json(new WebSalesLeadResource($lead), 201);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesLead', "Chyba při vytváření leadu: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření leadu selhalo.'], 500);
        }
    }

    /**
     * Retrieves the details of a single lead.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $lead = WebSalesLead::withTrashed()->findOrFail($id);
        return response()->json(new WebSalesLeadResource($lead));
    }

    /**
     * Updates an existing sales lead record.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $lead = WebSalesLead::findOrFail($id);
            $lead->update($request->all());
            
            $this->logAction($request, 'update', 'WebSalesLead', "Aktualizace leadu ID: {$lead->id} ({$lead->subject_name})", $lead->id);
            
            return response()->json(new WebSalesLeadResource($lead));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesLead', "Chyba při aktualizaci leadu ID {$id}: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Aktualizace leadu selhala.'], 500);
        }
    }

    /**
     * Deletes a lead (Soft or Hard).
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebSalesLead::withTrashed()->findOrFail($id);
            
            $forceDelete ? $item->forceDelete() : $item->delete();
            
            $this->logAction($request, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSalesLead', "Smazání leadu ID: $id", $id);

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesLead', "Chyba při mazání leadu ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Smazání leadu selhalo.'], 500);
        }
    }

    /**
     * Restores a soft-deleted lead.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebSalesLead::withTrashed()->findOrFail($id);
            $item->restore();
            
            $this->logAction($request, 'restore', 'WebSalesLead', "Obnova leadu ID: $id", $id);
            
            return response()->json(new WebSalesLeadResource($item));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesLead', "Chyba při obnově leadu ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Obnova leadu selhala.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted records.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $count = WebSalesLead::onlyTrashed()->count();
            WebSalesLead::onlyTrashed()->forceDelete();
            
            $this->logAction($request, 'force_delete_all', 'WebSalesLead', "Hromadné smazání koše leadů. Počet: $count");
            
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesLead', "Chyba při vyprazdňování koše leadů: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }

    /**
     * @description Vygeneruje (nebo vrátí existující) public_token pro daný lead a sestaví
     *              z něj plnou veřejnou URL na objednávkový formulář.
     * @param Request $request
     * @param int $id
     * @return JsonResponse {"token": "...", "url": "https://.../order_form/{token}"}
     * @note ADMIN endpoint - musí zůstat za AuthGuard/Sanctum middlewarem v routes/api.php,
     *       stejně jako ostatní metody tohoto controlleru. Nikdy nevolat veřejně.
     */
    public function generateLink(Request $request, $id): JsonResponse
    {
        try {
            $lead = WebSalesLead::findOrFail($id);
            $token = $lead->getOrCreatePublicToken();

            $this->logAction($request, 'generate_link', 'WebSalesLead', "Vygenerován odkaz na objednávkový formulář pro lead ID: {$lead->id}", $lead->id);

            return response()->json([
                'data' => [
                    'token' => $token,
                    'url'   => rtrim(config('app.frontend_url', $request->getSchemeAndHttpHost()), '/') . "/order_form/{$token}",
                ],
            ]);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSalesLead', "Chyba při generování odkazu pro lead ID {$id}: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Vygenerování odkazu selhalo.'], 500);
        }
    }

    /**
     * @description VEŘEJNÁ metoda (bez auth) pro načtení leadu podle public_token -
     *              slouží OrderFormComponent na frontendu k předvyplnění objednávkového
     *              formuláře. Vrací jen úzkou, bezpečnou podmnožinu polí (žádná interní
     *              CRM data jako stav, priorita, obchodník, poznámky).
     * @param string $token Public token z URL (/order_form/{token}).
     * @return JsonResponse
     * @note Musí být zaregistrována v routes/api.php MIMO auth middleware skupinu,
     *       viz Route::get('/public/sales-leads/{token}', ...) níže.
     * @note Vrací 410 Gone, pokud byl odkaz už jednou použit (public_token_used_at není
     *       null) - samotné zobrazení formuláře tedy zákazníkovi rovnou řekne, že odkaz
     *       už není platný, aniž by musel formulář vůbec vyplňovat. Skutečnou (atomickou)
     *       ochranu proti dvojímu odeslání ale musí dělat WebSalesOrderController::store()
     *       v okamžiku vytváření objednávky - viz poznámka v odpovědi.
     */
    public function showByToken(string $token): JsonResponse
    {
        $lead = WebSalesLead::where('public_token', $token)->first();

        if (!$lead) {
            return response()->json(['message' => 'Odkaz je neplatný nebo již expiroval.'], 404);
        }

        if ($lead->public_token_used_at) {
            return response()->json(['message' => 'Tento formulář již byl jednou odeslán a odkaz není možné použít znovu.'], 410);
        }

        return response()->json([
            'id'             => $lead->id,
            'subject_name'   => $lead->subject_name,
            'contact_person' => $lead->contact_person,
            'contact_email'  => $lead->contact_email,
            'contact_phone'  => $lead->contact_phone,
        ]);
    }

    /**
     * Logs administrative actions to the central audit system.
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
            $user = $request->user();

            WebLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => $description,
                'affected_entity_type' => 'WebSalesLead',
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'System/Automated'
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (WebSalesLead): " . $e->getMessage());
        }
    }
}