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
 *       nikdy neuloženou instanci CoreRole. Opraveno stejně, jako už správně dělají
 *       destroy()/syncPermissions()/restore() - $id se přebírá napřímo a model se dohledává
 *       ručně přes findOrFail().
 *
 * @refactor-note (2026-08-5) KRITICKÁ BEZPEČNOSTNÍ OCHRANA přidána: `isProtected()`
 * chránilo jen roli, se kterou se pracuje (sysadmin/admin jako CÍL), ale nikdo nekontroloval,
 * KDO akci provádí. store(), update(), syncPermissions(), destroy(), restore() a
 * forceDeleteAllTrashed() nyní vyžadují, aby VOLAJÍCÍ (actorIsSysadmin()) měl roli sysadmin.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait (viz Traits/
 * LogsActivity.php) místo lokální duplicitní logAction(). Zároveň OPRAVEN cílový log model:
 * lokální verze zapisovala do `WebLog::class`, ačkoliv role/oprávnění jsou podle dohodnutého
 * Core/Web/Shop rozdělení čistě doménou CORE (stejně jako auth, uživatelé, legal, site
 * settings - viz DocumentSectionController/SiteConfigurationController, které do CoreLog
 * logují správně už dřív). Nový trait navíc automaticky ořezává `description` na 990 znaků
 * a `context_data` bezpečně stripuje citlivá pole - lokální verze žádnou z těchto ochran
 * neměla.
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
     * mutating action on this controller - viz @refactor-note (2026-08-5). Musí sedět s
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
     * @note KRITICKÁ OCHRANA: pouze sysadmin smí vytvářet nové role.
     */
    public function store(StoreCoreRoleRequest $request): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'create_denied', 'CoreRole', 'Zamítnut pokus o vytvoření role - volající není sysadmin.');
            return response()->json(['message' => 'Role smí spravovat pouze sysadmin.'], 403);
        }

        $role = CoreRole::create($request->validated());

        $this->logAction($request, CoreLog::class, 'create', 'CoreRole', "Created role: {$role->role_name}", $role->id, 'CoreRole');

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')), 201);
    }

    /**
     * Displays a specific role entity.
     * @param int $id Route parameter je pojmenovaný `id`, viz routes/api.php.
     */
    public function show($id): JsonResponse
    {
        $role = CoreRole::findOrFail($id);
        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Updates an existing role entity (name/description only - permissions go through syncPermissions()).
     * @note KRITICKÁ OCHRANA: pouze sysadmin smí role upravovat.
     */
    public function update(UpdateCoreRoleRequest $request, $id): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'update_denied', 'CoreRole', "Zamítnut pokus o úpravu role ID {$id} - volající není sysadmin.", (int) $id, 'CoreRole');
            return response()->json(['message' => 'Role smí spravovat pouze sysadmin.'], 403);
        }

        $role = CoreRole::findOrFail($id);

        if ($role->isProtected()) {
            return response()->json(['message' => 'Systémovou roli nelze upravovat.'], 403);
        }

        $role->update($request->validated());

        $this->logAction($request, CoreLog::class, 'update', 'CoreRole', "Updated role: {$role->role_name}", $role->id, 'CoreRole');

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Synchronizes the set of permissions assigned to a role (matrix UI "save" action).
     * @note KRITICKÁ OCHRANA: pouze sysadmin smí měnit oprávnění rolí - toto je NEJKRITIČTĚJŠÍ
     * endpoint v celém controlleru (přímá cesta k privilege escalation).
     */
    public function syncPermissions(SyncRolePermissionsRequest $request, $id): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'sync_permissions_denied', 'CoreRole', "Zamítnut pokus o změnu oprávnění role ID {$id} - volající není sysadmin.", (int) $id, 'CoreRole');
            return response()->json(['message' => 'Oprávnění rolí smí spravovat pouze sysadmin.'], 403);
        }

        $role = CoreRole::findOrFail($id);

        if ($role->isProtected()) {
            return response()->json(['message' => 'Oprávnění systémové role nelze měnit.'], 403);
        }

        $permissionIds = CorePermission::whereIn('permission_key', $request->validated()['permission_keys'])
            ->pluck('id');

        $role->permissions()->sync($permissionIds);

        $this->logAction(
            $request,
            CoreLog::class,
            'sync_permissions',
            'CoreRole',
            "Aktualizována oprávnění role: {$role->role_name} (" . $permissionIds->count() . " oprávnění)",
            $role->id,
            'CoreRole'
        );

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Deletes a role entity, supporting both soft and hard (force) deletion.
     * Blocked for protected (system) roles and for any role currently assigned to a user.
     * @note KRITICKÁ OCHRANA: pouze sysadmin smí role mazat.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'delete_denied', 'CoreRole', "Zamítnut pokus o smazání role ID {$id} - volající není sysadmin.", (int) $id, 'CoreRole');
            return response()->json(['message' => 'Role smí spravovat pouze sysadmin.'], 403);
        }

        $role = CoreRole::withTrashed()->findOrFail($id);

        if ($role->isProtected()) {
            return response()->json(['message' => 'Systémovou roli nelze smazat.'], 403);
        }

        $usersCount = $role->users()->count();

        if ($usersCount > 0) {
            return response()->json([
                'message' => "Roli nelze smazat - je přiřazena k {$usersCount} uživatelskému účtu(ům). Nejprve těmto uživatelům přiřaďte jinou roli.",
            ], 403);
        }

        $role->forceDelete();

        $this->logAction($request, CoreLog::class, 'hard_delete', 'CoreRole', "Deleted role ID: $id", (int) $id, 'CoreRole');

        return response()->json(null, 204);
    }

    /**
     * Restores a previously soft-deleted role entity.
     * @note KRITICKÁ OCHRANA: pouze sysadmin smí role obnovovat.
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'restore_denied', 'CoreRole', "Zamítnut pokus o obnovu role ID {$id} - volající není sysadmin.", $id, 'CoreRole');
            return response()->json(['message' => 'Role smí spravovat pouze sysadmin.'], 403);
        }

        $role = CoreRole::withTrashed()->findOrFail($id);
        $role->restore();

        $this->logAction($request, CoreLog::class, 'restore', 'CoreRole', "Restored role: {$role->role_name}", $role->id, 'CoreRole');

        return response()->json(new CoreRoleResource($role->loadCount('users')->load('permissions')));
    }

    /**
     * Permanently deletes all soft-deleted roles.
     * @note KRITICKÁ OCHRANA: pouze sysadmin.
     */
    public function forceDeleteAllTrashed(): JsonResponse
    {
        $request = request();

        if (!$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'force_delete_all_denied', 'CoreRole', 'Zamítnut pokus o vysypání koše rolí - volající není sysadmin.');
            return response()->json(['message' => 'Role smí spravovat pouze sysadmin.'], 403);
        }

        try {
            $query = CoreRole::onlyTrashed();
            $count = $query->count();
            $query->forceDelete();

            $this->logAction($request, CoreLog::class, 'force_delete_all', 'CoreRole', "Vysypání koše rolí. Smazáno: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'CoreRole', "Chyba při vysypávání koše rolí: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }

    /**
     * @description Zjišťuje, jestli přihlášený uživatel z daného requestu má roli
     * sysadmin. Sdílená pomocná metoda pro store()/update()/syncPermissions()/destroy()/
     * restore()/forceDeleteAllTrashed() - stejný princip a stejné jméno jako v
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