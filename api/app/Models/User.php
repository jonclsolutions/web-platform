<?php
/**
 * @file User.php
 * @path app/Models/User.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Core User model representing authentication and profile data.
 *
 * @refactor-note (2026-08) Odstraněny legacy HR/osobní sloupce, které aktuální verze
 * systému nepotřebuje a nikdy nevyžaduje k vyplnění (`birth_date`, `personal_id_num`,
 * `address`, `bank_account`, `health_insurance`, `contact_email`, `phone_number`) - byla
 * to mock data bez reálného využití, viz SQL migrace. Přidán `enable_2fa` (zatím jen
 * příznak, reálná 2FA logika bude dořešena později) - `admin`/`sysadmin` ho mají VŽDY
 * `true`, vynuceno na backendu v `UserController` (store/update).
 *
 * @refactor-note (2026-08-3) Odstraněny i `commission_rate` a `has_tax_declaration` -
 * ověřeno, že na ně nikde jinde v appce neváže žádná reálná obchodní logika (žádný
 * SalesLead/Order kontroler s nimi nepočítá), byla to nepoužívaná HR pole stejně jako
 * ostatní odstraněné sloupce. `dpp_hours_spent` ZŮSTÁVÁ - nebylo součástí požadavku.
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
 * @property bool $enable_2fa Whether two-factor auth is enabled for this account.
 * @property array $core_permissions Calculated list of permission keys.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;


    public const FORCED_2FA_ROLE_NAMES = ['admin', 'sysadmin'];

    protected $fillable = [
        'user_email', 'user_password_hash', 'full_name',
        'dpp_hours_spent', 'internal_note', 'last_login_at',
        'enable_2fa', 'two_fa_forced_by_admin',
    ];

    protected $casts = [
        'last_login_at' => 'datetime',
        'enable_2fa' => 'boolean',
        'two_fa_forced_by_admin' => 'boolean',
    ];

    /**
     * @var array<int, string> The attributes that should be hidden for serialization.
     */
    protected $hidden = ['user_password_hash'];

    /**
     * @var array<int, string> The accessors to append to model's array form.
     */
    protected $appends = ['core_permissions'];



    /**
     * Override the default password field.
     */
    public function getAuthPassword() { return $this->user_password_hash; }

    /**
     * Get the roles assigned to this user.
     *
     * @return BelongsToMany
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(CoreRole::class, 'user_roles', 'user_id', 'role_id');
    }

    /**
     * Get a flattened, unique list of all permission keys derived from assigned roles.
     *
     * @return array<int, string>
     */
    public function getPermissionsAttribute(): array
    {
        return $this->roles->flatMap(function ($role) {
            return $role->permissions;
        })->pluck('permission_key')->unique()->values()->toArray();
    }

    /**
 * @description Vypočte, zda musí uživatel při loginu projít 2FA ověřením. Kombinuje
 * tři nezávislé zdroje pravdy (v pořadí priority): (1) role admin/sysadmin - vždy
 * vynuceno, (2) sysadmin override přes two_fa_forced_by_admin, (3) vlastní volba
 * uživatele enable_2fa.
 * @return bool
 */
public function requiresTwoFactor(): bool
{
    $roleNames = $this->relationLoaded('roles')
        ? $this->roles->pluck('role_name')
        : $this->roles()->pluck('role_name');

    if ($roleNames->intersect(self::FORCED_2FA_ROLE_NAMES)->isNotEmpty()) {
        return true;
    }

    return (bool) $this->enable_2fa || (bool) $this->two_fa_forced_by_admin;
}
}