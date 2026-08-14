<?php
/**
 * @file UserController.php
 * @path app/Http/Controllers/Api/UserController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages user account lifecycles, including creation, role assignment, password security policies, and administrative audit logging.
 * @note (2026) Jediné trvale chráněné role jsou 'sysadmin' a 'admin'.
 *
 * @refactor-note (2026-08-3) KRITICKÁ BEZPEČNOSTNÍ OCHRANA "jen sysadmin smí zasáhnout
 * sysadmina" je aplikovaná na store(), update(), changePassword(), destroy() a
 * forceDeleteAllTrashed().
 *
 * @refactor-note (2026-08-4) changePassword() odesílá PasswordChangedNotification PŘI
 * KAŽDÉ změně hesla, s per-cílový-účet rate limitem proti zahlcení příjemce.
 *
 * @refactor-note (2026-08-12) `id` z route validováno přes ctype_digit() před použitím.
 *
 * @refactor-note (2026-08-7) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction(). ZÁROVEŇ OPRAVENA DOMÉNA: lokální verze logovala do
 * `WebLog::class`, ale správa uživatelských účtů je Core doména (`core-administrators-*`)
 * - loguje se nově do `CoreLog::class`. Lokální logAction() měla vlastní rozšířený seznam
 * SENSITIVE_KEYS (navíc old_password/new_password/new_password_confirmation oproti
 * tehdejšímu traitu) - tahle mezera byla opravena přímo v `LogsActivity::SENSITIVE_KEYS`
 * (viz trait hlavička), takže lokální kopii seznamu i vlastní normalizeLogId() už
 * nepotřebujeme: `$id` je v každé metodě před voláním logAction() už ověřené přes
 * ctype_digit() (nebo je to rovnou int z modelu), takže bezpečně proteče přes běžnou
 * PHP weak-typing koerci na `?int` parametr traitu.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\Auth\PasswordChangedNotification;
use App\Models\{User};
use App\Models\Core\CoreRole;
use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use App\Http\Requests\User\{StoreUserRequest, UpdateUserRequest};
use App\Http\Requests\PasswordChangeRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\{Hash, Log, DB, Mail, RateLimiter};

/**
 * @description Controller responsible for user management operations.
 */
class UserController extends Controller
{
    use LogsActivity;

    private const FORCED_2FA_ROLE_NAMES = ['admin', 'sysadmin'];
    private const SYSADMIN_ROLE_NAME = 'sysadmin';
    private const PASSWORD_CHANGE_NOTIFY_MAX_ATTEMPTS = 5;
    private const PASSWORD_CHANGE_NOTIFY_DECAY_SECONDS = 3600;

    /**
     * Retrieves a paginated list of users with filtering and role-based sorting.
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
            $this->logAction($request, CoreLog::class, 'export', 'User', "Hromadný export uživatelů.");
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
     * je sám sysadmin.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $roleId = $validated['role_id'] ?? null;

        if ($roleId && $this->isSysadminRoleId((int) $roleId) && !$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'create_denied', 'User', "Zamítnut pokus o vytvoření nového sysadmin účtu: {$validated['user_email']}");
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
            $this->logAction($request, CoreLog::class, 'create', 'User', "Vytvořen uživatel: {$user->user_email}", $user->id, 'User');

            return response()->json(new UserResource($user->load('roles.permissions')), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, CoreLog::class, 'error', 'User', "Chyba při vytváření uživatele: " . $e->getMessage());
            return response()->json(['message' => 'Chyba při vytváření uživatele.'], 500);
        }
    }

    /**
     * Displays details for a specific user.
     */
    public function show(string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        $user = User::withTrashed()->findOrFail($id);

        return response()->json(new UserResource($user->load('roles.permissions')));
    }

    /**
     * Updates an existing user's information.
     * @note KRITICKÁ OCHRANA: pokud je cílový účet sysadmin, NEBO request žádá o
     * povýšení cílového účtu na sysadmina, smí to provést jen volající, který je SÁM
     * sysadmin.
     */
    public function update(UpdateUserRequest $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        $user = User::findOrFail($id);
        $validated = $request->validated();

        $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
        $promotingToSysadmin = isset($validated['role_id']) && !$targetIsSysadmin
            && $this->isSysadminRoleId((int) $validated['role_id']);

        if (($targetIsSysadmin || $promotingToSysadmin) && !$this->actorIsSysadmin($request)) {
            $reason = $targetIsSysadmin
                ? "Zamítnuta úprava sysadmin účtu: {$user->user_email}"
                : "Zamítnut pokus o povýšení účtu na sysadmina: {$user->user_email}";
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', $reason, (int) $id, 'User');
            return response()->json(['message' => 'Účet s rolí sysadmin smí upravovat, nebo na ni povyšovat, pouze jiný sysadmin.'], 403);
        }

        if (!empty($validated['user_password_hash'])) {
            $validated['user_password_hash'] = Hash::make($validated['user_password_hash']);
        } else {
            unset($validated['user_password_hash']);
        }

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
            $this->logAction($request, CoreLog::class, 'update', 'User', "Aktualizace uživatele: {$user->user_email}", $user->id, 'User');
            return response()->json(new UserResource($user->load('roles.permissions')));

        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, CoreLog::class, 'error', 'User', "Chyba při updatu uživatele ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Chyba serveru při ukládání.'], 500);
        }
    }

    /**
     * Handles password changes with administrative validation requirements.
     * @note KRITICKÁ OCHRANA: cizí sysadmin účet smí heslo změnit jen jiný sysadmin.
     * Po úspěšné změně se VŽDY odešle PasswordChangedNotification s rate limitem.
     */
    public function changePassword(PasswordChangeRequest $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        try {
            $user = User::findOrFail($id);
            $validated = $request->validated();
            $auth = $request->user() ?? auth('sanctum')->user();

            $isOwner = $user->id === $auth->id;

            $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
            if ($targetIsSysadmin && !$isOwner) {
                $actorIsSysadmin = $auth->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
                if (!$actorIsSysadmin) {
                    $this->logAction($request, CoreLog::class, 'password_change_denied', 'User', "Zamítnut pokus o změnu hesla sysadmin účtu: {$user->user_email}", (int) $id, 'User');
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
                CoreLog::class,
                'PasswordChanged',
                'User',
                "Změna hesla u: {$user->user_email} " . ($isAdmin && !$isOwner ? "(provedl admin: {$auth->user_email})" : ""),
                $user->id,
                'User'
            );

            $this->notifyPasswordChanged($request, $user);

            return response()->json(['message' => 'Heslo úspěšně změněno.']);
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'User', "Chyba při změně hesla ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Změna hesla selhala.'], 500);
        }
    }

    /**
     * Restores a soft-deleted user.
     */
    public function restore(string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        try {
            $user = User::withTrashed()->findOrFail($id);
            $user->restore();

            $this->logAction(request(), CoreLog::class, 'restore', 'User', "Obnoven uživatel: {$user->user_email}", $user->id, 'User');
            return response()->json(new UserResource($user->load('roles.permissions')));
        } catch (\Exception $e) {
            $this->logAction(request(), CoreLog::class, 'error', 'User', "Chyba při obnově uživatele ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Obnova uživatele selhala.'], 500);
        }
    }

    /**
     * Handles soft or hard deletion of a user.
     * @note Uživatel nemůže smazat sám sebe. KRITICKÁ OCHRANA: účet s rolí 'sysadmin'
     * smí smazat výhradně jiný sysadmin.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        try {
            $user = User::withTrashed()->findOrFail($id);

            if ($request->user()?->id == $id) {
                return response()->json(['message' => 'Nelze smazat vlastní účet.'], 403);
            }

            $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();

            if ($targetIsSysadmin && !$this->actorIsSysadmin($request)) {
                $this->logAction($request, CoreLog::class, 'delete_denied', 'User', "Zamítnut pokus o smazání sysadmin účtu: {$user->user_email}", (int) $id, 'User');
                return response()->json(['message' => 'Účet s rolí sysadmin smí smazat pouze jiný sysadmin.'], 403);
            }

            $force = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $force ? $user->forceDelete() : $user->delete();

            $this->logAction($request, CoreLog::class, $force ? 'hard_delete' : 'soft_delete', 'User', "Smazáno ID: $id", (int) $id, 'User');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'User', "Chyba při mazání uživatele ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Smazání uživatele selhalo.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted users.
     * @note KRITICKÁ OCHRANA: trashnuté účty s rolí 'sysadmin' se z hromadného
     * vyprázdnění koše vyjímají, pokud sám volající není sysadmin.
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

            $this->logAction(request(), CoreLog::class, 'force_delete_all', 'User', "Vysypání koše. Smazáno: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction(request(), CoreLog::class, 'error', 'User', "Chyba při vysypávání koše uživatelů: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }

    /**
     * @description Odešle PasswordChangedNotification na účet, kterému se heslo právě
     * změnilo, chráněné per-cílový-účet rate limiterem proti zahlcení příjemce.
     */
    private function notifyPasswordChanged(Request $request, User $user): void
    {
        $notifyKey = 'password-change-notify:' . $user->id;

        if (RateLimiter::tooManyAttempts($notifyKey, self::PASSWORD_CHANGE_NOTIFY_MAX_ATTEMPTS)) {
            $this->logAction($request, CoreLog::class, 'password_notification_rate_limited', 'User', "Notifikace o změně hesla potlačena (limit) pro: {$user->user_email}", $user->id, 'User');
            return;
        }

        RateLimiter::hit($notifyKey, self::PASSWORD_CHANGE_NOTIFY_DECAY_SECONDS);

        try {
            Mail::to($user->user_email)->send(
                new PasswordChangedNotification($user, now()->format('d.m.Y H:i'))
            );
        } catch (\Throwable $e) {
            Log::error("Password changed notification failed for user {$user->id}: " . $e->getMessage());
        }
    }

    /**
     * @description Zjišťuje, jestli přihlášený uživatel z daného requestu má roli
     * sysadmin.
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
     */
    private function isSysadminRoleId(int $roleId): bool
    {
        return CoreRole::where('id', $roleId)
            ->where('role_name', self::SYSADMIN_ROLE_NAME)
            ->exists();
    }

    /**
     * @description Rozhoduje o výsledné hodnotě `enable_2fa` pro danou roli - pro
     * admin/sysadmin VŽDY vrátí `true` bez ohledu na `$requestedValue`.
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
}