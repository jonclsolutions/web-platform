<?php

/**
 * @file PasswordResetTest.php
 * @path api/tests/Feature/Core/Auth/PasswordResetTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the public password reset: requesting the link (same answer
 *   for every e-mail, per-e-mail limit) and setting the new password with the token
 *   (validity, one-time use, session revocation, notification).
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core\Auth;

use App\Mail\Auth\PasswordChangedNotification;
use App\Mail\Auth\PasswordResetRequested;
use App\Models\PasswordResetToken;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/**
 * @description POST /api/forgot-password and POST /api/reset-password.
 */
class PasswordResetTest extends TestCase
{
    /** @var string The generic answer of forgot-password. */
    private const GENERIC = 'If an account with this email exists, a password reset link has been sent to it.';

    /** @var string A syntactically valid raw token (64 alphanumeric characters). */
    private const RAW_TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901';

    /** @var string A password that satisfies the policy. */
    private const NEW_PASSWORD = 'NewPass1!';

    /**
     * @description Creates a reset token for the account.
     * @param User $user Token owner.
     * @param array<string, mixed> $attributes Column overrides.
     * @return PasswordResetToken
     */
    private function resetToken(User $user, array $attributes = []): PasswordResetToken
    {
        return PasswordResetToken::create(array_merge([
            'user_id' => $user->id, 'token_hash' => hash('sha256', self::RAW_TOKEN), 'expires_at' => now()->addMinutes(15),
        ], $attributes));
    }

    /**
     * @description The e-mail must be a valid address.
     * @input POST forgot-password {email:'not-an-email'}.
     * @output 422 with an error for email.
     */
    public function test_forgot_validates_email(): void
    {
        $this->postJson('/api/forgot-password', ['email' => 'not-an-email'])
            ->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    /**
     * @description An unknown e-mail gets the generic answer and no mail (no enumeration).
     * @input POST forgot-password for an e-mail without account.
     * @output 200 generic message; nothing queued; password_reset_requested core log.
     */
    public function test_forgot_unknown_email_gets_generic_answer(): void
    {
        Mail::fake();

        $this->postJson('/api/forgot-password', ['email' => 'ghost@example.com'])
            ->assertOk()->assertJson(['message' => self::GENERIC]);

        Mail::assertNothingQueued();
        $this->assertCoreLog('password_reset_requested', 'ghost@example.com');
    }

    /**
     * @description An existing account gets a new token (older ones invalidated) and a
     *   queued e-mail with the frontend reset link; the e-mail is matched case-insensitively.
     * @input Account Jane@Example.com with an older token, POST forgot-password ' jane@example.com '.
     * @output 200 generic message; one token row; PasswordResetRequested queued with the link.
     */
    public function test_forgot_existing_account_queues_link(): void
    {
        Mail::fake();
        config(['app.frontend_url' => 'https://admin.example.com/']);
        $user = $this->user(['user_email' => 'Jane@Example.com']);
        $this->resetToken($user);

        $this->postJson('/api/forgot-password', ['email' => ' jane@example.com '])
            ->assertOk()->assertJson(['message' => self::GENERIC]);

        $token = PasswordResetToken::sole();
        $this->assertNotSame(hash('sha256', self::RAW_TOKEN), $token->token_hash);
        $this->assertTrue($token->expires_at->between(now()->addMinutes(14), now()->addMinutes(16)));
        Mail::assertQueued(PasswordResetRequested::class, function (PasswordResetRequested $mail) use ($token, $user) {
            $raw = substr($mail->resetUrl, strlen('https://admin.example.com/auth/reset-password?token='));
            return str_starts_with($mail->resetUrl, 'https://admin.example.com/auth/reset-password?token=')
                && hash('sha256', $raw) === $token->token_hash
                && $mail->expiresInMinutes === 15
                && $mail->hasTo($user->user_email);
        });
    }

    /**
     * @description After 3 requests for one e-mail the 4th is silently dropped - same answer,
     *   no mail, recorded as a security event.
     * @input 3 counted requests for the account's e-mail, then POST forgot-password.
     * @output 200 generic message; nothing queued; password_reset_email_rate_limited event + log.
     */
    public function test_forgot_is_limited_per_email(): void
    {
        Mail::fake();
        $user = $this->user();
        foreach (range(1, 3) as $i) {
            RateLimiter::hit('password-reset-email:' . $user->user_email, 900);
        }

        $this->postJson('/api/forgot-password', ['email' => $user->user_email])
            ->assertOk()->assertJson(['message' => self::GENERIC]);

        Mail::assertNothingQueued();
        $this->assertSame(0, PasswordResetToken::count());
        $this->assertSecurityEvent('password_reset_email_rate_limited');
        $this->assertCoreLog('password_reset_email_rate_limited', $user->user_email);
    }

    /**
     * @description The reset request is validated: token format, password policy, confirmation.
     * @input POST reset-password with a short token and a weak, unconfirmed password.
     * @output 422 with errors for token, password and password_confirmation.
     */
    public function test_reset_validates_input(): void
    {
        $this->postJson('/api/reset-password', ['token' => 'short', 'password' => 'weak'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['token', 'password', 'password_confirmation'])
            ->assertJsonPath('errors.token.0', 'The password reset link is invalid or has expired. Please request a new one.');
    }

    /**
     * @description An unknown token is refused and recorded.
     * @input POST reset-password with a well-formed token that does not exist.
     * @output 400; password_reset_token_invalid event; core log "invalid link".
     */
    public function test_reset_rejects_unknown_token(): void
    {
        $this->postJson('/api/reset-password', [
            'token' => self::RAW_TOKEN, 'password' => self::NEW_PASSWORD, 'password_confirmation' => self::NEW_PASSWORD,
        ])->assertStatus(400);

        $this->assertSecurityEvent('password_reset_token_invalid');
        $this->assertCoreLog('password_reset_failed', 'invalid link');
    }

    /**
     * @description A used (or expired) token is refused - one-time use.
     * @input Token with used_at set.
     * @output 400; core log "already been used or expired"; password unchanged.
     */
    public function test_reset_rejects_used_token(): void
    {
        $user = $this->user();
        $this->resetToken($user, ['used_at' => now()]);

        $this->postJson('/api/reset-password', [
            'token' => self::RAW_TOKEN, 'password' => self::NEW_PASSWORD, 'password_confirmation' => self::NEW_PASSWORD,
        ])->assertStatus(400);

        $this->assertCoreLog('password_reset_failed', 'already been used or expired');
        $this->assertTrue(Hash::check($this->defaultPassword, $user->fresh()->user_password_hash));
    }

    /**
     * @description A token of a deleted account is refused.
     * @input Valid token, account soft-deleted.
     * @output 400.
     */
    public function test_reset_rejects_token_of_deleted_account(): void
    {
        $user = $this->user();
        $this->resetToken($user);
        $user->delete();

        $this->postJson('/api/reset-password', [
            'token' => self::RAW_TOKEN, 'password' => self::NEW_PASSWORD, 'password_confirmation' => self::NEW_PASSWORD,
        ])->assertStatus(400);
    }

    /**
     * @description A valid token sets the new password, marks the token used, signs the
     *   account out everywhere, clears the per-e-mail limiter and queues a notification.
     * @input Valid token, account with an access and a refresh token and one counted request.
     * @output 200 {email}; new password works; no tokens left; PasswordChangedNotification queued.
     */
    public function test_reset_sets_new_password(): void
    {
        Mail::fake();
        $user = $this->user();
        $user->createToken('access-token');
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'r'), 'expires_at' => now()->addDay()]);
        RateLimiter::hit('password-reset-email:' . $user->user_email, 900);
        $token = $this->resetToken($user);

        $this->postJson('/api/reset-password', [
            'token' => self::RAW_TOKEN, 'password' => self::NEW_PASSWORD, 'password_confirmation' => self::NEW_PASSWORD,
        ])->assertOk()->assertJson(['data' => ['email' => $user->user_email]]);

        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $user->fresh()->user_password_hash));
        $this->assertNotNull($token->fresh()->used_at);
        $this->assertSame(0, PersonalAccessToken::count());
        $this->assertSame(0, RefreshToken::count());
        $this->assertSame(0, RateLimiter::attempts('password-reset-email:' . $user->user_email));
        Mail::assertQueued(PasswordChangedNotification::class, fn ($mail) => $mail->hasTo($user->user_email));
        $this->assertCoreLog('password_reset_completed');
    }
}
