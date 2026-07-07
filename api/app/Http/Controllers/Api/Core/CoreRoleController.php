<?php
/**
 * @file CoreRoleController.php
 * @path app/Http/Controllers/Api/Core/CoreRoleController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages CRUD operations for user roles, including pagination for administrative tables and audit logging of all data changes.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\CoreRole\StoreCoreRoleRequest;
use App\Http\Requests\Core\CoreRole\UpdateCoreRoleRequest;
use App\Http\Resources\Core\CoreRoleResource;
use App\Models\Core\CoreRole;
use App\Models\Web\WebLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller responsible for processing role-based administrative requests.
 * @note Integrates with GenericTable for frontend data synchronization and performs audit logging for security compliance.
 */
class CoreRoleController extends Controller
{
    /**
     * Retrieves a paginated list of roles for the administrative interface.
     *
     * @param Request $request The incoming HTTP request containing pagination and search parameters.
     * @return JsonResponse Returns a formatted JSON response compatible with GenericTable requirements.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = CoreRole::query();

        if ($onlyTrashed) {
            $query->onlyTrashed();
        }

        if ($s = $request->input('search')) {
            $query->where('role_name', 'like', "%$s%")
                  ->orWhere('description', 'like', "%$s%");
        }

        $roles = $query->paginate($perPage);

        return response()->json([
            'data'         => CoreRoleResource::collection($roles->items()),
            'total'        => $roles->total(),
            'per_page'     => $roles->perPage(),
            'current_page' => $roles->currentPage(),
            'last_page'    => $roles->lastPage(),
        ]);
    }

    /**
     * Stores a new role entity in the database.
     *
     * @param StoreCoreRoleRequest $request Validated request containing role details.
     * @return JsonResponse Returns the created resource.
     */
    public function store(StoreCoreRoleRequest $request): JsonResponse
    {
        $role = CoreRole::create($request->validated());

        $this->logAction($request, 'create', 'CoreRole', "Created role: {$role->role_name}", $role->id);

        return response()->json(new CoreRoleResource($role), 201);
    }

    /**
     * Displays a specific role entity.
     *
     * @param CoreRole $role The role model instance resolved via route model binding.
     * @return JsonResponse Returns the role resource.
     */
    public function show(CoreRole $role): JsonResponse
    {
        return response()->json(new CoreRoleResource($role));
    }

    /**
     * Updates an existing role entity.
     *
     * @param UpdateCoreRoleRequest $request Validated request containing updated data.
     * @param CoreRole $role The existing role model instance.
     * @return JsonResponse Returns the updated role resource.
     */
    public function update(UpdateCoreRoleRequest $request, CoreRole $role): JsonResponse
    {
        $role->update($request->validated());

        $this->logAction($request, 'update', 'CoreRole', "Updated role: {$role->role_name}", $role->id);

        return response()->json(new CoreRoleResource($role));
    }

    /**
     * Deletes a role entity, supporting both soft and hard (force) deletion.
     *
     * @param Request $request Request containing delete parameters.
     * @param int $id The ID of the role to delete.
     * @return JsonResponse Returns 204 No Content upon success.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
        $role = CoreRole::withTrashed()->findOrFail($id);

        if ($forceDelete) {
            $role->forceDelete();
        } else {
            $role->delete();
        }

        $this->logAction($request, $forceDelete ? 'hard_delete' : 'soft_delete', 'CoreRole', "Deleted role ID: $id", $id);

        return response()->json(null, 204);
    }

    /**
     * Restores a previously soft-deleted role entity.
     *
     * @param Request $request The incoming request.
     * @param int $id The ID of the role to restore.
     * @return JsonResponse Returns the restored role resource.
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        $role = CoreRole::withTrashed()->findOrFail($id);
        $role->restore();

        $this->logAction($request, 'restore', 'CoreRole', "Restored role: {$role->role_name}", $role->id);

        return response()->json(new CoreRoleResource($role));
    }

    /**
     * Logs administrative actions to the central audit system (WebLog).
     *
     * @param Request $request The original request object for context.
     * @param string $eventType The type of operation (create, update, delete, etc.).
     * @param string $module The system module name (e.g., 'CoreRole').
     * @param string $description A human-readable description of the action.
     * @param int|null $affectedId The ID of the affected entity, if applicable.
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
                'affected_entity_type' => 'CoreRole',
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'system'
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (RoleController): " . $e->getMessage());
        }
    }
}