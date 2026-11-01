<?php

/**
 * @file ForgotPasswordRequest.php
 * @path app/Http/Requests/Auth/ForgotPasswordRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Input validation for requesting a password reset (step 1).
 */

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description FormRequest for POST /forgot-password. Only checks the e-mail shape -
 *              account existence is deliberately NOT validated here (no `exists:` rule),
 *              because a different response for unknown e-mails would allow user
 *              enumeration. The controller always returns the same generic response.
 * @note Format errors (422) are fine to expose - they say nothing about any account.
 */
class ForgotPasswordRequest extends FormRequest
{
    /**
     * @description Public endpoint - no authorisation needed.
     * @return bool Always true.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Normalises the e-mail (trim + lower-case) before validation.
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge([
                'email' => \App\Models\User::normalizeEmail($this->input('email')),
            ]);
        }
    }

    /**
     * @description Validation rules.
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email:rfc,strict', 'max:255'],
        ];
    }
}