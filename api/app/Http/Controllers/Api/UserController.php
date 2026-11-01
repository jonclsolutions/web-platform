<?php
/**
 * @file UserController.php
 * @path app/Http/Controllers/Api/UserController.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages user account lifecycles, including creation, role assignment,
 * explicit permission grants, password security policies, and administrative audit
 * logging.
 */

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
use App\Traits\LogsActivity;
use App\Http\Requests\User\{StoreUserRequest, UpdateUserRequest};
use App\Http\Requests\PasswordChangeRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\{Hash, Log, DB, Mail, RateLimiter};
use App\Traits\AppliesSafeSorting;
use App\Traits\RequiresPasswordConfirmation;

class UserController extends Controller
{
    use LogsActivity, AppliesSafeSorting, RequiresPasswordConfirmation;

    private const SYSADMIN_ROLE_NAME = 'sysadmin';
    private const PASSWORD_CHANGE_NOTIFY_MAX_ATTEMPTS = 5;
    private const PASSWORD_CHANGE_NOTIFY_DECAY_SECONDS = 3600;

    /**
     * @description Role names whose accounts can NEVER be blocked - an absolute
     * prohibition that applies even to sysadmin itself (project decision).
     */
    private const NEVER_BLOCK_ROLE_NAMES = ['sysadmin'];

       /**
     * @note Search does NOT cover `role_name` (the assigned role) - that would
     * require an always-active JOIN onto `user_roles`/`roles`, whereas today it is
     * only joined conditionally (when sorting by role_name, see the block below). If
     * searching by role is needed in the future, that is a separate extension
     * (permanent LEFT JOIN), not a trivial addition to the existing search block.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN)
                    || filter_var($request->input('is_deleted', false), FILTER_VALIDATE_BOOLEAN);

        [$sortBy, $dir] = $this->resolveSorting($request, 'users', 'id', 'desc', ['role_name']);

        $query = User::query()->withTrashed();

        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($request->filled('full_name')) $query->where('full_name', 'like', "%{$request->full_name}%");
        if ($request->filled('user_email')) $query->where('user_email', 'like', "%{$request->user_email}%");

        // Role filter.
        if ($request->filled('role_id')) {
            $query->whereHas('roles', function ($q) use ($request) {
                $q->where('core_roles.id', $request->input('role_id'));
            });
        }

        // Blocked/active filter.
        if ($request->filled('is_blocked')) {
            $query->where('is_blocked', filter_var($request->input('is_blocked'), FILTER_VALIDATE_BOOLEAN));
        }

        // Global fulltext search across full_name/user_email.
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                  ->orWhere('user_email', 'like', "%{$search}%");
            });
        }

        if ($sortBy === 'role_name') {
            $query->select('users.*')
                ->leftJoin('user_roles as ur', 'users.id', '=', 'ur.user_id')
                ->leftJoin('core_roles as r', 'ur.role_id', '=', 'r.id')
                ->orderBy('r.role_name', $dir);
        } else {
            $query->orderBy("users.$sortBy", $dir);
        }

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, CoreLog::class, 'export', 'User', "Bulk export of users.");
            $users = $query->with(['roles.permissions', 'explicitPermissions'])->get();
            return $this->respond(UserResource::collection($users));
        }

        $users = $query->with(['roles.permissions', 'explicitPermissions'])->paginate($perPage);

        return $this->respondPaginated($users, UserResource::class);
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

        // ── Email domain whitelist ──────
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

        // New sysadmin: step-up password confirmation (see the header, 2026-10-26).
        if ($roleId && $this->isSysadminRoleId((int) $roleId)
            && ($refusal = $this->requirePasswordConfirmation($request, 'user:new'))) {
            return $refusal;
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

            return $this->respond(
                new UserResource($user->load(['roles.permissions', 'explicitPermissions'])),
                201,
                ['activation_email_sent' => $emailSent]
            );
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

        return $this->respond(new UserResource($user->load(['roles.permissions', 'explicitPermissions'])));
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
     * way (otherwise the override would be pointless - 422). `is_blocked` may only be
     * CHANGED (blocked or unblocked) by a sysadmin (403) and can NEVER be set on a
     * sysadmin account nor on the caller's own account (422). The login e-mail of
     * ANOTHER account may only be changed by a sysadmin (403); everyone may still
     * change their own. A password can NOT be set through this method at all - see
     * `changePassword()`. Any actual
     * ROLE CHANGE unconditionally wipes all of the target's explicit permission
     * grants BEFORE `permission_ids` (if present) is applied. Transitioning to `is_blocked = true` revokes all
     * active tokens. `permission_ids` is applied via `applyExplicitPermissions()`,
     * which enforces that an actor can only grant/revoke permissions they
     * themselves effectively hold - a hard anti-privilege-escalation guard, not a
     * UX nicety, and cannot be bypassed by the frontend.
     * @note Nobody may change their OWN role, sysadmin included (422).
     * @note The e-mail access policy (`assertEmailDomainAllowed()`) is checked only
     * when the login e-mail actually CHANGES (422), for every caller including a
     * sysadmin. An account whose stored e-mail is no longer allowed can still be
     * edited as long as the e-mail stays the same.
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

        // ── Sysadmin-only changes on ANOTHER account
        // (2026-10-07). Both checks compare against the stored value, so a client that
        // sends the whole record back unchanged is not refused.
        $actorIsSysadmin = $this->actorIsSysadmin($request);
        $isSelfEdit = (int) $request->user()->id === (int) $user->id;

        // Login e-mail: whoever controls it controls the account (password reset and
        // 2FA codes are delivered there), so only a sysadmin may change someone else's.
        if (array_key_exists('user_email', $validated)
            && $validated['user_email'] !== $user->user_email
            && !$isSelfEdit
            && !$actorIsSysadmin) {
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Denied attempt to change another account's login e-mail (not sysadmin): {$user->user_email}", (int) $id, 'User');
            return response()->json(['message' => "Only sysadmin may change another account's login e-mail."], 403);
        }

        // Block / unblock: both directions. Unblocking matters as much as blocking -
        // otherwise a compromised account could simply unblock one that was just locked.
        if (array_key_exists('is_blocked', $validated)
            && (bool) $validated['is_blocked'] !== (bool) $user->is_blocked
            && !$actorIsSysadmin) {
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Denied attempt to block or unblock an account (not sysadmin): {$user->user_email}", (int) $id, 'User');
            return response()->json(['message' => 'Only sysadmin may block or unblock an account.'], 403);
        }

        // E-mail access policy: a NEW login e-mail must be allowed, whoever sets it
        // (sysadmin and self-edit included). Compared case-insensitively, so sending the
        // stored value back unchanged never triggers it - see the @note above.
        if (array_key_exists('user_email', $validated)
            && strcasecmp(trim((string) $validated['user_email']), (string) $user->user_email) !== 0) {
            $domainCheck = $this->assertEmailDomainAllowed($request, $validated['user_email'], 'update', (int) $id);
            if ($domainCheck instanceof JsonResponse) {
                return $domainCheck;
            }
        }

        // ── Role-change detection - captured BEFORE any mutation, using the ACTUAL
        // current role (not $effectiveRoleId below, which already folds in the
        // requested change and would make this comparison always false).
        //
        $oldRoleId = $user->roles()->first()?->id;
        $roleWillActuallyApply = $request->user()->id !== $user->id;
        $roleChanged = $roleWillActuallyApply
            && isset($validated['role_id'])
            && (int) $validated['role_id'] !== (int) $oldRoleId;

        // Own role: refused explicitly instead of being silently ignored, so the caller is
        // never told "saved" for a change that did not happen. Sending the current role back
        // unchanged (the admin form sends the whole record) is still fine.
        if (!$roleWillActuallyApply
            && isset($validated['role_id'])
            && (int) $validated['role_id'] !== (int) $oldRoleId) {
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Denied attempt to change own role: {$user->user_email}", (int) $id, 'User');
            return response()->json(['message' => 'You cannot change your own role.'], 422);
        }

        if ($roleChanged && !$this->actorCanAssignRole($request, (int) $validated['role_id'])) {
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Denied attempt to assign a role granting more than the actor's own permissions: {$user->user_email}", (int) $id, 'User');
            return response()->json(['message' => 'You cannot assign a role that grants permissions you do not yourself have.'], 403);
        }

        // ── 2FA enforcement (role) ─────────────────
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

        // ── two_fa_forced_by_admin (sysadmin override) ──
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

        // Editing / demoting a sysadmin or promoting to sysadmin: step-up password confirmation -
        // the last check, so a request refused for another reason does not ask for the password.
        if (($targetIsSysadmin || $promotingToSysadmin)
            && ($refusal = $this->requirePasswordConfirmation($request, "user:{$user->id}"))) {
            return $refusal;
        }

        $wasBlocked = (bool) $user->is_blocked;

        // permission_ids is handled separately via applyExplicitPermissions() - strip
        // it out of the mass-assignable payload before $user->update().
        $requestedPermissionIds = array_key_exists('permission_ids', $validated) ? $validated['permission_ids'] : null;
        unset($validated['permission_ids']);

        // A password is NEVER written by update()
        // (2026-10-07). The rule was removed from UpdateUserRequest; this unset is a
        // second line of defence in case the key ever reappears in the validated data.
        unset($validated['user_password_hash']);

        DB::beginTransaction();
        try {
            $user->update($validated);

            if (isset($validated['role_id'])) {
                if ($request->user()->id !== $user->id) {
                    $user->roles()->sync([$validated['role_id']]);
                }
            }

            // ── Role-change wipe. MUST
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

            if ($requestedPermissionIds !== null) {
                $this->applyExplicitPermissions($request, $user, $requestedPermissionIds, (int) $effectiveRoleId);
            }

            // Transition false -> true: IMMEDIATELY invalidate all active access,
            // otherwise a compromised account could keep using the system until its
            // access token expires on its own.
            if (!$wasBlocked && $user->is_blocked) {
                $user->tokens()->delete();
                RefreshToken::where('user_id', $user->id)->delete();
                $this->logAction($request, CoreLog::class, 'account_blocked', 'User', "Account blocked, active tokens invalidated: {$user->user_email}", $user->id, 'User');
            }

            DB::commit();
            $this->logAction($request, CoreLog::class, 'update', 'User', "User updated: {$user->user_email}", $user->id, 'User');
            return $this->respond(new UserResource($user->load(['roles.permissions', 'explicitPermissions'])));

        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, CoreLog::class, 'error', 'User', "Error updating user ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Server error while saving.'], 500);
        }
    }


    /**
     * Handles password changes with administrative validation requirements.
     * @note CRITICAL PROTECTION: everyone may change their OWN password; the password of
     * ANOTHER account may only be changed by a sysadmin (403 otherwise). In both cases the caller confirms with their own
     * current password. A success notification (PasswordChangedNotification) is ALWAYS
     * sent afterwards, rate-limited.
     */
    public function changePassword(PasswordChangeRequest $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Invalid user ID.'], 422);
        }

        $user = User::findOrFail($id);

        try {
            $validated = $request->validated();
            $auth = $request->user() ?? auth('sanctum')->user();

            $isOwner = $user->id === $auth->id;

            // Someone else's password: sysadmin only (covers sysadmin targets as well).
            if (!$isOwner) {
                $actorIsSysadmin = $auth->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
                if (!$actorIsSysadmin) {
                    $this->logAction($request, CoreLog::class, 'password_change_denied', 'User', "Denied attempt to change another account's password (not sysadmin): {$user->user_email}", (int) $id, 'User');
                    return response()->json(['message' => "Only sysadmin may change another account's password."], 403);
                }
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
                "Password changed for: {$user->user_email} " . (!$isOwner ? "(performed by sysadmin: {$auth->user_email})" : ""),
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

        $user = User::withTrashed()->findOrFail($id);

        // A restored sysadmin is a sysadmin again: step-up password confirmation (2026-10-26).
        if ($user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists()
            && ($refusal = $this->requirePasswordConfirmation(request(), "user:{$user->id}"))) {
            return $refusal;
        }

        try {
            $user->restore();

            $this->logAction(request(), CoreLog::class, 'restore', 'User', "Restored user: {$user->user_email}", $user->id, 'User');
            return $this->respond(new UserResource($user->load(['roles.permissions', 'explicitPermissions'])));
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

        $user = User::withTrashed()->findOrFail($id);

        try {
            if ($request->user()->id == $id) {
                return response()->json(['message' => 'You cannot delete your own account.'], 403);
            }

            $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();

            if ($targetIsSysadmin && !$this->actorIsSysadmin($request)) {
                $this->logAction($request, CoreLog::class, 'delete_denied', 'User', "Denied attempt to delete a sysadmin account: {$user->user_email}", (int) $id, 'User');
                return response()->json(['message' => 'Only another sysadmin may delete a sysadmin account.'], 403);
            }

            if ($targetIsSysadmin && ($refusal = $this->requirePasswordConfirmation($request, "user:{$user->id}"))) {
                return $refusal;
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
            } elseif ((clone $query)->whereHas('roles', fn ($q) => $q->where('role_name', self::SYSADMIN_ROLE_NAME))->exists()
                && ($refusal = $this->requirePasswordConfirmation(request(), 'users:trash'))) {
                // The trash holds a sysadmin: emptying it deletes that sysadmin for good (2026-10-26).
                return $refusal;
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
     */
    private function actorCanAssignRole(Request $request, int $roleId): bool
    {
        if ($this->actorIsSysadmin($request)) {
            return true;
        }

        $role = CoreRole::with('permissions')->findOrFail($roleId);

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
     * already carry.
     *
     * Any existing explicit grant on the target that falls OUTSIDE the actor's own
     * authority (i.e. was granted earlier by someone with broader permissions, most
     * likely sysadmin) is left untouched - the actor can only add/remove within the
     * slice of permission-space they themselves control. (On a ROLE CHANGE, `update()`
     * empties the pivot BEFORE calling this method, so this only applies when the role
     * stays the same.)
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
     * @description Verifies that an e-mail (new account, or a changed login e-mail)
     * matches the e-mail access policy - the rules themselves live in
     * `CoreEmailAccessRule::isEmailAllowed()`, shared with the login check in
     * AuthController. Denials are recorded as a security event and in the audit log.
     * @param Request $request The current request (actor, IP, audit log).
     * @param string $email The e-mail to check.
     * @param string $action 'create' (store) or 'update' (login e-mail change).
     * @param int|null $targetId Id of the edited account ('update' only).
     * @return JsonResponse|null `null` = allowed, otherwise a ready-made 422 response to return.
     */
    private function assertEmailDomainAllowed(Request $request, string $email, string $action = 'create', ?int $targetId = null): ?JsonResponse
    {
        if (CoreEmailAccessRule::isEmailAllowed($email)) {
            return null;
        }

        $emailLower = strtolower(trim($email));
        $atPosition = strrpos($emailLower, '@');
        $domain = $atPosition !== false ? substr($emailLower, $atPosition + 1) : '';

        CoreSecurityEvent::record(
            "user_{$action}_domain_not_whitelisted",
            'warning',
            $request->ip(),
            CoreSecurityEvent::contextFromRequest($request, [
                'attempted_email'  => $emailLower,
                'attempted_domain' => $domain,
            ])
        );

        if ($action === 'create') {
            $this->logAction($request, CoreLog::class, 'create_denied', 'User', "Denied attempt to create an account with a non-whitelisted e-mail domain: {$emailLower}");
        } else {
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Denied attempt to change a login e-mail to a non-whitelisted domain: {$emailLower}", $targetId, 'User');
        }

        // The domain is the caller's own input and the caller is an administrator, so
        // naming it here does not reveal the policy to an outsider.
        $purpose = $action === 'create' ? 'for creating new accounts' : 'as a login e-mail';

        return response()->json([
            'message' => "The e-mail domain \"{$domain}\" is not allowed {$purpose}. Contact sysadmin to add an exception.",
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
     * `forces_2fa=true` on a custom role (see CoreRole).
     */
    private function isRoleForced2fa(?int $roleId): bool
    {
        if (!$roleId) {
            return false;
        }

        $role = CoreRole::find($roleId);

        return $role !== null && (in_array($role->role_name, User::FORCED_2FA_ROLE_NAMES, true) || (bool) $role->forces_2fa);
    }
}