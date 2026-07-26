<?php
/**
 * @file SyncRolePermissionsRequest.php
 * @path app/Http/Requests/Core/CoreRole/SyncRolePermissionsRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for syncing a role's assigned permissions (matrix UI).
 */

namespace App\Http\Requests\Core\CoreRole;

use Illuminate\Foundation\Http\FormRequest;

class SyncRolePermissionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'permission_keys'   => ['present', 'array'],
            'permission_keys.*' => ['string', 'exists:core_permissions,permission_key'],
        ];
    }

    public function messages(): array
    {
        return [
            'permission_keys.*.exists' => 'Jedno nebo více vybraných oprávnění neexistuje.',
        ];
    }
}