<?php
/**
 * @file UpdateCoreRoleRequest.php
 * @path app/Http/Requests/Core/CoreRole/UpdateCoreRoleRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for updating an existing system role.
 * @refactor-note (2026-08-16) Přidána validace `forces_2fa` - viz CoreRole.php.
 */

namespace App\Http\Requests\Core\CoreRole;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $roleId = $this->route('id') ?? $this->route('role');
        $roleId = is_object($roleId) ? $roleId->id : $roleId;

        return [
            'role_name'   => 'required|string|max:50|unique:core_roles,role_name,' . $roleId . ',id',
            'description' => 'nullable|string|max:255',
            'forces_2fa'  => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'role_name.unique'   => 'Tato role již existuje.',
            'role_name.required' => 'Název role je povinný.',
        ];
    }
}