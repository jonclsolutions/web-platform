<?php
/**
 * @file UserController.php
 * @path app/Http/Controllers/Api/UserController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages user account lifecycles, including creation, role assignment, password security policies, and administrative audit logging.
 * @note (2026) Veškerá speciální logika okolo role 'primeadmin' byla odstraněna - chová
 *       se teď jako naprosto běžná role. Jediné trvale chráněné (needitovatelné,
 *       nesmazatelné) role jsou 'sysadmin' a 'admin' (viz CoreRole::PROTECTED_ROLE_NAMES).
 *       changePassword() proto už roli 'primeadmin' automaticky nepovažuje za "admina"
 *       s právem měnit hesla jiným uživatelům - kdo tohle právo mít má, se řídí čistě
 *       tím, jestli má roli 'admin' nebo 'sysadmin'.
 *
 * @refactor-note (2026-08-2) Odstraněna legacy HR/osobní pole (viz User.php). Přidán
 * `enable_2fa` - admin/sysadmin ho mají VŽDY `true`, vynuceno na backendu
 * (`resolveEnable2fa()`), nezávisle na tom, co pošle klient, a to při store() i update().
 *
 * @refactor-note (2026-08-3) KRITICKÁ BEZPEČNOSTNÍ OCHRANA "jen sysadmin smí zasáhnout
 * sysadmina" je nyní důsledně aplikovaná na VŠECH pěti místech, kde se to týká:
 * `store()` (vytvoření nového sysadmin účtu), `update()` (editace existujícího sysadmin
 * účtu I povýšení cizího účtu na sysadmina), `changePassword()` (reset hesla sysadmin
 * účtu - kromě vlastníka sobě samému), `destroy()` a `forceDeleteAllTrashed()` (mazání,
 * jednotlivě i hromadně přes koš). Všech pět kontrol sdílí stejnou konstantu
 * `SYSADMIN_ROLE_NAME` a pomocnou metodu `isSysadminRoleId()`/`actorIsSysadmin()`, aby
 * nemohlo dojít k nekonzistenci (např. hardcoded string na jednom místě, konstanta na
 * druhém) - historicky se to stalo a je to přesně ten typ chyby, který otevírá díru.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{User};
use App\Models\Core\CoreRole;
use App\Models\Web\WebLog;
use App\Http\Requests\User\{StoreUserRequest, UpdateUserRequest};
use App\Http\Requests\PasswordChangeRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\{Hash, Log, DB};

/**
 * @description Controller responsible for user management operations.
 */
class UserController extends Controller
{
    /**
     * @description Role names which always have 2FA forced on, regardless of client input.
     */
    private const FORCED_2FA_ROLE_NAMES = ['admin', 'sysadmin'];

    /**
     * @description Role name protected by the "only a sysadmin may touch a sysadmin"
     * invariant (create, edit/promote, delete, password change). Deliberately narrower
     * than FORCED_2FA_ROLE_NAMES - only 'sysadmin' itself is this strictly protected,
     * not 'admin'.
     */
    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /**
     * Retrieves a paginated list of users with filtering and role-based sorting.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN) 
                    || filter_var($request->input('is_deleted', false), FILTER_VALIDATE_BOOLEAN);

        $sortBy = $request->input('sort_by', 'id');
        $dir = in_array(strtolower($request->input('sort_direction')), ['asc', 'desc']) ? $request->input('sort_direction') : 'desc';

        $query = User::query()->withTrashed();

        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($request->filled('full_name')) $query->where('full_name', 'like', "%{$request->full_name}%");
        if ($request->filled('user_email')) $query->where('user_email', 'like', "%{$request->user_email}%");

        if ($sortBy === 'role_name') {
            $query->select('users.*')
                ->leftJoin('user_roles as ur', 'users.id', '=', 'ur.user_id')
                ->leftJoin('roles as r', 'ur.role_id', '=', 'r.id')
                ->orderBy('r.role_name', $dir);
        } else {
            $sortColumn = str_contains($sortBy, '.') ? $sortBy : "users.$sortBy";
            $query->orderBy($sortColumn, $dir);
        }

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, 'export', 'User', "Hromadný export uživatelů.");
            $users = $query->with('roles.permissions')->get();
            return response()->json(UserResource::collection($users));
        }

        $users = $query->with('roles.permissions')->paginate($perPage);

        return response()->json([
            'data' => UserResource::collection($users->items()),
            'total' => $users->total(),
            'per_page' => $users->perPage(),
            'current_page' => $users->currentPage(),
            'last_page' => $users->lastPage(),
        ]);
    }

    /**
     * Creates a new user and assigns an initial role.
     * @note KRITICKÁ OCHRANA: vytvořit nový účet s rolí sysadmin smí jen volající, který
     * je sám sysadmin - jinak by šlo ochranu v update()/destroy() obejít tím, že by se
     * sysadmin účet rovnou VYTVOŘIL, místo aby se na něj někdo povyšoval.
     *
     * @param StoreUserRequest $request
     * @return JsonResponse
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $roleId = $validated['role_id'] ?? null;

        if ($roleId && $this->isSysadminRoleId((int) $roleId) && !$this->actorIsSysadmin($request)) {
            $this->logAction($request, 'create_denied', 'User', "Zamítnut pokus o vytvoření nového sysadmin účtu: {$validated['user_email']}");
            return response()->json(['message' => 'Nový účet s rolí sysadmin smí vytvořit pouze jiný sysadmin.'], 403);
        }

        DB::beginTransaction();
        try {
            $validated['enable_2fa'] = $this->resolveEnable2fa($roleId, $validated['enable_2fa'] ?? false);

            $user = User::create(array_merge($validated, [
                'user_password_hash' => Hash::make($validated['user_password_hash']),
            ]));

            if ($roleId) {
                $user->roles()->attach($roleId);
            }

            DB::commit();
            $this->logAction($request, 'create', 'User', "Vytvořen uživatel: {$user->user_email}", $user->id);
            
            return response()->json(new UserResource($user->load('roles.permissions')), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, 'error', 'User', "Chyba při vytváření uživatele: " . $e->getMessage());
            return response()->json(['message' => 'Chyba při vytváření uživatele.'], 500);
        }
    }

    /**
     * Displays details for a specific user.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $user = User::withTrashed()->findOrFail($id);

        return response()->json(new UserResource($user->load('roles.permissions')));
    }

    /**
     * Updates an existing user's information.
     * @note KRITICKÁ OCHRANA: pokud je cílový účet sysadmin, NEBO request žádá o
     * povýšení cílového účtu na sysadmina, smí to provést jen volající, který je SÁM
     * sysadmin. `enable_2fa` je navíc vynuceno na `true` pro admin/sysadmin bez ohledu
     * na to, co přijde v requestu.
     *
     * @param UpdateUserRequest $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(UpdateUserRequest $request, $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $validated = $request->validated();

        $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
        $promotingToSysadmin = isset($validated['role_id']) && !$targetIsSysadmin
            && $this->isSysadminRoleId((int) $validated['role_id']);

        if (($targetIsSysadmin || $promotingToSysadmin) && !$this->actorIsSysadmin($request)) {
            $reason = $targetIsSysadmin
                ? "Zamítnuta úprava sysadmin účtu: {$user->user_email}"
                : "Zamítnut pokus o povýšení účtu na sysadmina: {$user->user_email}";
            $this->logAction($request, 'update_denied', 'User', $reason, $id);
            return response()->json(['message' => 'Účet s rolí sysadmin smí upravovat, nebo na ni povyšovat, pouze jiný sysadmin.'], 403);
        }

        if (!empty($validated['user_password_hash'])) {
            $validated['user_password_hash'] = Hash::make($validated['user_password_hash']);
        } else {
            unset($validated['user_password_hash']);
        }

        // Role po update (buď nově zvolená, nebo stávající, pokud se role nemění)
        // rozhoduje o vynucení enable_2fa - nejen v okamžiku výběru role ve formuláři.
        $effectiveRoleId = $validated['role_id'] ?? $user->roles()->first()?->id;
        $validated['enable_2fa'] = $this->resolveEnable2fa($effectiveRoleId, $validated['enable_2fa'] ?? $user->enable_2fa);

        DB::beginTransaction();
        try {
            $user->update($validated);

            if (isset($validated['role_id'])) {
                if ($request->user()->id !== $user->id) {
                    $user->roles()->sync([$validated['role_id']]);
                }
            }

            DB::commit();
            $this->logAction($request, 'update', 'User', "Aktualizace uživatele: {$user->user_email}", $user->id);
            return response()->json(new UserResource($user->load('roles.permissions')));

        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, 'error', 'User', "Chyba při updatu uživatele ID {$id}: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Chyba serveru při ukládání.'], 500);
        }
    }

    /**
     * Handles password changes with administrative validation requirements.
     * @note KRITICKÁ OCHRANA: cizí sysadmin účet smí heslo změnit jen jiný sysadmin -
     * vlastník (isOwner) si své vlastní heslo měnit může vždy, bez ohledu na roli.
     *
     * @param PasswordChangeRequest $request
     * @param int $id
     * @return JsonResponse
     */
    public function changePassword(PasswordChangeRequest $request, $id): JsonResponse
    {
        try {
            $user = User::findOrFail($id);
            $validated = $request->validated();
            $auth = $request->user() ?? auth('sanctum')->user();

            $isOwner = $user->id === $auth->id;

            $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
            if ($targetIsSysadmin && !$isOwner) {
                $actorIsSysadmin = $auth->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
                if (!$actorIsSysadmin) {
                    $this->logAction($request, 'password_change_denied', 'User', "Zamítnut pokus o změnu hesla sysadmin účtu: {$user->user_email}", $id);
                    return response()->json(['message' => 'Heslo účtu s rolí sysadmin smí změnit pouze jiný sysadmin.'], 403);
                }
            }

            $isAdmin = $auth->roles()->whereIn('role_name', ['admin', 'sysadmin'])->exists();

            if (!$isOwner && !$isAdmin) {
                return response()->json(['message' => 'Nedostatečná oprávnění.'], 403);
            }

            if (!isset($validated['old_password']) || !Hash::check($validated['old_password'], $auth->user_password_hash)) {
                return response()->json(['message' => 'Vaše potvrzovací heslo (aktuální heslo) je nesprávné.'], 403);
            }

            $user->update(['user_password_hash' => Hash::make($validated['new_password'])]);
            
            $this->logAction(
                $request, 
                'PasswordChanged', 
                'User', 
                "Změna hesla u: {$user->user_email} " . ($isAdmin && !$isOwner ? "(provedl admin: {$auth->user_email})" : ""), 
                $user->id
            );

            return response()->json(['message' => 'Heslo úspěšně změněno.']);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'User', "Chyba při změně hesla ID {$id}: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Změna hesla selhala.'], 500);
        }
    }

    /**
     * Restores a soft-deleted user.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function restore($id): JsonResponse
    {
        try {
            $user = User::withTrashed()->findOrFail($id);
            $user->restore();

            $this->logAction(request(), 'restore', 'User', "Obnoven uživatel: {$user->user_email}", $user->id);
            return response()->json(new UserResource($user->load('roles.permissions')));
        } catch (\Exception $e) {
            $this->logAction(request(), 'error', 'User', "Chyba při obnově uživatele ID {$id}: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Obnova uživatele selhala.'], 500);
        }
    }

    /**
     * Handles soft or hard deletion of a user.
     * @note Uživatel nemůže smazat sám sebe. KRITICKÁ OCHRANA: účet s rolí 'sysadmin'
     * smí smazat výhradně jiný sysadmin.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $user = User::withTrashed()->findOrFail($id);

            if ($request->user()?->id == $id) {
                return response()->json(['message' => 'Nelze smazat vlastní účet.'], 403);
            }

            $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();

            if ($targetIsSysadmin && !$this->actorIsSysadmin($request)) {
                $this->logAction($request, 'delete_denied', 'User', "Zamítnut pokus o smazání sysadmin účtu: {$user->user_email}", $id);
                return response()->json(['message' => 'Účet s rolí sysadmin smí smazat pouze jiný sysadmin.'], 403);
            }

            $force = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $force ? $user->forceDelete() : $user->delete();
            
            $this->logAction($request, $force ? 'hard_delete' : 'soft_delete', 'User', "Smazáno ID: $id", $id);
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'User', "Chyba při mazání uživatele ID {$id}: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Smazání uživatele selhalo.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted users.
     * @note KRITICKÁ OCHRANA: trashnuté účty s rolí 'sysadmin' se z hromadného
     * vyprázdnění koše vyjímají, pokud sám volající není sysadmin.
     *
     * @return JsonResponse
     */
    public function forceDeleteAllTrashed(): JsonResponse
    {
        try {
            $query = User::onlyTrashed();

            if (!$this->actorIsSysadmin(request())) {
                $query->whereDoesntHave('roles', function ($q) {
                    $q->where('role_name', self::SYSADMIN_ROLE_NAME);
                });
            }

            $count = $query->count();
            $query->forceDelete();
            
            $this->logAction(request(), 'force_delete_all', 'User', "Vysypání koše. Smazáno: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction(request(), 'error', 'User', "Chyba při vysypávání koše uživatelů: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }

    /**
     * @description Zjišťuje, jestli přihlášený uživatel z daného requestu má roli
     * sysadmin. Sdílená pomocná metoda pro store()/update()/destroy()/forceDeleteAllTrashed().
     *
     * @param Request $request
     * @return bool
     */
    private function actorIsSysadmin(Request $request): bool
    {
        return $request->user()
            ?->roles()
            ->where('role_name', self::SYSADMIN_ROLE_NAME)
            ->exists() ?? false;
    }

    /**
     * @description Zjišťuje, jestli daná role odpovídá roli sysadmin.
     *
     * @param int $roleId
     * @return bool
     */
    private function isSysadminRoleId(int $roleId): bool
    {
        return CoreRole::where('id', $roleId)
            ->where('role_name', self::SYSADMIN_ROLE_NAME)
            ->exists();
    }

    /**
     * @description Rozhoduje o výsledné hodnotě `enable_2fa` pro danou roli - pro
     * admin/sysadmin VŽDY vrátí `true` bez ohledu na `$requestedValue`, jinak vrátí
     * `$requestedValue` beze změny.
     *
     * @param int|null $roleId
     * @param bool $requestedValue Hodnota poslaná klientem (nebo aktuální stav u update()).
     * @return bool
     */
    private function resolveEnable2fa(?int $roleId, bool $requestedValue): bool
    {
        if (!$roleId) {
            return $requestedValue;
        }

        $isForcedRole = CoreRole::where('id', $roleId)
            ->whereIn('role_name', self::FORCED_2FA_ROLE_NAMES)
            ->exists();

        return $isForcedRole ? true : $requestedValue;
    }

    /**
     * Internal audit logging utility.
     *
     * @param Request $request
     * @param string $type
     * @param string $mod
     * @param string $desc
     * @param int|null $id
     * @return void
     */
    protected function logAction(Request $request, string $type, string $mod, string $desc, ?int $id = null)
    {
        try {
            $user = $request->user() ?? auth('sanctum')->user();
            
            $sensitiveFields = [
                'new_password_confirmation',
                'user_password_hash', 
                'old_password', 
                'new_password', 
                'password', 
                'password_confirmation',
                'current_password'
            ];

            WebLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $type,
                'module'               => $mod,
                'description'          => $desc,
                'affected_entity_type' => 'User',
                'affected_entity_id'   => $id,
                'user_id'              => $user?->id,
                'context_data'         => json_encode($request->except($sensitiveFields), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'system'
            ]);
        } catch (\Exception $e) { 
            Log::error("Log error (User): " . $e->getMessage()); 
        }
    }
}