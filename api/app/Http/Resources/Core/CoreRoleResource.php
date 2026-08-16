<?php
/**
 * @file CoreRoleResource.php
 * @path app/Http/Resources/Core/CoreRoleResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Resource transformation for system roles.
 * @refactor-note (2026-08-16) Přidáno pole `forces_2fa` - viz CoreRole.php.
 */

namespace App\Http\Resources\Core;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CoreRoleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'role_name'     => $this->role_name,
            'description'   => $this->description,
            'is_protected'  => $this->isProtected(),
            'forces_2fa'    => (bool) $this->forces_2fa,
            'users_count'   => $this->users_count ?? $this->users()->count(),
            'permissions'   => $this->whenLoaded(
                'permissions',
                fn () => $this->permissions->pluck('permission_key')->values(),
                []
            ),
            'created_at'    => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'    => $this->updated_at?->format('Y-m-d H:i:s'),
        ];
    }
}