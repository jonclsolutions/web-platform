<?php

/**
 * @file PasswordPolicyTest.php
 * @path api/tests/Unit/Core/PasswordPolicyTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the password policy of the admin accounts (PasswordPolicy): length
 *   8–64 code points with a letter, a digit and a symbol.
 * @dependencies
 * - Tests\TestCase (validator of the application).
 */

namespace Tests\Unit\Core;

use App\Support\Auth\PasswordPolicy;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * @description App\Support\Auth\PasswordPolicy.
 */
class PasswordPolicyTest extends TestCase
{
    /**
     * @description Validates one password against the policy.
     * @param string $password Password.
     * @return bool True when valid.
     */
    private function passes(string $password): bool
    {
        return Validator::make(['password' => $password], ['password' => ['required', ...PasswordPolicy::rules()]])->passes();
    }

    /**
     * @description The limits: 8 and 64 characters pass, 7 and 65 do not; a long passphrase and a
     *   multi-byte password are counted in characters, not bytes.
     * @input 'Ab1!' padded to 7 / 8 / 64 / 65 characters; 60 × 'ž' + 'A1!x' (64 characters, 124 bytes).
     * @output false, true, true, false; true.
     */
    public function test_length_limits(): void
    {
        $this->assertFalse($this->passes(str_pad('Ab1!', 7, 'x')));
        $this->assertTrue($this->passes(str_pad('Ab1!', 8, 'x')));
        $this->assertTrue($this->passes(str_pad('Ab1!', 64, 'x')));
        $this->assertFalse($this->passes(str_pad('Ab1!', 65, 'x')));
        $this->assertTrue($this->passes(str_repeat('ž', 60) . 'A1!x'));
        $this->assertSame(64, PasswordPolicy::MAX_LENGTH);
    }

    /**
     * @description A letter, a digit and a symbol are required.
     * @input 'abcdefg1' (no symbol), 'abcdefg!' (no digit), '1234567!' (no letter).
     * @output false each time.
     */
    public function test_character_classes(): void
    {
        $this->assertFalse($this->passes('abcdefg1'));
        $this->assertFalse($this->passes('abcdefg!'));
        $this->assertFalse($this->passes('1234567!'));
    }

    /**
     * @description The console prompt describes the same limits.
     * @input PasswordPolicy::description().
     * @output '8–64 characters, a letter, a digit and a symbol'.
     */
    public function test_description(): void
    {
        $this->assertSame('8–64 characters, a letter, a digit and a symbol', PasswordPolicy::description());
    }
}
