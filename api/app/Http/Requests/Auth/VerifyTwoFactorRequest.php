<?php

/**
 * @file VerifyTwoFactorRequest.php
 * @path app/Http/Requests/Auth/VerifyTwoFactorRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validuje vstup pro dokončení loginu 2FA kódem.
 */

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class VerifyTwoFactorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'login_token' => ['required', 'string'],
            'code'        => ['required', 'string', 'regex:/^[0-9]{6}$/'],
        ];
    }
}