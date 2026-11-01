<?php

/**
 * @file VerifyTwoFactorRequest.php
 * @path app/Http/Requests/Auth/VerifyTwoFactorRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validates the input of the 2FA step of the login.
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