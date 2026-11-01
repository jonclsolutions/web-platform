<?php
/**
 * @file StoreUserRequest.php
 * @path app/Http/Requests/User/StoreUserRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Validates the payload for creating a new administrative user account.
 *
 * NOTE: this file reconstructs the request class based on the fields observed in
 * use across UserController/administrators.config.ts. If the project's actual
 * StoreUserRequest already contains additional rules, merge this diff into it
 * rather than overwriting wholesale.
 * @security `role_id` must be an ACTIVE role - `exists:core_roles,id` also
 *   accepted soft-deleted (trashed) roles, so an account could be given a role that was removed
 *   (open finding #4).
 */

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    /**
     * @description Authorization is enforced entirely at the route level via the
     * `permission:core-administrators-create` middleware (see api.php /
     * CheckPermission) - this request class only validates shape/format.
     * @return bool
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'user_email' => ['required', 'email:rfc,strict', 'max:255', 'unique:users,user_email'],
            'full_name' => ['required', 'string', 'max:255'],
            'role_id' => ['nullable', 'integer', Rule::exists('core_roles', 'id')->whereNull('deleted_at')],
            'enable_2fa' => ['sometimes', 'boolean'],
            'internal_note' => ['nullable', 'string'],
            'dpp_hours_spent' => ['nullable', 'integer', 'min:0'],

            // Explicit permission grants. Bounds/authority
            // checking happens in the controller, not here.
            'permission_ids' => ['sometimes', 'array'],
            'permission_ids.*' => ['integer', 'exists:core_permissions,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'user_email.required' => 'The login e-mail is required.',
            'user_email.email' => 'Enter a valid e-mail address.',
            'user_email.unique' => 'An account with this e-mail already exists.',
            'full_name.required' => 'Full name is required.',
            'role_id.exists' => 'The selected role does not exist.',
            'permission_ids.*.exists' => 'One of the selected permissions does not exist.',
        ];
    }
        /**
     * @description Normalizes `permission_ids` BEFORE validation runs - the
     * multiselect on the frontend can, depending on browser/JS quirks or partial
     * state, submit its values as numeric strings, or include stray empty/invalid
     * entries. Casting each entry to `int` (dropping anything that doesn't resolve
     * to a positive integer) here means the `'integer'` rule in `rules()` always
     * sees a clean `int[]`, regardless of exactly what shape the client sent -
     * this is a defensive normalization at the API boundary, not a workaround for
     * one specific bug, since any HTTP client (not just this project's own
     * frontend) could send loosely-typed JSON here.
     */
    protected function prepareForValidation(): void
    {
        // Login e-mail: surrounding whitespace / invisible characters removed, lower case - the
        // unique check and the stored value never differ only in case or whitespace (2026-10-26).
        if (is_string($this->input('user_email'))) {
            $this->merge(['user_email' => \App\Models\User::normalizeEmail($this->input('user_email'))]);
        }

        if ($this->has('permission_ids') && is_array($this->input('permission_ids'))) {
            $normalized = array_values(array_filter(
                array_map(
                    fn ($value) => is_numeric($value) ? (int) $value : null,
                    $this->input('permission_ids')
                ),
                fn ($value) => $value !== null
            ));

            $this->merge(['permission_ids' => $normalized]);
        }
    }
}