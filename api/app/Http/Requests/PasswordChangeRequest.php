<?php
/**
 * @file PasswordChangeRequest.php
 * @path app/Http/Requests/PasswordChangeRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation logic for user password update operations.
 */

namespace App\Http\Requests;

use App\Support\Auth\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;

/**
 * @description Handles request validation for changing a user's password, ensuring security and proper confirmation.
 */
class PasswordChangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Auth::check();
    }

    public function rules(): array
    {
        return [
            'old_password'   => ['required', 'string'],
            'new_password'   => [
                'required', 'confirmed', ...PasswordPolicy::rules(),
            ],
            'target_user_id' => ['sometimes', 'integer', 'exists:users,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'new_password.confirmed' => 'The passwords do not match.',
            'new_password.max'       => 'The password may not be greater than ' . PasswordPolicy::MAX_LENGTH . ' characters.',
        ];
    }
}