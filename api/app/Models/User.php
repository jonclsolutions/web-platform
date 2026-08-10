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

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_email', 'user_password_hash', 'full_name',
        'dpp_hours_spent', 'internal_note', 'last_login_at',
        'enable_2fa',
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
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'last_login_at' => 'datetime',
        'enable_2fa' => 'boolean',
    ];

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
}