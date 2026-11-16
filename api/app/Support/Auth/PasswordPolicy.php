<?php

/**
 * @file PasswordPolicy.php
 * @path app/Support/Auth/PasswordPolicy.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The one password policy of the admin accounts on the server (activation, reset,
 * own / admin change, first sysadmin of the console): 8–64 characters (Unicode code points,
 * Laravel `min` / `max` count with mb_strlen) with a letter, a digit and a symbol. The frontend
 * implements the same numbers in erp/src/app/shared/constants/password-policy.ts - keep the two in
 * step.
 * @note 64 characters (OWASP ASVS 2.1.2 / NIST SP 800-63B: allow at least 64) let a password
 * manager or a passphrase be used. bcrypt reads at most 72 bytes - a longer multi-byte password
 * is still compared on its first 72 bytes (at least 18 characters), which keeps it strong.
 * @dependencies
 * - Illuminate\Validation\Rules\Password: letters / numbers / symbols with Unicode classes.
 */

namespace App\Support\Auth;

use Illuminate\Validation\Rules\Password;

class PasswordPolicy
{
    /** Minimum length (code points). */
    public const MIN_LENGTH = 8;

    /** Maximum length (code points). */
    public const MAX_LENGTH = 64;

    /**
     * @description Validation rules of a new password (add 'required' / 'confirmed' by the caller).
     * @return array<int, mixed> ['string', 'max:64', Password rule].
     */
    public static function rules(): array
    {
        return [
            'string',
            'max:' . self::MAX_LENGTH,
            Password::min(self::MIN_LENGTH)->letters()->numbers()->symbols(),
        ];
    }

    /**
     * @description Short description of the policy for console prompts and messages.
     * @return string e.g. "8–64 characters, a letter, a digit and a symbol".
     */
    public static function description(): string
    {
        return self::MIN_LENGTH . '–' . self::MAX_LENGTH . ' characters, a letter, a digit and a symbol';
    }
}
