<?php

/**
 * @file TwoFactorTest.php
 * @path api/tests/Feature/Core/Auth/TwoFactorTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the second login step: verifying the e-mailed 2FA code and
 *   resending it (session validity, attempt limit, resend cooldown and cap).
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core\Auth;

use App\Mail\Auth\TwoFactorCodeMail;
use App\Models\RefreshToken;
use App\Models\TwoFactorCode;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * @description POST /api/login/verify-2fa and POST /api/login/resend-2fa.
 */
class TwoFactorTest extends TestCase
{
    /** @var string Raw login token of the pending session created by pending(). */
    private const LOGIN_TOKEN = 'pending-login-token';

    /** @var string Raw code of the pending session created by pending(). */
    private const CODE = '123456';

    /**
     * @description Creates a pending-login 2FA session for the account.
     * @param User $user Account that passed the password step.
     * @param array<string, mixed> $attributes Column overrides.
     * @return TwoFactorCode
     */
    private function pending(User $user, array $attributes = []): TwoFactorCode
    {
        return TwoFactorCode::create(array_merge([
            'user_id'          => $user->id,
            'login_token_hash' => hash('sha256', self::LOGIN_TOKEN),
            'code_hash'        => hash('sha256', self::CODE),
            'attempts'         => 0,
            'resend_count'     => 0,
            'expires_at'       => now()->addMinutes(10),
            'last_sent_at'     => now(),
        ], $attributes));
    }

    /**
     * @description The code must be exactly 6 digits.
     * @input POST verify-2fa {login_token, code:'12ab'}.
     * @output 422 with an error for code.
     */
    public function test_verify_validates_code_format(): void
    {
        $this->postJson('/api/login/verify-2fa', ['login_token' => 'x', 'code' => '12ab'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    /**
     * @description An unknown login token is refused and recorded.
     * @input POST verify-2fa with a login token that has no pending session.
     * @output 401; login_2fa_session_invalid event (info).
     */
    public function test_verify_rejects_unknown_session(): void
    {
        $this->postJson('/api/login/verify-2fa', ['login_token' => 'nope', 'code' => self::CODE])
            ->assertStatus(401);

        $this->assertSecurityEvent('login_2fa_session_invalid', 'info');
    }

    /**
     * @description An expired pending session cannot be completed.
     * @input Pending session expired a minute ago, correct code.
     * @output 401.
     */
    public function test_verify_rejects_expired_session(): void
    {
        $this->pending($this->user(), ['expires_at' => now()->subMinute()]);

        $this->postJson('/api/login/verify-2fa', ['login_token' => self::LOGIN_TOKEN, 'code' => self::CODE])
            ->assertStatus(401);
    }

    /**
     * @description A wrong code increments the attempt counter and is recorded.
     * @input Pending session, wrong code.
     * @output 422 "Invalid verification code."; attempts 1; login_2fa_invalid event + core log.
     */
    public function test_verify_wrong_code_counts_attempt(): void
    {
        $pending = $this->pending($this->user());

        $this->postJson('/api/login/verify-2fa', ['login_token' => self::LOGIN_TOKEN, 'code' => '000000'])
            ->assertStatus(422)
            ->assertJson(['message' => 'Invalid verification code.']);

        $this->assertSame(1, $pending->fresh()->attempts);
        $this->assertSecurityEvent('login_2fa_invalid');
        $this->assertCoreLog('login_2fa_code_invalid');
    }

    /**
     * @description The wrong code that reaches the attempt limit ends the session.
     * @input Pending session with MAX_ATTEMPTS-1 attempts, wrong code.
     * @output 401 "Too many attempts"; session deleted; login_2fa_exhausted (critical).
     */
    public function test_verify_exhausts_session_at_limit(): void
    {
        $this->pending($this->user(), ['attempts' => TwoFactorCode::MAX_ATTEMPTS - 1]);

        $this->postJson('/api/login/verify-2fa', ['login_token' => self::LOGIN_TOKEN, 'code' => '000000'])
            ->assertStatus(401)
            ->assertJson(['message' => 'Too many attempts. Please log in again.']);

        $this->assertSame(0, TwoFactorCode::count());
        $this->assertSecurityEvent('login_2fa_exhausted', 'critical');
    }

    /**
     * @description A pending session whose account was deleted meanwhile is dropped.
     * @input Pending session, account soft-deleted, correct code.
     * @output 401 "Account not found."; session deleted.
     */
    public function test_verify_rejects_deleted_account(): void
    {
        $user = $this->user();
        $this->pending($user);
        $user->delete();

        $this->postJson('/api/login/verify-2fa', ['login_token' => self::LOGIN_TOKEN, 'code' => self::CODE])
            ->assertStatus(401)
            ->assertJson(['message' => 'Account not found.']);

        $this->assertSame(0, TwoFactorCode::count());
    }

    /**
     * @description An account blocked between the password step and the code step gets no tokens.
     * @input Pending session, account blocked, correct code.
     * @output 403; session deleted; no refresh token.
     */
    public function test_verify_rejects_account_blocked_meanwhile(): void
    {
        $user = $this->user();
        $this->pending($user);
        $user->update(['is_blocked' => true]);

        $this->postJson('/api/login/verify-2fa', ['login_token' => self::LOGIN_TOKEN, 'code' => self::CODE])
            ->assertStatus(403);

        $this->assertSame(0, TwoFactorCode::count());
        $this->assertSame(0, RefreshToken::count());
    }

    /**
     * @description The correct code completes the login: tokens issued, session consumed.
     * @input Pending session, correct code.
     * @output 200 {token, refreshToken, user}; session deleted.
     */
    public function test_verify_correct_code_issues_tokens(): void
    {
        $user = $this->user();
        $this->pending($user);

        $this->postJson('/api/login/verify-2fa', ['login_token' => self::LOGIN_TOKEN, 'code' => self::CODE])
            ->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonStructure(['data' => ['token', 'refreshToken']]);

        $this->assertSame(0, TwoFactorCode::count());
        $this->assertSame(1, RefreshToken::where('user_id', $user->id)->count());
    }

    /**
     * @description The full flow: login starts the challenge, the mailed code completes it.
     * @input Account with enable_2fa, POST /api/login, then verify-2fa with the mailed code.
     * @output 200 with tokens.
     */
    public function test_full_two_factor_flow(): void
    {
        Mail::fake();
        $user = $this->user(['enable_2fa' => true]);

        $loginToken = $this->postJson('/api/login', ['email' => $user->user_email, 'password' => $this->defaultPassword])
            ->assertOk()
            ->json('data.login_token');

        $code = null;
        Mail::assertSent(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code) {
            $code = $mail->code;
            return true;
        });

        $this->postJson('/api/login/verify-2fa', ['login_token' => $loginToken, 'code' => $code])
            ->assertOk()
            ->assertJsonStructure(['data' => ['token', 'refreshToken']]);
    }

    /**
     * @description Resend needs a login token.
     * @input POST resend-2fa {}.
     * @output 422 with an error for login_token.
     */
    public function test_resend_validates_login_token(): void
    {
        $this->postJson('/api/login/resend-2fa', [])->assertStatus(422)->assertJsonValidationErrors(['login_token']);
    }

    /**
     * @description Resend for an unknown or already used session is refused and recorded.
     * @input Pending session with used_at set.
     * @output 401; login_2fa_session_invalid event.
     */
    public function test_resend_rejects_used_session(): void
    {
        $this->pending($this->user(), ['used_at' => now()]);

        $this->postJson('/api/login/resend-2fa', ['login_token' => self::LOGIN_TOKEN])->assertStatus(401);

        $this->assertSecurityEvent('login_2fa_session_invalid');
    }

    /**
     * @description A new code cannot be requested within the cooldown.
     * @input Pending session sent 20 s ago.
     * @output 429 with retry_after ≈ 40 s.
     */
    public function test_resend_respects_cooldown(): void
    {
        $this->pending($this->user(), ['last_sent_at' => now()->subSeconds(20)]);

        $response = $this->postJson('/api/login/resend-2fa', ['login_token' => self::LOGIN_TOKEN])->assertStatus(429);

        $this->assertEqualsWithDelta(TwoFactorCode::RESEND_COOLDOWN_SECONDS - 20, $response->json('retry_after'), 2);
    }

    /**
     * @description After the maximum number of resends the session is ended.
     * @input Pending session with MAX_RESENDS resends, sent 2 minutes ago.
     * @output 429 "Too many code requests"; session deleted; login_2fa_resend_exhausted event.
     */
    public function test_resend_cap_ends_session(): void
    {
        $this->pending($this->user(), ['resend_count' => TwoFactorCode::MAX_RESENDS, 'last_sent_at' => now()->subMinutes(2)]);

        $this->postJson('/api/login/resend-2fa', ['login_token' => self::LOGIN_TOKEN])
            ->assertStatus(429)
            ->assertJson(['message' => 'Too many code requests. Please log in again.']);

        $this->assertSame(0, TwoFactorCode::count());
        $this->assertSecurityEvent('login_2fa_resend_exhausted');
    }

    /**
     * @description Resend for a session whose account was deleted drops the session.
     * @input Pending session sent 2 minutes ago, account soft-deleted.
     * @output 401 "Account not found."; session deleted.
     */
    public function test_resend_rejects_deleted_account(): void
    {
        $user = $this->user();
        $this->pending($user, ['last_sent_at' => now()->subMinutes(2)]);
        $user->delete();

        $this->postJson('/api/login/resend-2fa', ['login_token' => self::LOGIN_TOKEN])->assertStatus(401);

        $this->assertSame(0, TwoFactorCode::count());
    }

    /**
     * @description A resend issues a new code (old one invalid), resets the attempts,
     *   extends the expiry and mails the code.
     * @input Pending session with 2 attempts, sent 2 minutes ago.
     * @output 200; resend_count 1, attempts 0, new code_hash matching the mailed code.
     */
    public function test_resend_sends_new_code(): void
    {
        Mail::fake();
        $user = $this->user();
        $pending = $this->pending($user, ['attempts' => 2, 'last_sent_at' => now()->subMinutes(2)]);

        $this->postJson('/api/login/resend-2fa', ['login_token' => self::LOGIN_TOKEN])
            ->assertOk()
            ->assertJson(['data' => ['expires_in' => TwoFactorCode::CODE_TTL_MINUTES * 60]]);

        $pending->refresh();
        $this->assertSame(1, $pending->resend_count);
        $this->assertSame(0, $pending->attempts);
        Mail::assertSent(TwoFactorCodeMail::class, fn ($mail) => hash('sha256', $mail->code) === $pending->code_hash
            && $mail->hasTo($user->user_email));
        $this->assertCoreLog('login_2fa_code_resent');
    }
}
