<?php
/**
 * @file UserResource.php
 * @path app/Http/Resources/UserResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Resource transformation for system users and administrative access.
 */

namespace App\Http\Resources;

use App\Http\Resources\Core\CoreRoleResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms user profiles, including role-based permissions for frontend authorization.
 */
class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $perms = $this->permissions;

        return [
            'id'                    => $this->id,
            'user_email'            => $this->user_email,
            'contact_email'         => $this->contact_email,
            'full_name'             => $this->full_name,
            'birth_date'            => $this->birth_date?->format('Y-m-d'),
            'personal_id_num'       => $this->personal_id_num,
            'address'               => $this->address,
            'bank_account'          => $this->bank_account,
            'health_insurance'      => $this->health_insurance,
            'commission_rate'       => (int) $this->commission_rate,
            'dpp_hours_spent'       => (int) $this->dpp_hours_spent,
            'has_tax_declaration'   => (bool) $this->has_tax_declaration,
            'phone_number'          => $this->phone_number,
            'internal_note'         => $this->internal_note,
            'last_login_at'         => $this->last_login_at?->format('Y-m-d H:i:s'),
            'created_at'            => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'            => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at'            => $this->deleted_at?->format('Y-m-d H:i:s'),
            'role_id'               => $this->roles->first()?->id,
            'roles'                 => CoreRoleResource::collection($this->whenLoaded('roles')),
            'user_permissions'      => $perms,
            'permissions'           => $perms,
        ];
    }
}