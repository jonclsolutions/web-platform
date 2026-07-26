<?php
/**
 * @file CoreRoleController.php
 * @path app/Http/Controllers/Api/Core/CoreRoleController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages CRUD operations for user roles, including pagination for administrative tables,
 *              permission-matrix synchronization, and audit logging of all data changes.
 * @note Systémové role (viz CoreRole::PROTECTED_ROLE_NAMES - sysadmin/admin) nelze
 *       přes tento controller editovat, mazat, ani jim měnit oprávnění. Role, která má přiřazeného
 *       alespoň jednoho uživatele, nelze smazat.
 * @bugfix-note (2026) update() a show() dříve používaly implicitní route-model-binding
 *       (`CoreRole $role` typehint). Protože routy pro 'roles' mají URL parametr přejmenovaný
 *       na `id` (viz routes/api.php: ->parameters(['roles' => 'id'])), název route parametru
 *       (`id`) se neshodoval s názvem argumentu metody (`role`) - implicitní binding proto
 *       vůbec neproběhl a Laravel container místo skutečné role z DB injektoval PRÁZDNOU,
 *       nikdy neuloženou instanci CoreRole. `$role->update()` na takovém modelu pak dělal
 *       INSERT namísto UPDATE (vytvářel duchy-záznamy) a `loadCount()` následně padal na
 *       "Call to a member function getAttributes() on null", protože model neexistoval v DB.
 *       Opraveno stejně, jako už správně dělají destroy()/syncPermissions()/restore() -
 *       $id se přebírá napřímo a model se dohledává ručně přes findOrFail().
 * @debug-note (2026) destroy() dočasně obsahuje podrobné Log::info() volání (prefix
 *       "[ROLE DELETE DEBUG]") kvůli diagnostice hlášeného chování "smaže se jen na
 *       frontendu, po refreshi se role vrátí". Po vyřešení klidně odstraňte.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\CoreRole\StoreCoreRoleRequest;
use App\Http\Requests\Core\CoreRole\SyncRolePermissionsRequest;
use App\Http\Requests\Core\CoreRole\UpdateCoreRoleRequest;
use App\Http\Resources\Core\CoreRoleResource;
use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use App\Models\Web\WebLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CoreRoleController extends Controller
{
    /**
     * Retrieves a list of roles for the administrative interface.
     * Supports `no_pagination=true` for the permission-matrix UI, which needs all roles at once.
     *
     * @param Request $request The incoming HTTP request containing pagination and search parameters.
     * @return JsonResponse Returns a formatted JSON response compatible with GenericTable requirements.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);
        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        $query = CoreRole::query()->withCount('users')->with('permissions');

        if ($onlyTrashed) {
            $query->onlyTrashed();
        }

        if ($s = $request->input('search')) {
            $query->where('role_name', 'like', "%$s%")
                  ->orWhere('description', 'like', "%$s%");
        }

        if ($noPagination) {
            $roles = $query->orderBy('id')->get();
            return response()->json(CoreRoleResource::collection($roles));
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

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')), 201);
    }

    /**
     * Displays a specific role entity.
     *
     * @param int $id The ID of the role (route parameter je pojmenovaný `id`, viz routes/api.php).
     * @return JsonResponse Returns the role resource.
     */
    public function show($id): JsonResponse
    {
        $role = CoreRole::findOrFail($id);

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Updates an existing role entity (name/description only - permissions go through syncPermissions()).
     *
     * @param UpdateCoreRoleRequest $request Validated request containing updated data.
     * @param int $id The ID of the role (route parameter je pojmenovaný `id`, viz routes/api.php).
     * @return JsonResponse Returns the updated role resource.
     */
    public function update(UpdateCoreRoleRequest $request, $id): JsonResponse
    {
        $role = CoreRole::findOrFail($id);

        if ($role->isProtected()) {
            return response()->json([
                'message' => 'Systémovou roli nelze upravovat.',
            ], 403);
        }

        $role->update($request->validated());

        $this->logAction($request, 'update', 'CoreRole', "Updated role: {$role->role_name}", $role->id);

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Synchronizes the set of permissions assigned to a role (matrix UI "save" action).
     *
     * @param SyncRolePermissionsRequest $request Validated request containing the desired permission_keys.
     * @param int $id The ID of the role to update.
     * @return JsonResponse Returns the updated role resource with fresh permissions.
     */
    public function syncPermissions(SyncRolePermissionsRequest $request, $id): JsonResponse
    {
        $role = CoreRole::findOrFail($id);

        if ($role->isProtected()) {
            return response()->json([
                'message' => 'Oprávnění systémové role nelze měnit.',
            ], 403);
        }

        $permissionIds = CorePermission::whereIn('permission_key', $request->validated()['permission_keys'])
            ->pluck('id');

        $role->permissions()->sync($permissionIds);

        $this->logAction(
            $request,
            'sync_permissions',
            'CoreRole',
            "Aktualizována oprávnění role: {$role->role_name} (" . $permissionIds->count() . " oprávnění)",
            $role->id
        );

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Deletes a role entity, supporting both soft and hard (force) deletion.
     * Blocked for protected (system) roles and for any role currently assigned to a user.
     *
     * @param Request $request Request containing delete parameters.
     * @param int $id The ID of the role to delete.
     * @return JsonResponse Returns 204 No Content upon success.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        Log::info('[ROLE DELETE DEBUG] destroy() called', [
            'raw_id'          => $id,
            'id_type'         => gettype($id),
            'route_param_id'  => $request->route('id'),
            'query_params'    => $request->query(),
            'user_id'         => $request->user()?->id,
            'user_email'      => $request->user()?->user_email,
        ]);

        $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);

        try {
            $role = CoreRole::withTrashed()->findOrFail($id);
        } catch (\Throwable $e) {
            Log::warning('[ROLE DELETE DEBUG] findOrFail selhal - role s tímto ID neexistuje vůbec', [
                'id' => $id,
                'exception' => $e->getMessage(),
            ]);
            throw $e;
        }

        Log::info('[ROLE DELETE DEBUG] role nalezena', [
            'id'             => $role->id,
            'role_name'      => $role->role_name,
            'is_protected'   => $role->isProtected(),
            'deleted_at_now' => $role->deleted_at,
            'force_delete'   => $forceDelete,
        ]);

        if ($role->isProtected()) {
            Log::info('[ROLE DELETE DEBUG] zamítnuto - role je chráněná (sysadmin/admin)', [
                'id' => $role->id,
            ]);
            return response()->json([
                'message' => 'Systémovou roli nelze smazat.',
            ], 403);
        }

        $usersCount = $role->users()->count();
        Log::info('[ROLE DELETE DEBUG] počet přiřazených uživatelů', [
            'id' => $role->id,
            'users_count' => $usersCount,
        ]);

        if ($usersCount > 0) {
            Log::info('[ROLE DELETE DEBUG] zamítnuto - role má přiřazené uživatele', [
                'id' => $role->id,
                'users_count' => $usersCount,
            ]);
            return response()->json([
                'message' => "Roli nelze smazat - je přiřazena k {$usersCount} uživatelskému účtu(ům). Nejprve těmto uživatelům přiřaďte jinou roli.",
            ], 403);
        }

        try {
            if ($forceDelete) {
                Log::info('[ROLE DELETE DEBUG] volám forceDelete()', ['id' => $role->id]);
                $result = $role->forceDelete();
            } else {
                Log::info('[ROLE DELETE DEBUG] volám delete() (soft delete)', ['id' => $role->id]);
                $result = $role->delete();
            }

            Log::info('[ROLE DELETE DEBUG] výsledek delete()/forceDelete()', [
                'id'     => $role->id,
                'result' => $result,
            ]);
        } catch (\Throwable $e) {
            Log::error('[ROLE DELETE DEBUG] delete()/forceDelete() vyhodilo výjimku', [
                'id' => $role->id,
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }

        // Ověření přímo proti DB (bypass Eloquent modelu/cache), ať víme jistě,
        // jestli je sloupec deleted_at v tabulce opravdu vyplněný, nebo řádek fyzicky pryč.
        if ($forceDelete) {
            $stillExists = DB::table('core_roles')->where('id', $id)->exists();
            Log::info('[ROLE DELETE DEBUG] ověření z DB po forceDelete()', [
                'id' => $id,
                'still_exists_in_db' => $stillExists,
            ]);
        } else {
            $freshRow = DB::table('core_roles')->where('id', $id)->first();
            Log::info('[ROLE DELETE DEBUG] ověření z DB po delete() (soft)', [
                'id' => $id,
                'row_from_db' => $freshRow,
            ]);
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

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Permanently deletes all soft-deleted roles (excluding protected system roles as a safety net,
     * though those are never soft-deleted via this controller in the first place).
     *
     * @return JsonResponse
     * @note Doplněno - routa `/core/roles/force-delete-all` na tuto metodu odkazovala,
     *       ale v původním controlleru neexistovala.
     */
    public function forceDeleteAllTrashed(): JsonResponse
    {
        try {
            $query = CoreRole::onlyTrashed();
            $count = $query->count();
            $query->forceDelete();

            $this->logAction(request(), 'force_delete_all', 'CoreRole', "Vysypání koše rolí. Smazáno: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction(request(), 'error', 'CoreRole', "Chyba při vysypávání koše rolí: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
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