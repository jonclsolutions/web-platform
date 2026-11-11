<?php
/**
 * @file AuditLogController.php
 * @path app/Http/Controllers/Api/AuditLogController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared read endpoints of the three audit logs (core_logs, web_logs, shop_logs) -
 * list with filters, full-text search, safe sorting and optional pagination, and detail. The
 * tables have the same columns, so a module controller only names its model and API resource.
 * @note Read only: every row is written by the server itself (LogsActivity, the database log
 *   channel, LogDataExport) - the browser cannot write the audit log.
 * @dependencies
 * - App\Traits\AppliesSafeSorting: whitelisted sort column / direction.
 * - Controller::respond() / respondPaginated(): the API envelope.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\AppliesSafeSorting;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

abstract class AuditLogController extends Controller
{
    use AppliesSafeSorting;

    /**
     * @description Eloquent model of the log table (e.g. CoreLog::class).
     * @return class-string<Model>
     */
    abstract protected function model(): string;

    /**
     * @description API resource of one log row (e.g. CoreLogResource::class).
     * @return class-string<JsonResource>
     */
    abstract protected function resource(): string;

    /**
     * @description Paginated list of audit events with optional filters.
     * @param Request $request Filters (id, event_type, module, user_plain, origin), `search`,
     *   sorting, `per_page` and `no_pagination`.
     * @return JsonResponse
     * @note `search` is wrapped in its own `where(function ($q) { ... })`, so a future scope
     * condition cannot be bypassed by the OR; it narrows together with the column filters (AND).
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $query = $this->model()::query();

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

        if (filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN)) {
            return $this->respond($this->resource()::collection($query->get()));
        }

        return $this->respondPaginated($query->paginate($perPage), $this->resource());
    }

    /**
     * @description Detail of one audit event.
     * @param int|string $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $resource = $this->resource();
        return $this->respond(new $resource($this->model()::findOrFail($id)));
    }
}
