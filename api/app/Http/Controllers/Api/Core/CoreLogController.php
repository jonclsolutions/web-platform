<?php
/**
 * @file CoreLogController.php
 * @path app/Http/Controllers/Api/Core/CoreLogController.php
 * @project JS web-platform
 * @author JS
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
use App\Traits\AppliesSafeSorting;

class CoreLogController extends Controller
{
    use AppliesSafeSorting;

    /**
     * Retrieves a paginated list of core audit events with optional filtering.
     *
     * @param Request $request Incoming request containing filters and pagination.
     * @return JsonResponse
     */
/**
     * @note `search` is wrapped in its own `where(function ($q) { ... })` like in the other
     * controllers, so a future scope condition cannot be bypassed by the OR.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);

        $query = CoreLog::query();

        // Exact match - the ID is numeric.
        if ($request->filled('id')) {
            $query->where('id', $request->input('id'));
        }

        if ($request->filled('event_type')) {
            $query->where('event_type', $request->event_type);
        }

        if ($request->filled('module')) {
            $query->where('module', $request->module);
        }

        // Partial match - users usually know only a part of the e-mail.
        if ($request->filled('user_plain')) {
            $query->where('user_plain', 'like', '%' . $request->input('user_plain') . '%');
        }

        if ($request->filled('origin')) {
            $query->where('origin', 'like', '%' . $request->input('origin') . '%');
        }

        // Full-text search over the text columns; narrows together with the column filters (AND).
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('event_type', 'like', "%{$search}%")
                  ->orWhere('module', 'like', "%{$search}%")
                  ->orWhere('user_plain', 'like', "%{$search}%")
                  ->orWhere('origin', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $this->applySorting($query, $request, 'created_at', 'desc');

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

    if ($noPagination) {
        return $this->respond(CoreLogResource::collection($query->get()));
    }

        $data = $query->paginate($perPage);

        return $this->respondPaginated($data, CoreLogResource::class);
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

        return $this->respond(new CoreLogResource($log), 201);
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
        return $this->respond(new CoreLogResource($log));
    }
}