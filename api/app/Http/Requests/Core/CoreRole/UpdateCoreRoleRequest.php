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
        // Retrieve ID from route parameter
        $role = $this->route('role');
        $roleId = is_object($role) ? $role->id : $role; 

        return [
            // Ensure uniqueness while ignoring the current record ID
            'role_name'   => 'required|string|max:50|unique:roles,role_name,' . $roleId . ',id',
            'description' => 'nullable|string|max:255',
        ];
    }
}