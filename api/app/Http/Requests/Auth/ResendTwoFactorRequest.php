<?php

/**
 * @file ResendTwoFactorRequest.php
 * @path app/Http/Requests/Auth/ResendTwoFactorRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validuje vstup pro znovuodeslání 2FA kódu.
 */

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ResendTwoFactorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'login_token' => ['required', 'string'],
        ];
    }
}