<?php
/**
 * @file UserResource.php
 * @path app/Http/Resources/UserResource.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Transforms a User model into its public API representation, exposing
 * roles (with their permissions), the user's own explicit permission grants, and the
 * calculated effective permission set. `profileOnly()` returns only the profile fields - used
 * by the session answers of AuthController, which send the roles and the effective permissions
 * once at the top level (`user_roles`, `user_permissions`).
 * `internal_note` (the administrators' note about the account) is sent only to a sysadmin or an
 * account with `core-administrators-view` - never in the session answers, and not to an account
 * that reads its own record without that permission.
 * @dependencies App\Support\Images\UserAvatar (signed URL of the profile photo).
 */

namespace App\Http\Resources;

use App\Support\Images\UserAvatar;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /** @description Only the profile fields, without roles and permissions (see profileOnly()). */
    private bool $profileOnly = false;

    /** @description Permission that lets an account read the internal note of the accounts. */
    private const NOTE_PERMISSION = 'core-administrators-view';

    /** @description Request attribute caching whether the signed-in account may read internal notes. */
    private const NOTE_ACCESS_ATTRIBUTE = 'user_resource.internal_note_access';

    /**
     * @description Leaves out the roles, the explicit and the effective permissions.
     * @return static
     */
    public function profileOnly(): static
    {
        $this->profileOnly = true;

        return $this;
    }

    /**
     * @description Transform the resource into an array.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $profile = [
            'id' => $this->id,
            'user_email' => $this->user_email,
            'full_name' => $this->full_name,
            // Signed URL of the profile photo, null = the default image.
            'avatar_url' => UserAvatar::url($this->resource),
            'dpp_hours_spent' => $this->dpp_hours_spent,
            'enable_2fa' => (bool) $this->enable_2fa,
            'two_fa_forced_by_admin' => (bool) $this->two_fa_forced_by_admin,
            'is_blocked' => (bool) $this->is_blocked,
            'activated_at' => $this->activated_at,
            'last_login_at' => $this->last_login_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,
        ];

        if ($this->profileOnly) {
            return $profile;
        }

        if ($this->mayReadInternalNote($request)) {
            $profile['internal_note'] = $this->internal_note;
        }

        return $profile + [
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

    /**
     * @description Whether the signed-in account may read internal notes: the sysadmin or an account
     *   with NOTE_PERMISSION. Resolved once per request (a list resolves many resources).
     * @param Request $request Current request.
     * @return bool
     */
    private function mayReadInternalNote(Request $request): bool
    {
        if (!$request->attributes->has(self::NOTE_ACCESS_ATTRIBUTE)) {
            $viewer = $request->user();
            $allowed = $viewer !== null && (
                $viewer->roles()->where('role_name', 'sysadmin')->exists()
                || in_array(self::NOTE_PERMISSION, (array) ($viewer->permissions ?? []), true)
            );
            $request->attributes->set(self::NOTE_ACCESS_ATTRIBUTE, $allowed);
        }

        return (bool) $request->attributes->get(self::NOTE_ACCESS_ATTRIBUTE);
    }
}
