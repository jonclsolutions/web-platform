<?php
/**
 * @file CoreRoleResource.php
 * @path app/Http/Resources/Core/CoreRoleResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Resource transformation for system roles.
 */

namespace App\Http\Resources\Core;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms CoreRole model data into a standardized JSON response for the frontend.
 */
class CoreRoleResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'role_name'     => $this->role_name,
            'description'   => $this->description,
            // Systémové role (sysadmin/admin) - needitovatelné a nesmazatelné.
            'is_protected'  => $this->isProtected(),
            // Kolik uživatelských účtů má tuto roli přiřazenou - použito pro ochranu proti smazání
            // role, která je v použití. Pokud nebyl načten withCount('users'), spočítá se on-demand.
            'users_count'   => $this->users_count ?? $this->users()->count(),
            // Pole klíčů přiřazených oprávnění - pro předvyplnění checkboxů v matici.
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