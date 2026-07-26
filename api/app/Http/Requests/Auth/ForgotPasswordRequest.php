<?php

/**
 * @file ForgotPasswordRequest.php
 * @path app/Http/Requests/Auth/ForgotPasswordRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validace vstupu pro požadavek na reset hesla (krok 1).
 */

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ForgotPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // veřejný endpoint, autorizace zde neřešíme
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
        ];
    }
}