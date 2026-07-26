<?php
/**
 * @file StoreCoreRoleRequest.php
 * @path app/Http/Requests/Core/CoreRole/StoreCoreRoleRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for creating a new system role.
 */

namespace App\Http\Requests\Core\CoreRole;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for role creation requests.
 * @note Ensures that role names are unique within the system.
 */
class StoreCoreRoleRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        return [
            // Opraveno: skutečná tabulka je `core_roles`, ne `roles` (ta neexistuje -
            // způsobovalo to SQLSTATE[42S02] při každém pokusu o vytvoření role).
            'role_name'     => ['required', 'string', 'max:50', 'unique:core_roles,role_name'],
            'description'   => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'role_name.unique' => 'Tato role již existuje.',
            'role_name.required' => 'Název role je povinný.',
        ];
    }
}