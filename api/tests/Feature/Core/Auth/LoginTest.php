<?php

/**
 * @file LoginTest.php
 * @path api/tests/Feature/Core/Auth/LoginTest.php
 * @project JS web-platform
 * @author JS
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
use App\Support\Auth\AuthCookies;
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
     * @description Correct credentials of an account without 2FA issue an access token (body)
     *   and a refresh token ONLY in the HttpOnly cookie, store the hashed refresh token, set
     *   last_login_at, clear the failed-attempt counter and write the audit log.
     * @input Activated account (role with one permission), POST /api/login with its password.
     * @output 200 with user, roles, permissions, token and no refreshToken; refresh cookie
     *   (HttpOnly, SameSite=Strict, Path /api/refresh) whose hash is the refresh_tokens row.
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
        $this->assertArrayNotHasKey('refreshToken', $response->json('data'));
        $refresh = $this->credentialCookie($response, AuthCookies::REFRESH, '/api/refresh')->getValue();
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
        ])->assertOk()->assertJsonStructure(['data' => ['token']])->assertCookie(AuthCookies::REFRESH, null, false);
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
     * @description The login finds the account whatever case / surrounding whitespace is typed,
     *   and an account saved with a stray new line (e.g. written by a script) is stored without it
     *   (User mutator, 2026-10-26).
     * @input Account created with user_email "Mixed@Example.com\n"; POST /api/login ' MIXED@example.COM '.
     * @output stored 'mixed@example.com'; 200 with tokens.
     */
    public function test_login_uses_the_normalized_email(): void
    {
        $user = $this->user(['user_email' => "Mixed@Example.com\n"]);
        $this->assertSame('mixed@example.com', $user->user_email);

        $this->postJson('/api/login', ['email' => ' MIXED@example.COM ', 'password' => $this->defaultPassword])
            ->assertOk()->assertJsonStructure(['data' => ['token']])->assertCookie(AuthCookies::REFRESH, null, false);
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
     * @description Logout ends the session of the user: every access token (other tabs shared
     *   the session) and the refresh token are revoked and the refresh cookie is deleted. Tokens
     *   of other users stay.
     * @input Account with two access tokens and a refresh token, another account's tokens; POST /api/logout.
     * @output 200; the user has no tokens left; the other account keeps its two rows; expired
     *   refresh cookie; logout core log.
     */
    public function test_logout_revokes_tokens(): void
    {
        $user = $this->user();
        $user->createToken('access-token');
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'refresh-raw'), 'expires_at' => now()->addDay()]);
        $other = $this->user();
        $other->createToken('access-token');
        RefreshToken::create(['user_id' => $other->id, 'token' => hash('sha256', 'other-raw'), 'expires_at' => now()->addDay()]);

        $response = $this->withHeaders($this->bearer($user))
            ->postJson('/api/logout')
            ->assertOk()
            ->assertJson(['message' => 'Logout successful!']);

        $this->assertSame(0, $user->tokens()->count());
        $this->assertSame(0, RefreshToken::where('user_id', $user->id)->count());
        $this->assertSame(1, $other->tokens()->count());
        $this->assertSame(1, RefreshToken::where('user_id', $other->id)->count());
        $this->assertCredentialCookieCleared($response, AuthCookies::REFRESH, '/api/refresh');
        $this->assertCoreLog('logout', $user->user_email);
    }

    /**
     * @description A refresh token sent in the body (the former API) is ignored - only the
     *   cookie counts, so a script that got hold of a token cannot use it this way.
     * @input Valid refresh token row, POST /api/refresh {refreshToken} without cookie.
     * @output 401 "Refresh token is missing."; the row stays.
     */
    public function test_refresh_ignores_a_token_in_the_body(): void
    {
        $user = $this->user();
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'raw'), 'expires_at' => now()->addDay()]);

        $this->postJson('/api/refresh', ['refreshToken' => 'raw'])->assertStatus(401)->assertJson(['message' => 'Refresh token is missing.']);
        $this->assertSame(1, RefreshToken::count());
    }

    /**
     * @description Refresh without the cookie is refused (and the cookie deleted).
     * @input POST /api/refresh without cookie.
     * @output 401 "Refresh token is missing."; expired refresh cookie.
     */
    public function test_refresh_requires_token(): void
    {
        $response = $this->postJson('/api/refresh')->assertStatus(401)->assertJson(['message' => 'Refresh token is missing.']);
        $this->assertCredentialCookieCleared($response, AuthCookies::REFRESH, '/api/refresh');
    }

    /**
     * @description An unknown or expired refresh token is refused, recorded and its cookie deleted.
     * @input Expired refresh token of an existing account (cookie).
     * @output 401; refresh_token_invalid event (info); expired refresh cookie.
     */
    public function test_refresh_rejects_expired_token(): void
    {
        $user = $this->user();
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'old'), 'expires_at' => now()->subMinute()]);

        $response = $this->withUnencryptedCookie(AuthCookies::REFRESH, 'old')->withCredentials()->postJson('/api/refresh')
            ->assertStatus(401)
            ->assertJson(['message' => 'Invalid or expired token.']);

        $this->assertSecurityEvent('refresh_token_invalid', 'info');
        $this->assertCredentialCookieCleared($response, AuthCookies::REFRESH, '/api/refresh');
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

        $this->withUnencryptedCookie(AuthCookies::REFRESH, 'raw')->withCredentials()->postJson('/api/refresh')->assertStatus(401);
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

        $response = $this->withUnencryptedCookie(AuthCookies::REFRESH, 'raw')->withCredentials()->postJson('/api/refresh')->assertStatus(403);

        $this->assertSame(0, RefreshToken::count());
        $this->assertSecurityEvent('refresh_blocked_account');
        $this->assertCredentialCookieCleared($response, AuthCookies::REFRESH, '/api/refresh');
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

        $response = $this->withUnencryptedCookie(AuthCookies::REFRESH, 'raw')->withCredentials()->postJson('/api/refresh')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Login is not allowed for this account. Please contact the administrator.');

        $this->assertCredentialCookieCleared($response, AuthCookies::REFRESH, '/api/refresh');
        $this->assertSame(0, RefreshToken::count());
        $this->assertSame(0, PersonalAccessToken::count());
        $this->assertSecurityEvent('refresh_email_not_allowed');
    }

    /**
     * @description A valid refresh cookie rotates: the old refresh token and the access token
     *   the tab sent are revoked, a new refresh cookie and access token are issued together with
     *   the profile, roles and permissions (the admin restores its session after a reload this
     *   way). Another valid access token of the user (another tab) stays, expired ones go.
     * @input Account with a sent access token, another valid one, an expired one and a refresh cookie.
     * @output 200 {token, user, user_roles, user_permissions} without refreshToken; new cookie
     *   (hash = the only refresh row); the sent and the expired token deleted; the other tab's
     *   token and the new one remain.
     */
    public function test_refresh_rotates_tokens(): void
    {
        $user = $this->userWith(['core-administrators-view']);
        $sent = $user->createToken('access-token', ['*'], now()->addHour())->plainTextToken;
        $otherTab = $user->createToken('access-token', ['*'], now()->addHour())->accessToken;
        $expired = $user->createToken('access-token', ['*'], now()->subMinute())->accessToken;
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'raw'), 'expires_at' => now()->addDay()]);

        $response = $this->withUnencryptedCookie(AuthCookies::REFRESH, 'raw')->withCredentials()
            ->withHeaders(['Authorization' => 'Bearer ' . $sent])
            ->postJson('/api/refresh')
            ->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.user_permissions', ['core-administrators-view']);

        $this->assertArrayNotHasKey('refreshToken', $response->json('data'));
        $newRefresh = $this->credentialCookie($response, AuthCookies::REFRESH, '/api/refresh')->getValue();
        $this->assertNotSame('raw', $newRefresh);
        $this->assertSame(hash('sha256', $newRefresh), RefreshToken::sole()->token);

        $this->assertNull(PersonalAccessToken::findToken($sent));
        $this->assertNull(PersonalAccessToken::find($expired->id));
        $this->assertNotNull(PersonalAccessToken::find($otherTab->id));
        $this->assertTrue(PersonalAccessToken::findToken($response->json('data.token'))->expires_at->isFuture());
        $this->assertSame(2, PersonalAccessToken::count());
    }

    /**
     * @description A Bearer token of ANOTHER user sent with the refresh is not revoked.
     * @input Refresh cookie of user A, Authorization of user B.
     * @output 200; B's token still exists.
     */
    public function test_refresh_keeps_a_foreign_access_token(): void
    {
        $user = $this->user();
        $foreign = $this->user()->createToken('access-token', ['*'], now()->addHour())->plainTextToken;
        RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', 'raw'), 'expires_at' => now()->addDay()]);

        $this->withUnencryptedCookie(AuthCookies::REFRESH, 'raw')->withCredentials()
            ->withHeaders(['Authorization' => 'Bearer ' . $foreign])
            ->postJson('/api/refresh')
            ->assertOk();

        $this->assertNotNull(PersonalAccessToken::findToken($foreign));
    }

    /**
     * @description The credential cookie is Secure with SESSION_SECURE_COOKIE (production
     *   .env) and the refresh route is rate limited.
     * @input session.secure true, login; 31 refresh calls within a minute.
     * @output Secure refresh cookie; the 31st refresh answers 429.
     */
    public function test_refresh_cookie_is_secure_and_refresh_is_throttled(): void
    {
        config(['session.secure' => true]);
        $user = $this->user();

        $response = $this->postJson('/api/login', ['email' => $user->user_email, 'password' => $this->defaultPassword])->assertOk();
        $this->assertTrue($this->credentialCookie($response, AuthCookies::REFRESH, '/api/refresh')->isSecure());

        foreach (range(1, 30) as $i) {
            $this->postJson('/api/refresh')->assertStatus(401);
        }
        $this->postJson('/api/refresh')->assertStatus(429);
    }
}
