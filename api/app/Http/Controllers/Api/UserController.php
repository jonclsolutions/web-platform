<?php
/**
 * @file UserController.php
 * @path app/Http/Controllers/Api/UserController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages user account lifecycles, including creation, role assignment,
 * explicit permission grants, password security policies, and administrative audit
 * logging.
 * */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\Auth\AccountActivationMail;
use App\Mail\Auth\PasswordChangedNotification;
use App\Models\{AccountActivationToken, RefreshToken, User};
use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreSecurityEvent;
use App\Models\Core\CoreSecuritySetting;
use App\Traits\LogsActivity;
use App\Http\Requests\User\{StoreUserRequest, UpdateUserRequest};
use App\Http\Requests\PasswordChangeRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\{Hash, Log, DB, Mail, RateLimiter};

class UserController extends Controller
{
    use LogsActivity;

    private const SYSADMIN_ROLE_NAME = 'sysadmin';
    private const PASSWORD_CHANGE_NOTIFY_MAX_ATTEMPTS = 5;
    private const PASSWORD_CHANGE_NOTIFY_DECAY_SECONDS = 3600;

    /**
     * @description Role names whose accounts can NEVER be blocked - an absolute
     * prohibition that applies even to sysadmin itself (project decision).
     * @refactor-note (2026-09-02) Narrowed to sysadmin-only - the 'admin' role no
     * longer exists. Must match `User::FORCED_2FA_ROLE_NAMES`.
     */
    private const NEVER_BLOCK_ROLE_NAMES = ['sysadmin'];

       /**
     * @bugfix-note (2026-08-25) BACKLOG "hledat napříč vším": added a global `search`
     * parameter (OR across `full_name`/`user_email`) - the same two text columns this
     * method already filtered individually. `search` is wrapped in its own
     * `where(function ($q) { ... })` block - see CoreExternalLinkController for a
     * detailed explanation of why a bare `orWhere()` on the main `$query` builder is
     * dangerous (it would break the AND-composition with previous conditions,
     * specifically the `onlyTrashed()`/`withoutTrashed()` scoping from Eloquent
     * SoftDeletes here - without wrapping, `search` could return deleted/non-deleted
     * records outside the currently selected view).
     *
     * @note Search does NOT cover `role_name` (the assigned role) - that would
     * require an always-active JOIN onto `user_roles`/`roles`, whereas today it is
     * only joined conditionally (when sorting by role_name, see the block below). If
     * searching by role is needed in the future, that is a separate extension
     * (permanent LEFT JOIN), not a trivial addition to the existing search block.
     *
     * @bugfix-note (2026-09-08) KRITICKÝ BUG - filtr na roli (`role_id`) byl v UI
     * dostupný, ale tato metoda parametr `role_id` nikde nečetla, takže se v praxi
     * NIKDY neaplikoval - výsledek vždy obsahoval VŠECHNY uživatele bez ohledu na
     * zvolenou roli.
     *
     * @bugfix-note (2026-09-08v2) DRUHÝ, NEZÁVISLÝ BUG odhalený při ladění výše:
     * `whereHas('roles', ...)` použil špatný název tabulky (`'roles.id'`), zatímco
     * reálná tabulka za relací `User::roles()` je `core_roles` - způsobilo SQL chybu
     * "Unknown column 'roles.id'". Opraveno na `'core_roles.id'`. Souběžně
     * odhalen TŘETÍ, STARŠÍ bug ve frontendu (`administrators.config.ts`
     * `rebuildFormFields()`) - filtr posílal NÁZEV role (`role_id=sysadmin`), ne
     * číselné ID, protože `roleOptions.map(o => o.label)` stavěl plochý seznam
     * jmen místo `{value,label}` párů. To vysvětluje, proč se do where klauzule
     * dostal řetězec "sysadmin" místo čísla - viz administrators.config.ts
     * bugfix-note stejné datum pro opravu na straně frontendu.
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

        // Role filter - see bugfix-note above (previously silently ignored, then had
        // a wrong table name).
        if ($request->filled('role_id')) {
            $query->whereHas('roles', function ($q) use ($request) {
                $q->where('core_roles.id', $request->input('role_id'));
            });
        }

        // Blocked/active filter - see bugfix-note above.
        if ($request->filled('is_blocked')) {
            $query->where('is_blocked', filter_var($request->input('is_blocked'), FILTER_VALIDATE_BOOLEAN));
        }

        // Global fulltext search across full_name/user_email - see bugfix-note above.
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                  ->orWhere('user_email', 'like', "%{$search}%");
            });
        }

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
            $this->logAction($request, CoreLog::class, 'export', 'User', "Bulk export of users.");
            $users = $query->with(['roles.permissions', 'explicitPermissions'])->get();
            return response()->json(UserResource::collection($users));
        }

        $users = $query->with(['roles.permissions', 'explicitPermissions'])->paginate($perPage);

        return response()->json([
            'data' => UserResource::collection($users->items()),
            'total' => $users->total(),
            'per_page' => $users->perPage(),
            'current_page' => $users->currentPage(),
            'last_page' => $users->lastPage(),
        ]);
    }

    /**
     * Creates a new user WITHOUT a password and sends an activation e-mail so the user
     * can set their own password (no one, not even the admin, ever knows it).
     * @note CRITICAL PROTECTION: only a caller who is themselves sysadmin may create a
     * new account with the sysadmin role. E-mail domain is checked BEFORE this check -
     * see `assertEmailDomainAllowed()`. A caller may also only assign a role whose
     * permissions are within the caller's own effective permissions - see
     * `actorCanAssignRole()`.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // ── Email domain whitelist - see refactor-note (2026-08-25) in the header ──────
        $domainCheck = $this->assertEmailDomainAllowed($request, $validated['user_email']);
        if ($domainCheck instanceof JsonResponse) {
            return $domainCheck;
        }

        $roleId = $validated['role_id'] ?? null;

        if ($roleId && $this->isSysadminRoleId((int) $roleId) && !$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'create_denied', 'User', "Denied attempt to create a new sysadmin account: {$validated['user_email']}");
            return response()->json(['message' => 'Only another sysadmin may create a new account with the sysadmin role.'], 403);
        }

        if ($roleId && !$this->actorCanAssignRole($request, (int) $roleId)) {
            $this->logAction($request, CoreLog::class, 'create_denied', 'User', "Denied attempt to create an account with a role granting more than the actor's own permissions: {$validated['user_email']}");
            return response()->json(['message' => 'You cannot assign a role that grants permissions you do not yourself have.'], 403);
        }

        // permission_ids is handled separately after the user exists (pivot needs a
        // user_id) - strip it out of the mass-assignable payload here.
        $requestedPermissionIds = $validated['permission_ids'] ?? null;
        unset($validated['permission_ids']);

        DB::beginTransaction();
        try {
            $forced = $this->isRoleForced2fa($roleId);
            $validated['enable_2fa'] = $forced ? true : ($validated['enable_2fa'] ?? false);
            // two_fa_forced_by_admin cannot be set at creation time (a new account has
            // no history yet) - a sysadmin can set it in a follow-up update().
            unset($validated['two_fa_forced_by_admin']);

            // The account is created WITHOUT a password - the user sets their own via
            // the activation link (see AccountActivationController::activate()). Until
            // then, login is blocked at the AuthController::login() level
            // (user_password_hash IS NULL).
            $validated['user_password_hash'] = null;
            $validated['is_blocked'] = false;
            $validated['activated_at'] = null;

            $user = User::create($validated);

            if ($roleId) {
                $user->roles()->attach($roleId);
            }

            if ($requestedPermissionIds !== null) {
                $this->applyExplicitPermissions($request, $user, $requestedPermissionIds, (int) $roleId);
            }

            DB::commit();

            // The e-mail is sent AFTER the commit - a send failure (SMTP outage etc.)
            // must not roll back the account that was already created. The admin has a
            // row action "Activate" (resendActivation()) in case the e-mail gets lost,
            // expires, or fails to send right now - see $emailSent below, surfaced to
            // the frontend as a warning instead of a silent "success".
            $emailSent = $this->sendActivationEmail($user);

            $this->logAction(
                $request,
                CoreLog::class,
                'create',
                'User',
                "Created user (pending activation): {$user->user_email}" . (!$emailSent ? ' [ACTIVATION E-MAIL FAILED TO SEND]' : ''),
                $user->id,
                'User'
            );

            $response = new UserResource($user->load(['roles.permissions', 'explicitPermissions']));
            return response()->json($response->additional(['activation_email_sent' => $emailSent]), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, CoreLog::class, 'error', 'User', "Error creating user: " . $e->getMessage());
            return response()->json(['message' => 'Error creating user.'], 500);
        }
    }

    /**
     * Displays details for a specific user.
     */
    public function show(string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Invalid user ID.'], 422);
        }

        $user = User::withTrashed()->findOrFail($id);

        return response()->json(new UserResource($user->load(['roles.permissions', 'explicitPermissions'])));
    }

      /**
     * Updates an existing user's information.
     * @note CRITICAL PROTECTION: if the target account is sysadmin, OR the request
     * asks to promote the target to sysadmin, only a caller who is THEMSELVES
     * sysadmin may perform it. A caller may also only reassign a role whose
     * permissions are within the caller's own effective permissions - see
     * `actorCanAssignRole()`. `enable_2fa` cannot be explicitly turned off on
     * forced accounts/roles (422). `two_fa_forced_by_admin` may only be changed by a
     * sysadmin and only on accounts that do NOT already have 2FA forced some other
     * way (otherwise the override would be pointless - 422). `is_blocked` can NEVER
     * be set on a sysadmin account nor on the caller's own account (422). Any actual
     * ROLE CHANGE unconditionally wipes all of the target's explicit permission
     * grants BEFORE `permission_ids` (if present) is applied - see header
     * refactor-note (2026-09-06). Transitioning to `is_blocked = true` revokes all
     * active tokens. `permission_ids` is applied via `applyExplicitPermissions()`,
     * which enforces that an actor can only grant/revoke permissions they
     * themselves effectively hold - a hard anti-privilege-escalation guard, not a
     * UX nicety, and cannot be bypassed by the frontend.
     * @note The domain whitelist check does NOT apply here - it is exclusive to
     * account creation (`store()`), see backlog "existing accounts are not
     * retroactively revoked".
     */
    public function update(UpdateUserRequest $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Invalid user ID.'], 422);
        }

        $user = User::findOrFail($id);
        $validated = $request->validated();

        $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
        $promotingToSysadmin = isset($validated['role_id']) && !$targetIsSysadmin
            && $this->isSysadminRoleId((int) $validated['role_id']);

        if (($targetIsSysadmin || $promotingToSysadmin) && !$this->actorIsSysadmin($request)) {
            $reason = $targetIsSysadmin
                ? "Denied edit of sysadmin account: {$user->user_email}"
                : "Denied attempt to promote account to sysadmin: {$user->user_email}";
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', $reason, (int) $id, 'User');
            return response()->json(['message' => 'Only another sysadmin may edit, or promote an account to, the sysadmin role.'], 403);
        }

        // ── Role-change detection - captured BEFORE any mutation, using the ACTUAL
        // current role (not $effectiveRoleId below, which already folds in the
        // requested change and would make this comparison always false).
        //
        // @bugfix-note (2026-09-06) A self-edit NEVER actually changes the target's
        // role - see the pre-existing `$request->user()->id !== $user->id` guard
        // around `$user->roles()->sync(...)` further down, which silently skips the
        // sync when an actor edits their own account. `$roleWillActuallyApply`
        // reflects that same condition, so `$roleChanged` (used below both for the
        // authority check and for the explicit-permissions wipe) is FALSE whenever
        // no real role change is about to happen - previously it was computed only
        // from the submitted payload, so a self-edit that merely INCLUDED a
        // different `role_id` (which was always going to be silently ignored)
        // could still trigger the "wipe all explicit permissions" side effect below
        // even though the account's role never actually changed.
        $oldRoleId = $user->roles()->first()?->id;
        $roleWillActuallyApply = $request->user()->id !== $user->id;
        $roleChanged = $roleWillActuallyApply
            && isset($validated['role_id'])
            && (int) $validated['role_id'] !== (int) $oldRoleId;

        if ($roleChanged && !$this->actorCanAssignRole($request, (int) $validated['role_id'])) {
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Denied attempt to assign a role granting more than the actor's own permissions: {$user->user_email}", (int) $id, 'User');
            return response()->json(['message' => 'You cannot assign a role that grants permissions you do not yourself have.'], 403);
        }

        // ── 2FA enforcement (role) - see refactor-note in the header ─────────────────
        // @bugfix-note (2026-09-06) Uses $oldRoleId whenever the role change won't
        // actually apply (self-edit) - same principle as $roleChanged above. Without
        // this, a self-edit that merely INCLUDED a different (never-applied) role_id
        // would evaluate 2FA enforcement, the is_blocked protected-role check, and
        // applyExplicitPermissions()'s redundant-permission filtering against a role
        // the account doesn't actually end up with.
        $effectiveRoleId = $roleWillActuallyApply ? ($validated['role_id'] ?? $oldRoleId) : $oldRoleId;
        $forcedByRole = $this->isRoleForced2fa($effectiveRoleId);

        // Effective enforcement = role OR an existing sysadmin override (if the
        // request does not change two_fa_forced_by_admin, the existing DB value is
        // used).
        $effectiveAdminForced = array_key_exists('two_fa_forced_by_admin', $validated)
            ? (bool) $validated['two_fa_forced_by_admin']
            : (bool) $user->two_fa_forced_by_admin;

        $isForced = $forcedByRole || $effectiveAdminForced;

        if ($isForced && array_key_exists('enable_2fa', $validated) && !$validated['enable_2fa']) {
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Denied attempt to disable 2FA on a forced account: {$user->user_email}", (int) $id, 'User');
            return response()->json(['message' => 'Two-factor authentication cannot be disabled on this account - it is enforced.'], 422);
        }

        $validated['enable_2fa'] = $isForced ? true : ($validated['enable_2fa'] ?? $user->enable_2fa);

        // ── two_fa_forced_by_admin (sysadmin override) - see refactor-note in the header ──
        if (array_key_exists('two_fa_forced_by_admin', $validated)) {
            if (!$this->actorIsSysadmin($request)) {
                $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Denied attempt to change 2FA enforcement (not sysadmin): {$user->user_email}", (int) $id, 'User');
                return response()->json(['message' => 'Only sysadmin may change 2FA enforcement.'], 403);
            }

            if ($forcedByRole) {
                return response()->json(['message' => '2FA is automatically enforced for this role - a manual override is unnecessary and not allowed.'], 422);
            }
        } else {
            // Key was not present in the request at all - leave the existing value unchanged.
            unset($validated['two_fa_forced_by_admin']);
        }

        // ── is_blocked (account lock) - ABSOLUTE protection for sysadmin ───────────────
        // Checked BEFORE update() - we need to decide this before anything is written.
        if (array_key_exists('is_blocked', $validated) && $validated['is_blocked']) {
            if ((int) $request->user()->id === (int) $user->id) {
                return response()->json(['message' => 'You cannot block your own account.'], 422);
            }

            // Effective role after any change in this request (same logic as
            // $effectiveRoleId above, but explicitly through the role name for
            // readability).
            $effectiveRoleName = $effectiveRoleId ? CoreRole::find($effectiveRoleId)?->role_name : null;
            $currentRoleNames = $user->roles()->pluck('role_name');

            $isProtectedRole = in_array($effectiveRoleName, self::NEVER_BLOCK_ROLE_NAMES, true)
                || $currentRoleNames->intersect(self::NEVER_BLOCK_ROLE_NAMES)->isNotEmpty();

            if ($isProtectedRole) {
                $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Denied attempt to block a protected account: {$user->user_email}", (int) $id, 'User');
                return response()->json(['message' => 'Accounts with the sysadmin role can never be blocked.'], 422);
            }
        }

        $wasBlocked = (bool) $user->is_blocked;

        // permission_ids is handled separately via applyExplicitPermissions() - strip
        // it out of the mass-assignable payload before $user->update().
        $requestedPermissionIds = array_key_exists('permission_ids', $validated) ? $validated['permission_ids'] : null;
        unset($validated['permission_ids']);

        if (!empty($validated['user_password_hash'])) {
            $validated['user_password_hash'] = Hash::make($validated['user_password_hash']);
        } else {
            unset($validated['user_password_hash']);
        }

        DB::beginTransaction();
        try {
            $user->update($validated);

            if (isset($validated['role_id'])) {
                if ($request->user()->id !== $user->id) {
                    $user->roles()->sync([$validated['role_id']]);
                }
            }

            // ── Role-change wipe - see header refactor-note (2026-09-06). MUST
            // happen before applyExplicitPermissions() reads the account's current
            // explicit grants, otherwise it would treat pre-change grants as
            // "outside the actor's authority, leave untouched" and effectively
            // undo the wipe.
            if ($roleChanged) {
                $user->explicitPermissions()->sync([]);
                $this->logAction(
                    $request,
                    CoreLog::class,
                    'update',
                    'User',
                    "Role changed for {$user->user_email} - all explicit permission grants were reset to zero.",
                    $user->id,
                    'User'
                );
            }

            // @bugfix-note (2026-09-06) Uses $effectiveRoleId directly (already
            // resolved above to reflect the role the account will ACTUALLY end up
            // with, self-edit-aware) instead of re-preferring $validated['role_id'] -
            // the previous `$validated['role_id'] ?? $effectiveRoleId` expression
            // would silently reintroduce the same self-edit bug this whole patch
            // fixes, by feeding a never-applied role_id into the redundant-
            // permission filtering inside applyExplicitPermissions().
            if ($requestedPermissionIds !== null) {
                $this->applyExplicitPermissions($request, $user, $requestedPermissionIds, (int) $effectiveRoleId);
            }

            // Transition false -> true: IMMEDIATELY invalidate all active access,
            // otherwise a compromised account could keep using the system until its
            // access token expires on its own (see backlog decision on the purpose of
            // blocking).
            if (!$wasBlocked && $user->is_blocked) {
                $user->tokens()->delete();
                RefreshToken::where('user_id', $user->id)->delete();
                $this->logAction($request, CoreLog::class, 'account_blocked', 'User', "Account blocked, active tokens invalidated: {$user->user_email}", $user->id, 'User');
            }

            DB::commit();
            $this->logAction($request, CoreLog::class, 'update', 'User', "User updated: {$user->user_email}", $user->id, 'User');
            return response()->json(new UserResource($user->load(['roles.permissions', 'explicitPermissions'])));

        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, CoreLog::class, 'error', 'User', "Error updating user ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Server error while saving.'], 500);
        }
    }


    /**
     * Handles password changes with administrative validation requirements.
     * @note CRITICAL PROTECTION: another sysadmin's account password may only be
     * changed by a fellow sysadmin. A success notification (PasswordChangedNotification)
     * is ALWAYS sent afterwards, rate-limited.
     * @refactor-note (2026-09-02) Replaced the legacy hardcoded
     * `whereIn('role_name', ['admin', 'sysadmin'])` "is this caller an admin" check
     * with a permission-key check against the caller's EFFECTIVE permission set
     * (`core-administrators-update`, which already unions role + explicit grants -
     * see `User::getPermissionsAttribute()`). This was the last hardcoded reference
     * to the 'admin' role name in this controller.
     */
    public function changePassword(PasswordChangeRequest $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Invalid user ID.'], 422);
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
                    $this->logAction($request, CoreLog::class, 'password_change_denied', 'User', "Denied attempt to change a sysadmin account's password: {$user->user_email}", (int) $id, 'User');
                    return response()->json(['message' => "Only another sysadmin may change a sysadmin account's password."], 403);
                }
            }

            $canManageAdministrators = in_array('core-administrators-update', $auth->permissions ?? [], true);

            if (!$isOwner && !$canManageAdministrators) {
                return response()->json(['message' => 'Insufficient permissions.'], 403);
            }

            if (!isset($validated['old_password']) || !Hash::check($validated['old_password'], $auth->user_password_hash)) {
                return response()->json(['message' => 'Your confirmation (current) password is incorrect.'], 403);
            }

            $user->update(['user_password_hash' => Hash::make($validated['new_password'])]);

            $this->logAction(
                $request,
                CoreLog::class,
                'PasswordChanged',
                'User',
                "Password changed for: {$user->user_email} " . ($canManageAdministrators && !$isOwner ? "(performed by admin: {$auth->user_email})" : ""),
                $user->id,
                'User'
            );

            $this->notifyPasswordChanged($request, $user);

            return response()->json(['message' => 'Password changed successfully.']);
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'User', "Error changing password for ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Password change failed.'], 500);
        }
    }

    /**
     * Restores a soft-deleted user.
     */
    public function restore(string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Invalid user ID.'], 422);
        }

        try {
            $user = User::withTrashed()->findOrFail($id);
            $user->restore();

            $this->logAction(request(), CoreLog::class, 'restore', 'User', "Restored user: {$user->user_email}", $user->id, 'User');
            return response()->json(new UserResource($user->load(['roles.permissions', 'explicitPermissions'])));
        } catch (\Exception $e) {
            $this->logAction(request(), CoreLog::class, 'error', 'User', "Error restoring user ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Restoring user failed.'], 500);
        }
    }

    /**
     * Handles soft or hard deletion of a user.
     * @note A user cannot delete themselves. CRITICAL PROTECTION: an account with the
     * 'sysadmin' role may only be deleted by another sysadmin.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Invalid user ID.'], 422);
        }

        try {
            $user = User::withTrashed()->findOrFail($id);

            if ($request->user()?->id == $id) {
                return response()->json(['message' => 'You cannot delete your own account.'], 403);
            }

            $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();

            if ($targetIsSysadmin && !$this->actorIsSysadmin($request)) {
                $this->logAction($request, CoreLog::class, 'delete_denied', 'User', "Denied attempt to delete a sysadmin account: {$user->user_email}", (int) $id, 'User');
                return response()->json(['message' => 'Only another sysadmin may delete a sysadmin account.'], 403);
            }

            $force = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $force ? $user->forceDelete() : $user->delete();

            $this->logAction($request, CoreLog::class, $force ? 'hard_delete' : 'soft_delete', 'User', "Deleted ID: $id", (int) $id, 'User');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'User', "Error deleting user ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Deleting user failed.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted users.
     * @note CRITICAL PROTECTION: trashed accounts with the 'sysadmin' role are
     * excluded from a bulk trash-empty operation unless the caller is themselves
     * sysadmin.
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

            $this->logAction(request(), CoreLog::class, 'force_delete_all', 'User', "Trash emptied. Deleted: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction(request(), CoreLog::class, 'error', 'User', "Error emptying user trash: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }

    /**
     * @description Resends the activation e-mail (new token, old one becomes invalid) -
     * only for accounts that have never been activated. An account that already has a
     * password set (`activated_at` filled) could otherwise be bypassed this way -
     * hence the block below.
     */
    public function resendActivation(Request $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Invalid user ID.'], 422);
        }

        $user = User::findOrFail($id);

        if ($user->activated_at) {
            return response()->json(['message' => 'This account is already activated.'], 422);
        }

        $emailSent = $this->sendActivationEmail($user);

        if (!$emailSent) {
            $this->logAction($request, CoreLog::class, 'resend_activation_failed', 'User', "Resending activation e-mail failed: {$user->user_email}", $user->id, 'User');
            return response()->json(['message' => 'Sending the e-mail failed. Check the mail configuration and try again.'], 500);
        }

        $this->logAction($request, CoreLog::class, 'resend_activation', 'User', "Activation e-mail resent: {$user->user_email}", $user->id, 'User');

        return response()->json(['message' => 'The activation e-mail has been resent.']);
    }

    /**
     * @description Whether the acting user may assign the given role to a target
     * account - the SAME anti-privilege-escalation principle already applied to
     * explicit permission grants (see `applyExplicitPermissions()`), extended to
     * whole-role assignment: an actor may only hand out a role whose ENTIRE
     * permission set is already within their own effective permissions (role ∪
     * explicit - see `User::getPermissionsAttribute()`). Sysadmin is exempt, same
     * as everywhere else in this controller. Without this check, any account with
     * `core-administrators-update` could reassign a user (or, via `store()`, create
     * a new one) onto ANY role - including one with more permissions than the actor
     * themselves holds - a direct privilege-escalation path one level above the
     * explicit-permissions guard.
     * @refactor-note (2026-09-06) BACKLOG "who can change roles".
     */
    private function actorCanAssignRole(Request $request, int $roleId): bool
    {
        if ($this->actorIsSysadmin($request)) {
            return true;
        }

        $role = CoreRole::with('permissions')->find($roleId);
        if (!$role) {
            return false;
        }

        $rolePermissionKeys = $role->permissions->pluck('permission_key')->all();
        $actorPermissionKeys = $request->user()->permissions ?? [];

        return empty(array_diff($rolePermissionKeys, $actorPermissionKeys));
    }

    /**
     * @description Applies an explicit-permission request (`permission_ids`) to a
     * user's `user_permissions` pivot, protected by an anti-privilege-escalation
     * guard.
     *
     * SECURITY: an actor may only grant or revoke explicit permissions that they
     * THEMSELVES effectively hold (role ∪ their own explicit grants) - see
     * `User::getPermissionsAttribute()`. Sysadmin is exempt, matching how
     * `CheckPermission` middleware already treats sysadmin everywhere else. Without
     * this guard, any account with `core-administrators-update` could hand out
     * permissions it does not itself possess - a direct privilege-escalation path -
     * so this check is not optional and cannot be skipped by the caller.
     *
     * Permissions the TARGET's role already grants are silently filtered out before
     * saving: explicit grants only make sense for permissions the role does NOT
     * already carry (project decision log - "K roli půjde uživateli přidat volitelné
     * explicitní permissions navíc - jen ty, které role sama nemá").
     *
     * Any existing explicit grant on the target that falls OUTSIDE the actor's own
     * authority (i.e. was granted earlier by someone with broader permissions, most
     * likely sysadmin) is left untouched - the actor can only add/remove within the
     * slice of permission-space they themselves control. (Note: on an actual ROLE
     * CHANGE, `update()` wipes the pivot to empty BEFORE calling this method - see
     * header refactor-note (2026-09-06) - so this "leave untouched" behaviour only
     * ever applies when the role is NOT changing.)
     *
     * @param Request $request The current request (used for the acting user and audit log).
     * @param User $target The user whose explicit permissions are being updated.
     * @param array<int> $requestedPermissionIds Permission ids the caller wants the target to explicitly have.
     * @param int|null $targetRoleId The role_id the target will end up with, used to filter out redundant grants.
     * @return void
     */
    private function applyExplicitPermissions(Request $request, User $target, array $requestedPermissionIds, ?int $targetRoleId): void
    {
        $actor = $request->user();
        $actorIsSysadmin = $this->actorIsSysadmin($request);

        // The set of permission ids the actor is allowed to touch. Sysadmin may touch
        // anything; everyone else is limited to permission keys they themselves
        // effectively hold.
        if ($actorIsSysadmin) {
            $allowedPermissionIds = CorePermission::pluck('id')->all();
        } else {
            $actorPermissionKeys = $actor->permissions ?? [];
            $allowedPermissionIds = CorePermission::whereIn('permission_key', $actorPermissionKeys)->pluck('id')->all();
        }

        // Permissions the target's role already carries - explicit grants for these
        // would be redundant, so they are filtered out rather than stored.
        $rolePermissionIds = $targetRoleId
            ? CoreRole::find($targetRoleId)?->permissions()->pluck('core_permissions.id')->all() ?? []
            : [];

        $requestedWithinAuthority = array_values(array_intersect($requestedPermissionIds, $allowedPermissionIds));
        $requestedFinal = array_values(array_diff($requestedWithinAuthority, $rolePermissionIds));

        $existingExplicitIds = $target->explicitPermissions()->pluck('core_permissions.id')->all();
        $outsideActorAuthority = array_values(array_diff($existingExplicitIds, $allowedPermissionIds));

        // Final pivot state = (existing grants outside the actor's authority, left
        // untouched) UNION (whatever the actor is requesting, within their authority
        // and not already covered by the role).
        $finalIds = array_values(array_unique(array_merge($outsideActorAuthority, $requestedFinal)));

        $syncData = [];
        foreach ($finalIds as $permissionId) {
            $syncData[$permissionId] = ['granted_by' => $actor->id];
        }

        $target->explicitPermissions()->sync($syncData);

        $this->logAction(
            $request,
            CoreLog::class,
            'update',
            'User',
            "Explicit permissions updated for: {$target->user_email} (" . count($finalIds) . ' active grant(s))',
            $target->id,
            'User'
        );
    }

    /**
     * @description Generates a new activation token and sends the e-mail. A send
     * failure must NEVER fail the request that creates/re-activates the user (hence
     * the try/catch), but the caller (store()/resendActivation()) gets the return
     * value and reflects it in the response - no silent failure, the admin sees a
     * warning in the UI and can use the row action "Activate" (visible only for
     * non-activated accounts).
     */
    private function sendActivationEmail(User $user): bool
    {
        $rawToken = AccountActivationToken::issueFor($user);
        try {
            Mail::to($user->user_email)->send(new AccountActivationMail($user, $rawToken));
            return true;
        } catch (\Throwable $e) {
            Log::error("Activation email failed for user {$user->id}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * @description Verifies that a new account's e-mail matches the allowed domain
     * policy - see refactor-note (2026-08-25) in the header and backlog
     * "core-admin-email-domain-restriction". An empty/unset `primary_email_domain`
     * means "no restriction" (unchanged from before). Allowed if the e-mail matches
     * ANY of these conditions:
     * 1) the domain matches the company's primary domain,
     * 2) the domain is on the whitelist (`CoreEmailAccessRule` of type `domain`),
     * 3) the whole e-mail is on the whitelist as a specific exception (type `email`).
     * @return JsonResponse|null `null` = allowed, otherwise a ready-made 422 response to return.
     */
    private function assertEmailDomainAllowed(Request $request, string $email): ?JsonResponse
    {
        $primaryDomain = CoreSecuritySetting::current()->primary_email_domain;

        if (empty($primaryDomain)) {
            return null;
        }

        $emailLower = strtolower(trim($email));
        $atPosition = strrpos($emailLower, '@');
        $domain = $atPosition !== false ? substr($emailLower, $atPosition + 1) : '';

        if ($domain === strtolower(trim($primaryDomain))) {
            return null;
        }

        $domainWhitelisted = CoreEmailAccessRule::where('type', 'domain')
            ->where('value', $domain)
            ->exists();

        if ($domainWhitelisted) {
            return null;
        }

        $emailWhitelisted = CoreEmailAccessRule::where('type', 'email')
            ->where('value', $emailLower)
            ->exists();

        if ($emailWhitelisted) {
            return null;
        }

        CoreSecurityEvent::record(
            'user_create_domain_not_whitelisted',
            'warning',
            $request->ip(),
            CoreSecurityEvent::contextFromRequest($request, [
                'attempted_email'  => $emailLower,
                'attempted_domain' => $domain,
            ])
        );

        $this->logAction(
            $request,
            CoreLog::class,
            'create_denied',
            'User',
            "Denied attempt to create an account with a non-whitelisted e-mail domain: {$emailLower}"
        );

        return response()->json([
            'message' => "The e-mail domain \"{$domain}\" is not allowed for creating new accounts. Contact sysadmin to add an exception.",
        ], 422);
    }

    /**
     * @description Sends PasswordChangedNotification to the account whose password
     * was just changed, protected by a per-target rate limiter against flooding the
     * recipient.
     */
    private function notifyPasswordChanged(Request $request, User $user): void
    {
        $notifyKey = 'password-change-notify:' . $user->id;

        if (RateLimiter::tooManyAttempts($notifyKey, self::PASSWORD_CHANGE_NOTIFY_MAX_ATTEMPTS)) {
            $this->logAction($request, CoreLog::class, 'password_notification_rate_limited', 'User', "Password-change notification suppressed (rate limit) for: {$user->user_email}", $user->id, 'User');
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
     * @description Checks whether the logged-in user from the given request has the
     * sysadmin role.
     */
    private function actorIsSysadmin(Request $request): bool
    {
        return $request->user()
            ?->roles()
            ->where('role_name', self::SYSADMIN_ROLE_NAME)
            ->exists() ?? false;
    }

    /**
     * @description Checks whether the given role corresponds to the sysadmin role.
     */
    private function isSysadminRoleId(int $roleId): bool
    {
        return CoreRole::where('id', $roleId)
            ->where('role_name', self::SYSADMIN_ROLE_NAME)
            ->exists();
    }

    /**
     * @description Checks whether the given role forces 2FA - either because it is
     * sysadmin (hardcoded, see User::FORCED_2FA_ROLE_NAMES), or because sysadmin set
     * `forces_2fa=true` on a custom role (see CoreRole - backlog point 3).
     */
    private function isRoleForced2fa(?int $roleId): bool
    {
        if (!$roleId) {
            return false;
        }

        $role = CoreRole::find($roleId);
        if (!$role) {
            return false;
        }

        return in_array($role->role_name, User::FORCED_2FA_ROLE_NAMES, true) || (bool) $role->forces_2fa;
    }
}