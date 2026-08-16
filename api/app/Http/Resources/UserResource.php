<?php
/**
 * @file UserResource.php
 * @path app/Http/Resources/UserResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Resource transformation for system users and administrative access.
 * @refactor-note (2026-08) Odstraněna legacy HR/osobní pole.
 * @refactor-note (2026-08-16) Přidáno pole `two_fa_forced_by_admin` (BACKLOG "captcha +
 * 2FA na mail", bod 4) - bez něj by frontend neviděl aktuální stav sysadmin override.
 */

namespace App\Http\Resources;

use App\Http\Resources\Core\CoreRoleResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $perms = $this->permissions;

        return [
            'id'                     => $this->id,
            'user_email'             => $this->user_email,
            'full_name'              => $this->full_name,
            'dpp_hours_spent'        => (int) $this->dpp_hours_spent,
            'enable_2fa'             => (bool) $this->enable_2fa,
            'two_fa_forced_by_admin' => (bool) $this->two_fa_forced_by_admin,
            'internal_note'          => $this->internal_note,
            'last_login_at'          => $this->last_login_at?->format('Y-m-d H:i:s'),
            'created_at'             => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'             => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at'             => $this->deleted_at?->format('Y-m-d H:i:s'),
            'role_id'                => $this->roles->first()?->id,
            'roles'                  => CoreRoleResource::collection($this->whenLoaded('roles')),
            'user_permissions'       => $perms,
            'permissions'            => $perms,
        ];
    }
}