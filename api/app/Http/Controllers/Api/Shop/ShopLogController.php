<?php
/**
 * @file ShopLogController.php
 * @path app/Http/Controllers/Api/Shop/ShopLogController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Read/write access to the shop-domain audit log (shop_logs) - e-commerce
 * activity across products, orders, customers, coupons, categories, suppliers, shipping
 * and payment methods. Structurally mirrors CoreLogController / WebLogController.
 *
 * @bugfix-note (2026-08-15) KRITICKÁ OPRAVA FILTRŮ: `index()` zpracovával jen
 * `event_type`/`module` (přesná shoda) a `search` (LIKE jen na `description`). Frontend
 * (shop-pages logs config FILTER_COLUMNS) ale nabízí i `id`, `user_plain` a `origin` -
 * tyhle tři se nikde nezpracovávaly. Stejná díra byla nalezena a opravena souběžně u
 * WebLogController a CoreLogController (identická šablona, viz jejich bugfix-notes
 * stejné datum). Doplněno `id` (přesná shoda) a `user_plain`/`origin` (LIKE).
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopLogResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ShopLogController extends Controller
{
    /**
     * Retrieves a paginated list of shop audit events with optional filtering.
     *
     * @param Request $request Incoming request containing filters and pagination.
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);

        $query = ShopLog::query();

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

        if ($s = $request->input('search')) {
            $query->where('description', 'like', "%$s%");
        }

        $sortBy = $request->input('sort_by', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $data = $query->paginate($perPage);

        return response()->json([
            'data'         => ShopLogResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Persists a new shop audit event. Exposed mainly for consistency with
     * CoreLogController/WebLogController - in practice most shop_logs rows are written
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

        $log = ShopLog::create([
            ...$validated,
            'origin'        => $request->ip(),
            'user_id'       => $request->user()?->id,
            'user_id_plain' => (string)($request->user()?->id ?? '0'),
            'user_plain'    => $request->user()?->user_email ?? 'system',
        ]);

        return response()->json(new ShopLogResource($log), 201);
    }

    /**
     * Retrieves the details of a single shop audit event.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $log = ShopLog::findOrFail($id);
        return response()->json(new ShopLogResource($log));
    }
}