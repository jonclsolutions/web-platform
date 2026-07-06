<?php
/**
 * @file CorePermission.php
 * @path app/Models/Core/CorePermission.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model representing system-wide permissions.
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @description Manages individual permissions that can be assigned to roles.
 * 
 * @property int $id The unique identifier for the permission.
 * @property string $permission_key The unique slug/key for the permission.
 * @property string|null $description A description of what this permission allows.
 */
class CorePermission extends Model
{
    /**
     * @var bool Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'permission_key',
        'description'
    ];

    /**
     * Get the roles associated with this permission.
     *
     * @return BelongsToMany
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_permissions', 'permission_id', 'role_id', 'id', 'id');
    }
}