<?php
/**
 * @file CoreLogController.php
 * @path app/Http/Controllers/Api/Core/CoreLogController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Read/write access to the system-wide audit log (core_logs) - authentication
 * events, user/role/permission management, legal document changes, core site settings.
 * Structurally mirrors WebLogController / ShopLogController.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreLog;
use App\Http\Resources\Core\CoreLogResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CoreLogController extends Controller
{
    /**
     * Retrieves a paginated list of core audit events with optional filtering.
     *
     * @param Request $request Incoming request containing filters and pagination.
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);

        $query = CoreLog::query();

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
            'data'         => CoreLogResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Persists a new core audit event. Exposed mainly for consistency with
     * WebLogController/ShopLogController - in practice most core_logs rows are written
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

        $log = CoreLog::create([
            ...$validated,
            'origin'        => $request->ip(),
            'user_id'       => $request->user()?->id,
            'user_id_plain' => (string)($request->user()?->id ?? '0'),
            'user_plain'    => $request->user()?->user_email ?? 'system',
        ]);

        return response()->json(new CoreLogResource($log), 201);
    }

    /**
     * Retrieves the details of a single core audit event.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $log = CoreLog::findOrFail($id);
        return response()->json(new CoreLogResource($log));
    }
}