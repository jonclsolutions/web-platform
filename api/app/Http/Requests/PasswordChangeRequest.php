<?php
/**
 * @file PasswordChangeRequest.php
 * @path app/Http/Requests/PasswordChangeRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for user password update operations.
 */

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;

/**
 * @description Handles request validation for changing a user's password, ensuring security and proper confirmation.
 */
class PasswordChangeRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool
    {
        return Auth::check();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        return [
            'old_password'   => ['required', 'string'],
            'new_password'   => ['required', 'string', 'min:8', 'confirmed'],
            'target_user_id' => ['sometimes', 'integer', 'exists:users,id'],
        ];
    }
}