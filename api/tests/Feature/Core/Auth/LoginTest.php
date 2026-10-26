<?php

/**
 * @file LoginTest.php
 * @path api/tests/Feature/Core/Auth/LoginTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of AuthController login, current user, logout and token refresh:
 *   credentials, captcha after repeated failures, blocked / not activated accounts, the
 *   e-mail access policy, the 2FA hand-off, token issuing and revocation.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core\Auth;

use App\Mail\Auth\TwoFactorCodeMail;
use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CoreSecuritySetting;
use App\Models\RefreshToken;
use App\Models\TwoFactorCode;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/**
 * @description POST /api/login, GET /api/user, POST /api/logout, POST /api/refresh.
 */
class LoginTest extends TestCase
{
    /**
     * @description Login without e-mail and password is rejected by validation.
     * @input POST /api/login {}
     * @output 422 with errors for email and password.
     */
    public function test_login_requires_email_and_password(): void
    {
        $this->postJson('/api/login', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    /**
     * @description Correct credentials of an account without 2FA issue an access and a
     *   refresh token, store the hashed refresh token, set last_login_at, clear the
     *   failed-attempt counter and write the audit log.
     * @input Activated account (role with one permission), POST /api/login with its password.
     * @output 200 with user, roles, permissions, token, refreshToken; one refresh_tokens row.
     */
    public function test_login_success_issues_tokens(): void
    {
        $user = $this->userWith(['core-administrators-view']);
        RateLimiter::hit('login-fail:' . $user->user_email);

        $response = $this->postJson('/api/login', ['email' => $user->user_email, 'password' => $this->defaultPassword])
            ->assertOk()
            ->assertJsonPath('message', 'Login successful!')
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.user_permissions', ['core-administrators-view']);

        $this->assertNotEmpty($response->json('data.token'));
        $refresh = $response->json('data.refreshToken');
        $this->assertSame(hash('sha256', $refresh), RefreshToken::where('user_id', $user->id)->value('token'));
        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertSame(0, RateLimiter::attempts('login-fail:' . $user->user_email));
        $this->assertCoreLog('login_success', $user->user_email);
    }

    /**
     * @description A wrong password returns 401, counts the failure, records the security
     *   event and the audit log; captcha is not yet required after the first failure.
     * @input Activated account, POST /api/login with a wrong password.
     * @output 401 {captcha_required:false}; login_failed event and core log.
     */
    public function test_wrong_password_counts_failure(): void
    {
        $user = $this->user();

        $this->postJson('/api/login', ['email' => $user->user_email, 'password' => 'wrong'])
            ->assertStatus(401)
            ->assertJson(['message' => 'Invalid credentials.', 'captcha_required' => false]);

        $this->assertSame(1, RateLimiter::attempts('login-fail:' . $user->user_email));
        $this->assertSecurityEvent('login_failed', 'warning');
        $this->assertCoreLog('login_failed');
    }

    /**
     * @description The failure that reaches the captcha threshold (3rd) flags a suspected
     *   brute force (critical event) and tells the client that captcha is now required.
     * @input Two counted failures for an unknown e-mail, then a third wrong login.
     * @output 401 {captcha_required:true}; login_brute_force_suspected (critical).
     */
    public function test_third_failure_flags_brute_force(): void
    {
        RateLimiter::hit('login-fail:nobody@example.com');
        RateLimiter::hit('login-fail:nobody@example.com');

        $this->postJson('/api/login', ['email' => 'Nobody@Example.com ', 'password' => 'x'])
            ->assertStatus(401)
            ->assertJsonPath('captcha_required', true);

        $this->assertSecurityEvent('login_brute_force_suspected', 'critical');
    }

    /**
     * @description After 3 failures a login without a captcha token is refused before the
     *   password is checked.
     * @input 3 counted failures, POST /api/login without captcha_token.
     * @output 422 {captcha_required:true}; login_captcha_failed event and core log.
     */
    public function test_captcha_required_after_threshold(): void
    {
        $user = $this->user();
        foreach (range(1, 3) as $i) {
            RateLimiter::hit('login-fail:' . $user->user_email);
        }

        $this->postJson('/api/login', ['email' => $user->user_email, 'password' => $this->defaultPassword])
            ->assertStatus(422)
            ->assertJson(['captcha_required' => true]);

        $this->assertSecurityEvent('login_captcha_failed');
        $this->assertCoreLog('login_captcha_failed');
        $this->assertNull($user->fresh()->last_login_at);
    }

    /**
     * @description With a captcha token the provider confirms, the login continues normally.
     * @input 3 counted failures, Turnstile faked as success, POST /api/login with captcha_token.
     * @output 200 with tokens.
     */
    public function test_valid_captcha_lets_login_continue(): void
    {
        Http::fake(['*' => Http::response(['success' => true])]);
        $user = $this->user();
        foreach (range(1, 3) as $i) {
            RateLimiter::hit('login-fail:' . $user->user_email);
        }

        $this->postJson('/api/login', [
            'email' => $user->user_email, 'password' => $this->defaultPassword, 'captcha_token' => 'ok-token',
        ])->assertOk()->assertJsonStructure(['data' => ['token', 'refreshToken']]);
    }

    /**
     * @description A blocked account is refused before the password is checked.
     * @input Blocked account, POST /api/login with the correct password.
     * @output 403; login_blocked_account event, login_blocked core log; no tokens.
     */
    public function test_blocked_account_cannot_log_in(): void
    {
        $user = $this->user(['is_blocked' => true]);

        $this->postJson('/api/login', ['email' => $user->user_email, 'password' => $this->defaultPassword])
            ->assertStatus(403)
            ->assertJsonPath('message', 'This account has been blocked. Please contact the administrator.');

        $this->assertSecurityEvent('login_blocked_account');
        $this->assertCoreLog('login_blocked');
        $this->assertSame(0, RefreshToken::count());
    }

    /**
     * @description An account that never set its password (pending activation) is refused.
     * @input Account with user_password_hash NULL, POST /api/login.
     * @output 403 "not yet activated".
     */
    public function test_not_activated_account_cannot_log_in(): void
    {
        $user = $this->user(['user_password_hash' => null, 'activated_at' => null]);

        $this->postJson('/api/login', ['email' => $user->user_email, 'password' => 'anything'])
            ->assertStatus(403)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'not yet activated'));
    }

    /**
     * @description An account whose e-mail is no longer allowed by the e-mail access policy
     *   cannot log in even with the right password - generic message, no tokens, no 2FA code.
     * @input Primary domain company.cz, account outside@other.cz (no sysadmin), correct password.
     * @output 403 generic message; login_email_not_allowed event, login_denied core log.
     */
    public function test_email_policy_refuses_login(): void
    {
        Mail::fake();
        CoreSecuritySetting::current()->update(['primary_email_domain' => 'company.cz']);
        $user = $this->user(['user_email' => 'outside@other.cz', 'enable_2fa' => true]);

        $this->postJson('/api/login', ['email' => $user->user_email, 'password' => $this->defaultPassword])
            ->assertStatus(403)
            ->assertJsonPath('message', 'Login is not allowed for this account. Please contact the administrator.');

        $this->assertSecurityEvent('login_email_not_allowed');
        $this->assertCoreLog('login_denied');
        Mail::assertNothingSent();
        $this->assertSame(0, TwoFactorCode::count());
    }

    /**
     * @description An e-mail whitelisted as an exception passes the policy.
     * @input Primary domain company.cz, rule (email) outside@other.cz, correct password.
     * @output 200 with tokens.
     */
    public function test_email_policy_exception_allows_login(): void
    {
        CoreSecuritySetting::current()->update(['primary_email_domain' => 'company.cz']);
        CoreEmailAccessRule::create(['type' => 'email', 'value' => 'outside@other.cz']);
        $user = $this->user(['user_email' => 'outside@other.cz']);

        $this->postJson('/api/login', ['email' => $user->user_email, 'password' => $this->defaultPassword])
            ->assertOk();
    }

    /**
     * @description The e-mail policy applies to the sysadmin role as well (2026-10-24 security
     *   fix - sysadmin was exempt): a sysadmin outside the allowed domains is refused like any
     *   account (403, no tokens, no 2FA code); a sysadmin of the primary domain logs in and its
     *   forced 2FA starts the challenge.
     * @input Primary domain company.cz; sysadmin root@other.cz; sysadmin root@company.cz; correct passwords.
     * @output 403 generic message + login_email_not_allowed, nothing mailed; then 200
     *   {requires_2fa:true, login_token}, code mailed, pending TwoFactorCode row.
     */
    public function test_email_policy_applies_to_sysadmin_too(): void
    {
        Mail::fake();
        CoreSecuritySetting::current()->update(['primary_email_domain' => 'company.cz']);
        $outside = $this->sysadmin(['user_email' => 'root@other.cz']);

        $this->postJson('/api/login', ['email' => $outside->user_email, 'password' => $this->defaultPassword])
            ->assertStatus(403)
            ->assertJsonPath('message', 'Login is not allowed for this account. Please contact the administrator.');
        $this->assertSecurityEvent('login_email_not_allowed');
        Mail::assertNothingSent();
        $this->assertSame(0, TwoFactorCode::count());

        $admin = $this->sysadmin(['user_email' => 'root@company.cz']);
        $response = $this->postJson('/api/login', ['email' => $admin->user_email, 'password' => $this->defaultPassword])
            ->assertOk()
            ->assertJson(['data' => ['requires_2fa' => true, 'expires_in' => TwoFactorCode::CODE_TTL_MINUTES * 60]]);

        $pending = TwoFactorCode::sole();
        $this->assertSame(hash('sha256', $response->json('data.login_token')), $pending->login_token_hash);
        $this->assertSame('127.0.0.1', $pending->ip_address);
        Mail::assertSent(TwoFactorCodeMail::class, fn ($mail) => $mail->hasTo($admin->user_email)
            && hash('sha256', $mail->code) === $pending->code_hash);
        $this->assertCoreLog('login_2fa_challenge_sent');
        $this->assertSame(0, RefreshToken::count());
    }

    /**
     * @description GET /api/user returns the signed-in account with roles and permissions.
     * @input Account whose role grants core-security-view, signed in.
     * @output 200 {user, user_roles, user_permissions}.
     */
    public function test_user_returns_current_account(): void
    {
        $user = $this->signIn($this->userWith(['core-security-view']));

        $this->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.user.user_email', $user->user_email)
            ->assertJsonPath('data.user_roles.0', $user->roles->first()->role_name)
            ->assertJsonPath('data.user_permissions', ['core-security-view']);
    }

    /**
     * @description A protected route without a token answers 401 JSON and records an
     *   unauthenticated access attempt.
     * @input GET /api/user without Authorization.
     * @output 401 {message:'Unauthenticated.'}; unauthenticated_access_attempt event.
     */
    public function test_user_requires_authentication(): void
    {
        $this->getJson('/api/user')->assertStatus(401)->assertJson(['message' => 'Unauthenticated.']);

        $this->assertSecurityEvent('unauthenticated_access_attempt', 'info');
    }

    /**
     * @description Logout revokes the current access token and the given refresh token.
     * @input Account with a real access token and a refresh token, POST /api/logout {refreshToken}.
     * @output 200; no personal_access_tokens / refresh_tokens rows left; logout core log.
     */
    public function test_logout_revokes_tokens(): void
    {
        $user = $this->user();
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'refresh-raw'), 'expires_at' => now()->addDay()]);

        $this->withHeaders($this->bearer($user))
            ->postJson('/api/logout', ['refreshToken' => 'refresh-raw'])
            ->assertOk()
            ->assertJson(['message' => 'Logout successful!']);

        $this->assertSame(0, PersonalAccessToken::count());
        $this->assertSame(0, RefreshToken::count());
        $this->assertCoreLog('logout', $user->user_email);
    }

    /**
     * @description Logout without a refresh token only revokes the access token.
     * @input Account with a real access token and a refresh token, POST /api/logout {}.
     * @output 200; the refresh token row stays.
     */
    public function test_logout_without_refresh_token(): void
    {
        $user = $this->user();
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'keep'), 'expires_at' => now()->addDay()]);

        $this->withHeaders($this->bearer($user))->postJson('/api/logout')->assertOk();

        $this->assertSame(0, PersonalAccessToken::count());
        $this->assertSame(1, RefreshToken::count());
    }

    /**
     * @description Refresh without a token is refused.
     * @input POST /api/refresh {}.
     * @output 401 "Refresh token is missing."
     */
    public function test_refresh_requires_token(): void
    {
        $this->postJson('/api/refresh')->assertStatus(401)->assertJson(['message' => 'Refresh token is missing.']);
    }

    /**
     * @description An unknown or expired refresh token is refused and recorded.
     * @input Expired refresh token of an existing account.
     * @output 401; refresh_token_invalid event (info).
     */
    public function test_refresh_rejects_expired_token(): void
    {
        $user = $this->user();
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'old'), 'expires_at' => now()->subMinute()]);

        $this->postJson('/api/refresh', ['refreshToken' => 'old'])
            ->assertStatus(401)
            ->assertJson(['message' => 'Invalid or expired token.']);

        $this->assertSecurityEvent('refresh_token_invalid', 'info');
    }

    /**
     * @description A refresh token of a (soft-)deleted account is refused.
     * @input Valid refresh token whose account was soft-deleted.
     * @output 401.
     */
    public function test_refresh_rejects_token_of_deleted_account(): void
    {
        $user = $this->user();
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'raw'), 'expires_at' => now()->addDay()]);
        $user->delete();

        $this->postJson('/api/refresh', ['refreshToken' => 'raw'])->assertStatus(401);
    }

    /**
     * @description A blocked account cannot refresh; its refresh token is deleted.
     * @input Valid refresh token of a blocked account.
     * @output 403; token row deleted; refresh_blocked_account event.
     */
    public function test_refresh_rejects_blocked_account(): void
    {
        $user = $this->user(['is_blocked' => true]);
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'raw'), 'expires_at' => now()->addDay()]);

        $this->postJson('/api/refresh', ['refreshToken' => 'raw'])->assertStatus(403);

        $this->assertSame(0, RefreshToken::count());
        $this->assertSecurityEvent('refresh_blocked_account');
    }

    /**
     * @description When the e-mail policy no longer allows the account, refresh revokes
     *   every token of the account (an older session cannot live on through refreshes).
     * @input Primary domain company.cz, account outside@other.cz with access + refresh token.
     * @output 403 generic message; no tokens left; refresh_email_not_allowed event.
     */
    public function test_refresh_enforces_email_policy(): void
    {
        $user = $this->user(['user_email' => 'outside@other.cz']);
        $user->createToken('access-token');
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'raw'), 'expires_at' => now()->addDay()]);
        CoreSecuritySetting::current()->update(['primary_email_domain' => 'company.cz']);

        $this->postJson('/api/refresh', ['refreshToken' => 'raw'])
            ->assertStatus(403)
            ->assertJsonPath('message', 'Login is not allowed for this account. Please contact the administrator.');

        $this->assertSame(0, RefreshToken::count());
        $this->assertSame(0, PersonalAccessToken::count());
        $this->assertSecurityEvent('refresh_email_not_allowed');
    }

    /**
     * @description A valid refresh token rotates: old refresh and access tokens are revoked,
     *   a new pair is issued.
     * @input Account with an access token and a valid refresh token.
     * @output 200 {token, refreshToken}; exactly one new refresh token and one access token.
     */
    public function test_refresh_rotates_tokens(): void
    {
        $user = $this->user();
        $user->createToken('access-token');
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'raw'), 'expires_at' => now()->addDay()]);

        $response = $this->postJson('/api/refresh', ['refreshToken' => 'raw'])->assertOk();

        $this->assertNotSame('raw', $response->json('data.refreshToken'));
        $this->assertSame(hash('sha256', $response->json('data.refreshToken')), RefreshToken::sole()->token);
        $this->assertSame(1, PersonalAccessToken::count());
        $this->assertTrue(PersonalAccessToken::findToken($response->json('data.token'))->expires_at->isFuture());
    }
}
