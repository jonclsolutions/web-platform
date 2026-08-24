<?php
/**
 * @file User.php
 * @path app/Models/User.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Core User model representing authentication and profile data.
 * @refactor-note (2026-08) Odstraněny legacy HR/osobní sloupce. Přidán `enable_2fa`.
 * @refactor-note (2026-08-3) Odstraněny `commission_rate` a `has_tax_declaration`.
 * @refactor-note (2026-08-16) BACKLOG "captcha + 2FA na mail": `requiresTwoFactor()`
 * nyní kombinuje ČTYŘI nezávislé zdroje pravdy (v pořadí priority):
 * (1) role admin/sysadmin - vždy vynuceno, hardcoded, nejde obejít úpravou dat;
 * (2) libovolná přiřazená role má `forces_2fa=true` (CoreRole - hromadné vynucení pro
 *     custom role, bod 3 backlogu);
 * (3) `two_fa_forced_by_admin` - sysadmin override na KONKRÉTNÍM účtu;
 * (4) `enable_2fa` - vlastní volba uživatele.
 * Přidán `two_fa_forced_by_admin` sloupec (fillable/cast).
 * @refactor-note (2026-08-24) BACKLOG "workflow zakládání účtů z adminu": přidány
 * `is_blocked` (nezávislý na aktivaci - "smí se PRÁVĚ TEĎ přihlásit?") a `activated_at`
 * ("byl účet vůbec kdy nastartovaný uživatelem?" - vyplní se až po nastavení hesla
 * přes AccountActivationController::activate()). `user_password_hash` je teď nullable -
 * `null` znamená "účet čeká na aktivaci", kontrolováno explicitně v
 * AuthController::login() PŘED Auth::attempt().
 */

namespace App\Models;

use App\Models\Core\CoreRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @description Manages user credentials, profile information, and role-based access control (RBAC).
 * @property string $full_name User's display name.
 * @property string|null $user_password_hash NULL dokud si uživatel přes aktivační odkaz nenastaví heslo.
 * @property bool $enable_2fa Whether two-factor auth is enabled by the user's own choice.
 * @property bool $two_fa_forced_by_admin Whether a sysadmin forced 2FA on this specific account.
 * @property bool $is_blocked Whether login is currently disabled for this account (independent of activation).
 * @property \Illuminate\Support\Carbon|null $activated_at When the user first set their own password.
 * @property array $core_permissions Calculated list of permission keys.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * @description Role names, pro které je 2FA vynuceno VŽDY, bez ohledu na jakýkoliv
     * DB sloupec - kontrola je hardcoded v kódu, aby ji nešlo obejít úpravou dat.
     * Musí sedět s FORCED_2FA_ROLES v personal-info.component.ts.
     */
    public const FORCED_2FA_ROLE_NAMES = ['admin', 'sysadmin'];

    protected $fillable = [
        'user_email', 'user_password_hash', 'full_name',
        'dpp_hours_spent', 'internal_note', 'last_login_at',
        'enable_2fa', 'two_fa_forced_by_admin',
        'is_blocked', 'activated_at',
    ];

    protected $hidden = ['user_password_hash'];

    protected $appends = ['core_permissions'];

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

    public function getPermissionsAttribute(): array
    {
        return $this->roles->flatMap(function ($role) {
            return $role->permissions;
        })->pluck('permission_key')->unique()->values()->toArray();
    }

    /**
     * @description Vypočte, zda musí uživatel při loginu projít 2FA ověřením - viz
     * priority zdrojů v refactor-note hlavičky souboru.
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