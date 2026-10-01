<?php

/**
 * @file ResendTwoFactorRequest.php
 * @path app/Http/Requests/Auth/ResendTwoFactorRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Input validation for re-sending the 2FA verification code.
 *
 * @refactor-note (2026-10-01) Comments translated to English; `login_token` gets an
 * upper length bound so oversized payloads are rejected before the token lookup.
 */

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description FormRequest for the "resend 2FA code" endpoint. Only checks the shape of
 *              the temporary `login_token` issued after a successful credentials step;
 *              its validity (existence, expiry, resend cooldown) is checked by the controller.
 * @note If the login_token has a fixed format (e.g. Str::random(64)), tighten the rule to
 *       `size:64` + `alpha_num:ascii` like ResetPasswordRequest.
 */
class ResendTwoFactorRequest extends FormRequest
{
    /**
     * @description Public endpoint (user is not signed in yet) - possession of a valid
     *              login_token is the authorisation and is checked in the controller.
     * @return bool Always true.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Validation rules.
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'login_token' => ['required', 'string', 'max:255'],
        ];
    }
}