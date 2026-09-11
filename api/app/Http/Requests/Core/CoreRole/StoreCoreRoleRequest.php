<?php
/**
 * @file StoreCoreRoleRequest.php
 * @path app/Http/Requests/Core/CoreRole/StoreCoreRoleRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for creating a new system role.
 * @refactor-note (2026-08-16) Přidána validace `forces_2fa` - viz CoreRole.php.
 */

namespace App\Http\Requests\Core\CoreRole;

use Illuminate\Foundation\Http\FormRequest;

class StoreCoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'role_name'   => ['required', 'string', 'max:50', 'unique:core_roles,role_name'],
            'description' => ['nullable', 'string', 'max:255'],
            'forces_2fa'  => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'role_name.unique'   => 'This role already exists.',
            'role_name.required' => 'The role name is mandatory.',
        ];
    }
}