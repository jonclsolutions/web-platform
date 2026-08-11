<?php
/**
 * @file PasswordChangeRequest.php
 * @path app/Http/Requests/PasswordChangeRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for user password update operations.
 *
 * @refactor-note (2026-08) Sjednoceno na politiku hesla platnou napříč aplikací
 * (8-16 znaků, alespoň 1 písmeno, 1 číslice, 1 speciální znak) - viz odpovídající
 * frontend `password-policy.ts`. Dřív jen `min:8` bez dalších požadavků.
 */

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;

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
                'required', 'string', 'max:16', 'confirmed',
                Password::min(8)->letters()->numbers()->symbols(),
            ],
            'target_user_id' => ['sometimes', 'integer', 'exists:users,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'new_password.confirmed' => 'Zadaná hesla se neshodují.',
            'new_password.max'       => 'Heslo může mít maximálně 16 znaků.',
        ];
    }
}