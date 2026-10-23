<?php

/**
 * @file AccountActivationTest.php
 * @path api/tests/Feature/Core/Auth/AccountActivationTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the public account activation (an account created by an
 *   administrator sets its own password through the e-mailed link).
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core\Auth;

use App\Models\AccountActivationToken;
use App\Models\Core\CoreSecurityEvent;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * @description GET and POST /api/account-activation/{token}.
 */
class AccountActivationTest extends TestCase
{
    /**
     * @description Creates a pending (not activated) account with an activation token.
     * @param array<string, mixed> $attributes Account column overrides.
     * @return array{0: User, 1: string} The account and the raw token.
     */
    private function pendingAccount(array $attributes = []): array
    {
        $user = $this->user(array_merge(['user_password_hash' => null, 'activated_at' => null], $attributes));

        return [$user, AccountActivationToken::issueFor($user)];
    }

    /**
     * @description A valid link shows whose account is being activated, without consuming it.
     * @input Pending account, GET with its raw token.
     * @output 200 {email, full_name}; token still stored.
     */
    public function test_show_returns_account_for_valid_token(): void
    {
        [$user, $raw] = $this->pendingAccount();

        $this->getJson("/api/account-activation/{$raw}")
            ->assertOk()
            ->assertExactJson(['email' => $user->user_email, 'full_name' => $user->full_name]);

        $this->assertSame(1, AccountActivationToken::count());
    }

    /**
     * @description An unknown token answers 410 and is recorded with reason not_found.
     * @input GET with a token that does not exist.
     * @output 410; account_activation_token_invalid event with reason not_found.
     */
    public function test_show_rejects_unknown_token(): void
    {
        $this->getJson('/api/account-activation/unknown')->assertStatus(410);

        $this->assertSecurityEvent('account_activation_token_invalid');
        $this->assertStringContainsString('not_found', CoreSecurityEvent::sole()->getRawOriginal('context_data'));
    }

    /**
     * @description An expired token answers 410 with reason expired.
     * @input Pending account whose token expired an hour ago.
     * @output 410; event context reason expired.
     */
    public function test_show_rejects_expired_token(): void
    {
        [, $raw] = $this->pendingAccount();
        AccountActivationToken::query()->update(['expires_at' => now()->subHour()]);

        $this->getJson("/api/account-activation/{$raw}")->assertStatus(410);

        $this->assertStringContainsString('expired', CoreSecurityEvent::sole()->getRawOriginal('context_data'));
    }

    /**
     * @description The link of a blocked account cannot be used.
     * @input Pending blocked account, GET with its token.
     * @output 403.
     */
    public function test_show_rejects_blocked_account(): void
    {
        [, $raw] = $this->pendingAccount(['is_blocked' => true]);

        $this->getJson("/api/account-activation/{$raw}")->assertStatus(403);
    }

    /**
     * @description Activation of a deleted account fails and removes the dead token.
     * @input Pending account soft-deleted, POST with its token.
     * @output 404; token deleted.
     */
    public function test_activate_rejects_deleted_account(): void
    {
        [$user, $raw] = $this->pendingAccount();
        $user->delete();

        $this->postJson("/api/account-activation/{$raw}", ['password' => 'Abcdef1!', 'password_confirmation' => 'Abcdef1!'])
            ->assertStatus(404);

        $this->assertSame(0, AccountActivationToken::count());
    }

    /**
     * @description Activation with an invalid token answers 410.
     * @input POST with an unknown token.
     * @output 410.
     */
    public function test_activate_rejects_unknown_token(): void
    {
        $this->postJson('/api/account-activation/unknown', ['password' => 'Abcdef1!', 'password_confirmation' => 'Abcdef1!'])
            ->assertStatus(410);
    }

    /**
     * @description A blocked account cannot be activated; the attempt is recorded.
     * @input Pending blocked account, POST with a valid password.
     * @output 403; account_activation_blocked_account event; password still NULL.
     */
    public function test_activate_rejects_blocked_account(): void
    {
        [$user, $raw] = $this->pendingAccount(['is_blocked' => true]);

        $this->postJson("/api/account-activation/{$raw}", ['password' => 'Abcdef1!', 'password_confirmation' => 'Abcdef1!'])
            ->assertStatus(403);

        $this->assertSecurityEvent('account_activation_blocked_account');
        $this->assertNull($user->fresh()->user_password_hash);
    }

    /**
     * @description The password must satisfy the policy and be confirmed.
     * @input POST with a weak password and a different confirmation.
     * @output 422 with errors for password and password_confirmation ("Passwords do not match.").
     */
    public function test_activate_validates_password(): void
    {
        [, $raw] = $this->pendingAccount();

        $this->postJson("/api/account-activation/{$raw}", ['password' => 'weak', 'password_confirmation' => 'other'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password', 'password_confirmation'])
            ->assertJsonPath('errors.password_confirmation.0', 'Passwords do not match.');
    }

    /**
     * @description A valid password activates the account and consumes every activation token.
     * @input Pending account, POST with a policy-compliant confirmed password.
     * @output 200; password hash set, activated_at set, no tokens left; account_activated log.
     */
    public function test_activate_sets_password(): void
    {
        [$user, $raw] = $this->pendingAccount();

        $this->postJson("/api/account-activation/{$raw}", ['password' => 'Abcdef1!', 'password_confirmation' => 'Abcdef1!'])
            ->assertOk()
            ->assertJson(['message' => 'Password has been set. You can now log in.']);

        $user->refresh();
        $this->assertTrue(Hash::check('Abcdef1!', $user->user_password_hash));
        $this->assertNotNull($user->activated_at);
        $this->assertSame(0, AccountActivationToken::count());
        $this->assertCoreLog('account_activated', $user->user_email);
    }
}
