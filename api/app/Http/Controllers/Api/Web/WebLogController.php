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
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);

        $query = WebLog::query();

        if ($request->filled('event_type')) {
            $query->where('event_type', $request->event_type);
        }

        if ($request->filled('module')) {
            $query->where('module', $request->module);
        }

        if ($s = $request->input('search')) {
            $query->where('description', 'like', "%$s%");
        }

        $sortBy = $request->input('sort_by', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

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