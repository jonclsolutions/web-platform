<?php
/**
 * @file WebLogController.php
 * @path app/Http/Controllers/Api/Web/WebLogController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Controller providing access to system audit logs, supporting complex filtering, sorting, and manual log entry creation.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebLog;
use App\Http\Resources\Web\WebLogResource;
use App\Http\Requests\Web\WebLog\StoreWebLogRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\JsonResponse;

/**
 * @description Manages audit trail records.
 * @note Enables querying logs by various parameters including event type, module, and user identity.
 */
class WebLogController extends Controller
{
    /**
     * Retrieves a paginated or full collection of audit logs based on search filters.
     *
     * @param Request $request Filters (event_type, module, text fields) and sorting/pagination parameters.
     * @return JsonResponse Collection of log entries.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        $table = (new WebLog())->getTable();

        // Base query with user relation
        $query = WebLog::query()->select("$table.*")->with('user');

        // --- FILTRATION ---
        if ($request->filled('id')) {
            $query->where("$table.id", $request->id);
        }
        
        if ($request->filled('created_at')) {
            $query->whereDate("$table.created_at", $request->input('created_at'));
        }

        if ($request->filled('event_type')) {
            $query->where("$table.event_type", $request->event_type);
        }

        if ($request->filled('module')) {
            $query->where("$table.module", $request->module);
        }

        $textFields = ['origin', 'description', 'affected_entity_type', 'user_id_plain', 'user_plain'];
        foreach ($textFields as $field) {
            if ($request->filled($field)) {
                $query->where("$table.$field", 'like', '%' . $request->input($field) . '%');
            }
        }

        // --- SORTING ---
        $sortBy = $request->input('sort_by', 'created_at'); 
        $sortDirection = (strtolower($request->input('sort_direction')) === 'asc') ? 'asc' : 'desc';

        if ($sortBy === 'user_email' || $sortBy === 'user.user_email') {
            $query->join('users', "$table.user_id", '=', 'users.id')
                  ->orderBy('users.user_email', $sortDirection);
        } else {
            $sortColumn = str_contains($sortBy, '.') ? $sortBy : "$table.$sortBy";
            $query->orderBy($sortColumn, $sortDirection);
        }

        // --- EXECUTION ---
        if ($noPagination) {
            $logs = $query->get();
            return response()->json(WebLogResource::collection($logs));
        }

        $logs = $query->paginate($perPage);

        return response()->json([
            'data'         => WebLogResource::collection($logs->items()),
            'total'        => $logs->total(),
            'per_page'     => $logs->perPage(),
            'current_page' => $logs->currentPage(),
            'last_page'    => $logs->lastPage(),
        ]);
    }

    /**
     * Retrieves a single log entry.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $log = WebLog::with('user')->findOrFail($id);
        return response()->json(new WebLogResource($log));
    }

    /**
     * Manually creates an audit log entry.
     *
     * @param StoreWebLogRequest $request
     * @return JsonResponse
     */
    public function store(StoreWebLogRequest $request): JsonResponse
    {
        try {
            $user = $request->user();
            $logData = array_merge($request->validated(), [
                'user_id' => $user?->id,
                'created_at' => now(), 
                'origin' => $request->input('origin') ?? $request->ip(),
            ]);
            $log = WebLog::create($logData);
            return response()->json(new WebLogResource($log), 201);
        } catch (\Exception $e) {
            Log::error('Chyba při vytváření business logu: ' . $e->getMessage());
            return response()->json(['message' => 'Chyba serveru'], 500);
        }
    }
}