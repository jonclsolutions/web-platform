<?php
/**
 * @file User.php
 * @path app/Models/User.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Core User model representing authentication and profile data.
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
 * * @property string $full_name User's display name.
 * @property array $core_permissions Calculated list of permission keys.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_email', 'contact_email', 'user_password_hash', 'full_name',
        'birth_date', 'personal_id_num', 'address', 'bank_account',
        'health_insurance', 'commission_rate', 'dpp_hours_spent',
        'has_tax_declaration', 'phone_number', 'internal_note', 'last_login_at',
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
        'birth_date' => 'date',
        'has_tax_declaration' => 'boolean',
    ];

    /**
     * Override the default password field.
     */
    public function getAuthPassword() { return $this->user_password_hash; }

    /**
     * Get the roles assigned to this user.
     * * @return BelongsToMany
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(CoreRole::class, 'user_roles', 'user_id', 'role_id');
    }

    /**
     * Get a flattened, unique list of all permission keys derived from assigned roles.
     * * @return array<int, string>
     */
    public function getPermissionsAttribute(): array
    {
        return $this->roles->flatMap(function ($role) {
            return $role->permissions;
        })->pluck('permission_key')->unique()->values()->toArray();
    }
}