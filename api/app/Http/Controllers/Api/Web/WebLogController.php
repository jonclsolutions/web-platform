<?php
/**
 * @file WebLogController.php
 * @path app/Http/Controllers/Api/Web/WebLogController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Read/write access to the web-domain audit log (web_logs) - business
 * content activity across news, support tickets, job applications, sales leads/orders,
 * raw request commissions, and external links. Structurally mirrors CoreLogController /
 * ShopLogController.
 *
 * @bugfix-note (2026-08-15) KRITICKÁ OPRAVA FILTRŮ: `index()` zpracovával jen
 * `event_type`/`module` (přesná shoda) a `search` (LIKE jen na `description`). Frontend
 * (`business-logs.config.ts` FILTER_COLUMNS) ale nabízí i `id`, `user_plain` a `origin` -
 * tyhle tři se nikde nezpracovávaly, stejný symptom jako u WebNewsController a
 * WebJobApplicationController (viz jejich bugfix-notes stejné datum). Doplněno `id`
 * (přesná shoda) a `user_plain`/`origin` (LIKE, konzistentně s ostatními textovými
 * filtry v systému).
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebLog;
use App\Http\Resources\Web\WebLogResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class WebLogController extends Controller
{
    /**
     * Retrieves a paginated list of web audit events with optional filtering.
     *
     * @param Request $request Incoming request containing filters and pagination.
     * @return JsonResponse
     */
/**
     * @bugfix-note (2026-08-25) BACKLOG "hledat napříč vším": stejná oprava jako
     * `CoreLogController::index()`/`ShopLogController::index()` - `search` param TADY
     * UŽ EXISTOVAL, ale hledal VÝHRADNĚ v `description`, přejmenováno na skutečně
     * GLOBÁLNÍ search napříč VŠEMI textovými sloupci, které tahle metoda už dřív
     * filtrovala jednotlivě (`event_type`, `module`, `user_plain`, `origin`,
     * `description`). `id` záměrně VYNECHÁN ze search - numerický přesný identifikátor.
     */
public function index(Request $request): JsonResponse
{
    $perPage = $request->input('per_page', 15);

    $query = WebLog::query();

    // Přesná shoda - ID je číselný identifikátor.
    if ($request->filled('id')) {
        $query->where('id', $request->input('id'));
    }

    if ($request->filled('event_type')) {
        $query->where('event_type', $request->event_type);
    }

    if ($request->filled('module')) {
        $query->where('module', $request->module);
    }

    // Částečná shoda - uživatel typicky zná jen část e-mailu.
    if ($request->filled('user_plain')) {
        $query->where('user_plain', 'like', '%' . $request->input('user_plain') . '%');
    }

    if ($request->filled('origin')) {
        $query->where('origin', 'like', '%' . $request->input('origin') . '%');
    }

    // Globální fulltextový search napříč VŠEMI relevantními textovými sloupci -
    // viz bugfix-note výše. Nezávislý na jednotlivých sloupcových filtrech nad ním
    // (AND, ne náhrada).
    if ($search = $request->input('search')) {
        $query->where(function ($q) use ($search) {
            $q->where('event_type', 'like', "%{$search}%")
              ->orWhere('module', 'like', "%{$search}%")
              ->orWhere('user_plain', 'like', "%{$search}%")
              ->orWhere('origin', 'like', "%{$search}%")
              ->orWhere('description', 'like', "%{$search}%");
        });
    }

    $sortBy = $request->input('sort_by', 'created_at');
    $sortDirection = $request->input('sort_direction', 'desc');
    $query->orderBy($sortBy, $sortDirection);

    /**
     * @bugfix-note (2026-08-29) BACKLOG "graph builder vidí jen 15 z 240 záznamů":
     * GraphBuilderComponent (a export/no_pagination vzor napříč zbytkem appky, viz
     * WebRawRequestCommissionController::index()) posílá `no_pagination=true`, aby
     * dostal VŠECHNY záznamy najednou (žádné stránkování) - tenhle kontrolér ho dřív
     * úplně ignoroval a vždy vracel `paginate($perPage)`, takže
     * `DataHandler.getCollection()` na frontendu (rozbaluje jen `.data`) dostal vždy
     * jen jednu stránku (15 položek), bez ohledu na to, kolik záznamů ve skutečnosti
     * existovalo. Běžná tabulka (paginace) tenhle parametr nikdy neposílá, takže její
     * chování se touhle větví vůbec nemění - propadne rovnou na `paginate()` níže.
     */
    $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

    if ($noPagination) {
        return response()->json(WebLogResource::collection($query->get()));
    }

    $data = $query->paginate($perPage);

    return response()->json([
        'data'         => WebLogResource::collection($data->items()),
        'total'        => $data->total(),
        'per_page'     => $data->perPage(),
        'current_page' => $data->currentPage(),
        'last_page'    => $data->lastPage(),
    ]);
}

    /**
     * Persists a new web audit event. Exposed mainly for consistency with
     * CoreLogController/ShopLogController - in practice most web_logs rows are written
     * internally via the LogsActivity trait, not through this endpoint directly.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_type'  => ['required', 'string', 'max:50'],
            'module'      => ['required', 'string', 'max:100'],
            'description' => ['required', 'string', 'max:1000'],
        ]);

        $log = WebLog::create([
            ...$validated,
            'origin'        => $request->ip(),
            'user_id'       => $request->user()?->id,
            'user_id_plain' => (string)($request->user()?->id ?? '0'),
            'user_plain'    => $request->user()?->user_email ?? 'system',
        ]);

        return response()->json(new WebLogResource($log), 201);
    }

    /**
     * Retrieves the details of a single web audit event.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $log = WebLog::findOrFail($id);
        return response()->json(new WebLogResource($log));
    }
}