<?php
/**
 * @file UserResource.php
 * @path app/Http/Resources/UserResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Transforms a User model into its public API representation, exposing
 * roles (with their permissions), the user's own explicit permission grants, and the
 * calculated effective permission set.
 * @refactor-note (2026-09-02) BACKLOG "explicit user permissions": added
 * `user_permissions` (the account's own explicit grants, for prefilling the admin
 * edit form) alongside the pre-existing `permissions` (effective = role ∪ explicit,
 * used for authorization decisions on the frontend). Both are computed on the User
 * model itself (see `User::getPermissionsAttribute()` /
 * `User::getUserPermissionsAttribute()`), this resource just surfaces them.
 *
 * NOTE: this file reconstructs the resource class based on the fields observed in
 * use across administrators.config.ts / UserController audit log payloads. If the
 * project's actual UserResource already contains additional fields, merge this diff
 * into it rather than overwriting wholesale.
 */

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * @description Transform the resource into an array.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_email' => $this->user_email,
            'full_name' => $this->full_name,
            'dpp_hours_spent' => $this->dpp_hours_spent,
            'enable_2fa' => (bool) $this->enable_2fa,
            'two_fa_forced_by_admin' => (bool) $this->two_fa_forced_by_admin,
            'is_blocked' => (bool) $this->is_blocked,
            'activated_at' => $this->activated_at,
            'internal_note' => $this->internal_note,
            'last_login_at' => $this->last_login_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,

            // First (and, in this system, only) assigned role, plus its own
            // permission list - kept as an array for forward-compat with a possible
            // future multi-role model, even though today a user has exactly one.
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->map(fn ($role) => [
                'id' => $role->id,
                'role_name' => $role->role_name,
                'description' => $role->description,
                'forces_2fa' => (bool) $role->forces_2fa,
                'permissions' => $role->relationLoaded('permissions')
                    ? $role->permissions->map(fn ($p) => [
                        'id' => $p->id,
                        'permission_key' => $p->permission_key,
                    ])->values()
                    : [],
            ])),

            'user_permissions' => collect($this->user_permissions)->pluck('permission_key')->values(),

            // Effective permission keys (role ∪ explicit) - used for
            // frontend authorization/UI-gating decisions.
            'permissions' => $this->permissions,
        ];
    }
}