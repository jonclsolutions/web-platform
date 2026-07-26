<?php

/**
 * @file ResetPasswordRequest.php
 * @path app/Http/Requests/Auth/ResetPasswordRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validace vstupu pro dokončení resetu hesla (krok 5) - token + nové heslo.
 */

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class ResetPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'token'                 => ['required', 'string'],
            'password'              => ['required', 'confirmed', Password::min(10)->mixedCase()->numbers()],
            'password_confirmation' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.confirmed' => 'Zadaná hesla se neshodují.',
        ];
    }
}