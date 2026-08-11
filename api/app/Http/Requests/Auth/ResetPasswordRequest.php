<?php

/**
 * @file ResetPasswordRequest.php
 * @path app/Http/Requests/Auth/ResetPasswordRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validace vstupu pro dokončení resetu hesla (krok 5) - token + nové heslo.
 *
 * @refactor-note (2026-08) `Password::min(10)->mixedCase()->numbers()` nahrazeno
 * sjednocenou politikou platnou všude v appce: `min(8)` + `max:16` + `letters()` (bez
 * požadavku na mixedCase) + `numbers()` + `symbols()`.
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
            'password'              => [
                'required', 'confirmed', 'max:16',
                Password::min(8)->letters()->numbers()->symbols(),
            ],
            'password_confirmation' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.confirmed' => 'Zadaná hesla se neshodují.',
            'password.max'       => 'Heslo může mít maximálně 16 znaků.',
        ];
    }
}