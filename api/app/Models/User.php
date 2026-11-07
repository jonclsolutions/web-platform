<?php
/**
 * @file User.php
 * @path app/Models/User.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Core User model representing authentication and profile data.
 */

namespace App\Models;

use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
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
    use HasApiTokens, Notifiable, SoftDeletes;

    /**
     * @description Role names for which 2FA is ALWAYS forced, regardless of any DB
     * column - the check is hardcoded in code so it cannot be bypassed by editing
     * data. Must match FORCED_2FA_ROLE_NAMES in personal-info.component.ts and
     * administrators.component.ts.
     */
    public const FORCED_2FA_ROLE_NAMES = ['sysadmin'];

    protected $fillable = [
        'user_email', 'user_password_hash', 'full_name',
        'dpp_hours_spent', 'internal_note', 'last_login_at',
        'enable_2fa', 'two_fa_forced_by_admin',
        'is_blocked', 'activated_at',
    ];

    protected $hidden = ['user_password_hash'];

    /**
     * @description Canonical form of a login e-mail: surrounding whitespace and invisible
     *   characters (new line, tab, NBSP, zero-width space, BOM) removed, lower case. Used by the
     *   mutator below and by every lookup (login, password reset), so the stored value and what
     *   the user types always compare equal.
     * @param string $email Raw e-mail.
     * @return string Normalized e-mail.
     */
    public static function normalizeEmail(string $email): string
    {
        return mb_strtolower(\Illuminate\Support\Str::trim($email));
    }

    /**
     * @description Every write of `user_email` is normalized (normalizeEmail()) - whatever path
     *   sets it (admin form, import, tinker), the column never holds a trailing new line or an
     *   upper-case variant. A value edited directly in the database is not covered - see the SQL
     *   migration 2026_10_26_normalize_user_emails.sql.
     * @param string|null $value Raw e-mail.
     * @return void
     */
    public function setUserEmailAttribute(?string $value): void
    {
        $this->attributes['user_email'] = $value === null ? null : self::normalizeEmail($value);
    }

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
     * user's role(s) already grant. Strictly additive - this relation cannot revoke a
     * permission the role itself grants.
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
     * login - see the priority order of the sources in the file header.
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