<?php
/**
 * @file CoreRole.php
 * @path app/Models/Core/CoreRole.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Model representing user roles within the system.
 */

namespace App\Models\Core;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @description Defines roles that determine user access levels and permissions.
 *
 * @property int $id The unique identifier for the role.
 * @property string $role_name The display name of the role.
 * @property string|null $description Optional details about the role's purpose.
 * @property bool $forces_2fa Whether all users with this role must use 2FA.
 */
class CoreRole extends Model
{
    use SoftDeletes;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'role_name',
        'description',
        'forces_2fa',
    ];

    protected $casts = [
        'forces_2fa' => 'boolean',
    ];

    public const PROTECTED_ROLE_NAMES = ['sysadmin'];

    /**
     * @description Whether the role is a system role (protected from editing / deleting).
     * @return bool
     */
    public function isProtected(): bool
    {
        return in_array(strtolower($this->role_name), self::PROTECTED_ROLE_NAMES, true);
    }

    /**
     * Get the users assigned to this role.
     * @return BelongsToMany
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_roles', 'role_id', 'user_id');
    }

    /**
     * Get the permissions associated with this role.
     * @return BelongsToMany
     */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(
            CorePermission::class,
            'core_role_permissions',
            'role_id',
            'permission_id'
        );
    }
}