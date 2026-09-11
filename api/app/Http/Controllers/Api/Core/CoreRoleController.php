<?php
/**
 * @file CoreRoleController.php
 * @path app/Http/Controllers/Api/Core/CoreRoleController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages CRUD operations for user roles, including pagination for administrative tables,
 *              permission-matrix synchronization, and audit logging of all data changes.
 * @note System roles (see CoreRole::PROTECTED_ROLE_NAMES - sysadmin/admin) cannot be
 *       edited, deleted, or have their permissions changed via this controller. A role that has at least
 *       one user assigned cannot be deleted.
 * @bugfix-note (2026) update() and show() previously used implicit route-model-binding
 *       (`CoreRole $role` typehint). Because routes for 'roles' have their URL parameter renamed
 *       to `id` (see routes/api.php: ->parameters(['roles' => 'id'])), the route parameter name
 *       (`id`) did not match the method argument name (`role`) - implicit binding therefore did not
 *       occur at all and the Laravel container injected an EMPTY, never saved instance of CoreRole
 *       instead of the actual role from the DB. Fixed identically to destroy()/syncPermissions()/restore()
 *       which already correctly do it - $id is taken directly and the model is looked up manually via findOrFail().
 *
 * @refactor-note (2026-08-5) CRITICAL SECURITY PROTECTION added: `isProtected()`
 * protected only the role being worked with (sysadmin/admin as TARGET), but no one checked
 * WHO is performing the action. store(), update(), syncPermissions(), destroy(), restore() and
 * forceDeleteAllTrashed() now require that the ACTOR (actorIsSysadmin()) has the sysadmin role.
 *
 * @refactor-note (2026-08-6) LOGGING MIGRATION to shared `LogsActivity` trait (see Traits/
 * LogsActivity.php) instead of local duplicate logAction(). At the same time FIXED target log model:
 * the local version wrote to `WebLog::class`, although roles/permissions according to the agreed
 * Core/Web/Shop division are purely a CORE domain (just like auth, users, legal, site
 * settings - see DocumentSectionController/SiteConfigurationController, which log to CoreLog
 * correctly already earlier). Moreover, the new trait automatically truncates `description` to 990 characters
 * and safely strips sensitive fields from `context_data` - the local version had none of these protections.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\CoreRole\StoreCoreRoleRequest;
use App\Http\Requests\Core\CoreRole\SyncRolePermissionsRequest;
use App\Http\Requests\Core\CoreRole\UpdateCoreRoleRequest;
use App\Http\Resources\Core\CoreRoleResource;
use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CoreRoleController extends Controller
{
    use LogsActivity;

    /**
     * @description Role name required of the ACTOR (not the role being edited) for every
     * mutating action on this controller - see @refactor-note (2026-08-5). Must match
     * `UserController::SYSADMIN_ROLE_NAME`.
     */
    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /**
     * Retrieves a list of roles for the administrative interface.
     * Supports `no_pagination=true` for the permission-matrix UI, which needs all roles at once.
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
     * @note CRITICAL PROTECTION: only sysadmin is allowed to create new roles.
     */
    public function store(StoreCoreRoleRequest $request): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'create_denied', 'CoreRole', 'Denied attempt to create role - actor is not sysadmin.');
            return response()->json(['message' => 'Roles can only be managed by sysadmin.'], 403);
        }

        $role = CoreRole::create($request->validated());

        $this->logAction($request, CoreLog::class, 'create', 'CoreRole', "Created role: {$role->role_name}", $role->id, 'CoreRole');

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')), 201);
    }

    /**
     * Displays a specific role entity.
     * @param int $id Route parameter is named `id`, see routes/api.php.
     */
    public function show($id): JsonResponse
    {
        $role = CoreRole::findOrFail($id);
        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Updates an existing role entity (name/description only - permissions go through syncPermissions()).
     * @note CRITICAL PROTECTION: only sysadmin is allowed to edit roles.
     */
    public function update(UpdateCoreRoleRequest $request, $id): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'update_denied', 'CoreRole', "Denied attempt to update role ID {$id} - actor is not sysadmin.", (int) $id, 'CoreRole');
            return response()->json(['message' => 'Roles can only be managed by sysadmin.'], 403);
        }

        $role = CoreRole::findOrFail($id);

        if ($role->isProtected()) {
            return response()->json(['message' => 'System role cannot be modified.'], 403);
        }

        $role->update($request->validated());

        $this->logAction($request, CoreLog::class, 'update', 'CoreRole', "Updated role: {$role->role_name}", $role->id, 'CoreRole');

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Synchronizes the set of permissions assigned to a role (matrix UI "save" action).
     * @note CRITICAL PROTECTION: only sysadmin is allowed to change role permissions - this is the MOST CRITICAL
     * endpoint in the entire controller (direct path to privilege escalation).
     */
    public function syncPermissions(SyncRolePermissionsRequest $request, $id): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'sync_permissions_denied', 'CoreRole', "Denied attempt to change permissions of role ID {$id} - actor is not sysadmin.", (int) $id, 'CoreRole');
            return response()->json(['message' => 'Role permissions can only be managed by sysadmin.'], 403);
        }

        $role = CoreRole::findOrFail($id);

        if ($role->isProtected()) {
            return response()->json(['message' => 'Permissions of a system role cannot be modified.'], 403);
        }

        $permissionIds = CorePermission::whereIn('permission_key', $request->validated()['permission_keys'])
            ->pluck('id');

        $role->permissions()->sync($permissionIds);

        $this->logAction(
            $request,
            CoreLog::class,
            'sync_permissions',
            'CoreRole',
            "Updated role permissions: {$role->role_name} (" . $permissionIds->count() . " permissions)",
            $role->id,
            'CoreRole'
        );

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Deletes a role entity, supporting both soft and hard (force) deletion.
     * Blocked for protected (system) roles and for any role currently assigned to a user.
     * @note CRITICAL PROTECTION: only sysadmin is allowed to delete roles.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'delete_denied', 'CoreRole', "Denied attempt to delete role ID {$id} - actor is not sysadmin.", (int) $id, 'CoreRole');
            return response()->json(['message' => 'Roles can only be managed by sysadmin.'], 403);
        }

        $role = CoreRole::withTrashed()->findOrFail($id);

        if ($role->isProtected()) {
            return response()->json(['message' => 'System role cannot be deleted.'], 403);
        }

        $usersCount = $role->users()->count();

        if ($usersCount > 0) {
            return response()->json([
                'message' => "Role cannot be deleted - it is assigned to {$usersCount} user account(s). Please assign a different role to these users first.",
            ], 403);
        }

        $role->forceDelete();

        $this->logAction($request, CoreLog::class, 'hard_delete', 'CoreRole', "Deleted role ID: $id", (int) $id, 'CoreRole');

        return response()->json(null, 204);
    }

    /**
     * Restores a previously soft-deleted role entity.
     * @note CRITICAL PROTECTION: only sysadmin is allowed to restore roles.
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'restore_denied', 'CoreRole', "Denied attempt to restore role ID {$id} - actor is not sysadmin.", $id, 'CoreRole');
            return response()->json(['message' => 'Roles can only be managed by sysadmin.'], 403);
        }

        $role = CoreRole::withTrashed()->findOrFail($id);
        $role->restore();

        $this->logAction($request, CoreLog::class, 'restore', 'CoreRole', "Restored role: {$role->role_name}", $role->id, 'CoreRole');

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Permanently deletes all soft-deleted roles.
     * @note CRITICAL PROTECTION: sysadmin only.
     */
    public function forceDeleteAllTrashed(): JsonResponse
    {
        $request = request();

        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'force_delete_all_denied', 'CoreRole', 'Denied attempt to empty the roles trash - actor is not sysadmin.');
            return response()->json(['message' => 'Roles can only be managed by sysadmin.'], 403);
        }

        try {
            $query = CoreRole::onlyTrashed();
            $count = $query->count();
            $query->forceDelete();

            $this->logAction($request, CoreLog::class, 'force_delete_all', 'CoreRole', "Emptied roles trash. Deleted: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'CoreRole', "Error emptying roles trash: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }

    /**
     * @description Determines whether the authenticated user from the given request has the
     * sysadmin role. Shared helper method for store()/update()/syncPermissions()/destroy()/
     * restore()/forceDeleteAllTrashed() - same principle and same name as in
     * `UserController`.
     */
    private function actorIsSysadmin(Request $request): bool
    {
        return $request->user()
            ?->roles()
            ->where('role_name', self::SYSADMIN_ROLE_NAME)
            ->exists() ?? false;
    }
}