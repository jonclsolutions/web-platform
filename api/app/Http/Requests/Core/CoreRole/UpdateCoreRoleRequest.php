<?php
/**
 * @file UpdateCoreRoleRequest.php
 * @path app/Http/Requests/Core/CoreRole/UpdateCoreRoleRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for updating an existing system role.
 */

namespace App\Http\Requests\Core\CoreRole;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for role update requests.
 * @note Implements unique validation rule ignoring the current role ID.
 */
class UpdateCoreRoleRequest extends FormRequest
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
        // Opraveno: routy pro 'roles' mají parametr přejmenovaný na 'id'
        // (viz routes/api.php: ->parameters(['roles' => 'id'])), takže
        // $this->route('role') vždy vracelo null - unique pravidlo pak
        // neignorovalo žádný záznam a validace selhávala i při zachování
        // stejného názvu role (jen se měnil popis).
        $roleId = $this->route('id') ?? $this->route('role');
        $roleId = is_object($roleId) ? $roleId->id : $roleId;

        return [
            'role_name'   => 'required|string|max:50|unique:core_roles,role_name,' . $roleId . ',id',
            'description' => 'nullable|string|max:255',
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