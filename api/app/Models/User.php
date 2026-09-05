<?php
/**
 * @file User.php
 * @path app/Models/User.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Core User model representing authentication and profile data.
 * @refactor-note (2026-08) Removed legacy HR/personal columns. Added `enable_2fa`.
 * @refactor-note (2026-08-3) Removed `commission_rate` and `has_tax_declaration`.
 * @refactor-note (2026-08-16) BACKLOG "captcha + 2FA na mail": `requiresTwoFactor()`
 * now combines FOUR independent sources of truth (in priority order):
 * (1) role sysadmin - always forced, hardcoded, cannot be bypassed by editing data;
 * (2) any assigned role has `forces_2fa=true` (CoreRole - bulk enforcement for a
 *     custom role);
 * (3) `two_fa_forced_by_admin` - sysadmin override on a SPECIFIC account;
 * (4) `enable_2fa` - the user's own choice.
 * Added `two_fa_forced_by_admin` column (fillable/cast).
 * @refactor-note (2026-08-24) BACKLOG "workflow zakládání účtů z adminu": added
 * `is_blocked` (independent of activation - "is this account allowed to log in RIGHT
 * NOW?") and `activated_at` ("was the account ever bootstrapped by the user at all?" -
 * only filled once the password is set via AccountActivationController::activate()).
 * `user_password_hash` is now nullable - `null` means "account is pending
 * activation", checked explicitly in AuthController::login() BEFORE Auth::attempt().
 * @refactor-note (2026-09-02) BACKLOG "explicit user permissions + admin role
 * removal":
 * - The hardcoded 'admin' role has been retired entirely (see migration SQL
 *   001_explicit_user_permissions_and_admin_role_removal.sql). `sysadmin` is now
 *   the ONLY hardcoded role in the whole application. `FORCED_2FA_ROLE_NAMES` is
 *   narrowed to `['sysadmin']` accordingly - any account that previously relied on
 *   the hardcoded 'admin' 2FA enforcement now gets it via the migrated 'manager'
 *   role's `forces_2fa = 1` flag instead (a normal, editable role setting).
 * - New `explicitPermissions()` relation + `user_permissions` pivot table: a user
 *   can be granted permission keys directly, on top of whatever their role grants.
 *   There is NO revoke/override concept - explicit permissions are strictly
 *   additive. `getPermissionsAttribute()` now returns the UNION of
 *   `role.permissions` and `user.explicitPermissions` (deduplicated by
 *   `permission_key`), so every consumer of `$user->permissions` (most
 *   importantly `CheckPermission` middleware) is upgraded automatically without
 *   needing any change on its own.
 * - New `getUserPermissionsAttribute()` appended attribute exposes the user's
 *   OWN explicit grants (id + permission_key pairs) separately from the
 *   effective union, so the admin edit form can show/prefill "extra permissions"
 *   without also re-listing everything the role already grants.
 */

namespace App\Models;

use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @description Manages user credentials, profile information, and role-based access
 * control (RBAC), extended with per-user explicit permission grants.
 * @property string $full_name User's display name.
 * @property string|null $user_password_hash NULL until the user sets their own password via the activation link.
 * @property bool $enable_2fa Whether two-factor auth is enabled by the user's own choice.
 * @property bool $two_fa_forced_by_admin Whether a sysadmin forced 2FA on this specific account.
 * @property bool $is_blocked Whether login is currently disabled for this account (independent of activation).
 * @property \Illuminate\Support\Carbon|null $activated_at When the user first set their own password.
 * @property array $permissions Calculated EFFECTIVE permission keys (role permissions UNION explicit permissions).
 * @property array $user_permissions The user's OWN explicit permission grants only, as [{id, permission_key}, ...].
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * @description Role names for which 2FA is ALWAYS forced, regardless of any DB
     * column - the check is hardcoded in code so it cannot be bypassed by editing
     * data. Must match FORCED_2FA_ROLE_NAMES in personal-info.component.ts and
     * administrators.component.ts.
     * @refactor-note (2026-09-02) Narrowed to sysadmin-only - the 'admin' role no
     * longer exists (removed, see migration SQL). Any custom role, including the
     * 'manager' role that replaced 'admin', enforces 2FA via its own `forces_2fa`
     * column instead of being hardcoded here.
     */
    public const FORCED_2FA_ROLE_NAMES = ['sysadmin'];

    protected $fillable = [
        'user_email', 'user_password_hash', 'full_name',
        'dpp_hours_spent', 'internal_note', 'last_login_at',
        'enable_2fa', 'two_fa_forced_by_admin',
        'is_blocked', 'activated_at',
    ];

    protected $hidden = ['user_password_hash'];

    protected $appends = ['permissions', 'user_permissions'];

    protected $casts = [
        'last_login_at' => 'datetime',
        'enable_2fa' => 'boolean',
        'two_fa_forced_by_admin' => 'boolean',
        'is_blocked' => 'boolean',
        'activated_at' => 'datetime',
    ];

    public function getAuthPassword() { return $this->user_password_hash; }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(CoreRole::class, 'user_roles', 'user_id', 'role_id');
    }

    /**
     * @description Explicit, per-user permission grants IN ADDITION to whatever the
     * user's role(s) already grant. Strictly additive - there is no mechanism to use
     * this relation to revoke a permission the role itself grants (see project
     * decision log: "Odebírání permission, které roli náleží, se neřeší").
     * @return BelongsToMany
     */
    public function explicitPermissions(): BelongsToMany
    {
        return $this->belongsToMany(CorePermission::class, 'user_permissions', 'user_id', 'permission_id')
            ->withPivot('granted_by', 'created_at');
    }

    /**
     * @description Computes the user's EFFECTIVE permission keys: everything their
     * role(s) grant, unioned with whatever has been explicitly granted directly to
     * the account. This is the single source of truth consumed by
     * `CheckPermission` middleware and by every "does this user have permission X"
     * check across the app - callers never need to know that explicit grants exist.
     * @return array<int, string> Unique permission_key values.
     */
    public function getPermissionsAttribute(): array
    {
        $rolePermissions = $this->relationLoaded('roles')
            ? $this->roles->flatMap(fn ($role) => $role->permissions)
            : $this->roles()->with('permissions')->get()->flatMap(fn ($role) => $role->permissions);

        $explicit = $this->relationLoaded('explicitPermissions')
            ? $this->explicitPermissions
            : $this->explicitPermissions()->get();

        return $rolePermissions
            ->merge($explicit)
            ->pluck('permission_key')
            ->unique()
            ->values()
            ->toArray();
    }

    /**
     * @description Exposes the user's OWN explicit permission grants (not the
     * effective union) so the admin edit UI can display/prefill "extra permissions"
     * for this account without re-listing what the role already covers.
     * @return array<int, array{id: int, permission_key: string}>
     */
    public function getUserPermissionsAttribute(): array
    {
        $explicit = $this->relationLoaded('explicitPermissions')
            ? $this->explicitPermissions
            : $this->explicitPermissions()->get();

        return $explicit->map(fn ($permission) => [
            'id' => $permission->id,
            'permission_key' => $permission->permission_key,
        ])->values()->toArray();
    }

    /**
     * @description Computes whether the user must go through 2FA verification at
     * login - see priority order of sources in the file header refactor-note.
     * @return bool
     */
    public function requiresTwoFactor(): bool
    {
        $roles = $this->relationLoaded('roles') ? $this->roles : $this->roles()->get();

        if ($roles->pluck('role_name')->intersect(self::FORCED_2FA_ROLE_NAMES)->isNotEmpty()) {
            return true;
        }

        if ($roles->contains('forces_2fa', true)) {
            return true;
        }

        return (bool) $this->enable_2fa || (bool) $this->two_fa_forced_by_admin;
    }
}