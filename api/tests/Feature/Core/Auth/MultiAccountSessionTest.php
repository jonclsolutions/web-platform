<?php

/**
 * @file MultiAccountSessionTest.php
 * @path api/tests/Feature/Core/Auth/MultiAccountSessionTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of several admin accounts signed in in one browser: one refresh
 *   cookie per account (`jsw_refresh_{slot}`), the slot header of the refresh, a logout ending only
 *   its own account, the move of the single cookie of older versions to a slot cookie and the list
 *   of accounts remembered in the browser.
 * @dependencies Tests\TestCase (InteractsWithAccounts); AuthCookies.
 */

namespace Tests\Feature\Core\Auth;

use App\Models\RefreshToken;
use App\Models\User;
use App\Support\Auth\AuthCookies;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * @description POST /api/login, /api/refresh (X-Session-Slot), /api/logout, /api/refresh/accounts.
 */
class MultiAccountSessionTest extends TestCase
{
    /**
     * @description Logs an account in and returns the answer.
     * @param User $user Account.
     * @param bool $remember "Remember me".
     * @return TestResponse
     */
    private function logIn(User $user, bool $remember): TestResponse
    {
        return $this->postJson('/api/login', ['email' => $user->user_email, 'password' => $this->defaultPassword, 'remember' => $remember])->assertOk();
    }

    /**
     * @description Refresh of one account: its slot header + all cookies of the browser.
     * @param string|null $slot Slot header (null = none).
     * @param array<string, string> $cookies Cookies of the browser.
     * @return TestResponse
     */
    private function refreshAs(?string $slot, array $cookies): TestResponse
    {
        $this->flushHeaders();
        $this->unencryptedCookies = [];
        $request = $this->withUnencryptedCookies($cookies)->withCredentials();
        if ($slot !== null) {
            $request = $request->withHeader(AuthCookies::SLOT_HEADER, $slot);
        }

        return $request->postJson('/api/refresh');
    }

    /**
     * @description Two accounts side by side: each login sets its own cookie and returns its slot;
     *   a refresh with a slot uses only that account's cookie; a cookie under another account's slot
     *   is refused; a logout ends only its account.
     * @input Login A (remember) and B (without); refresh as A, as B; A's token under B's name;
     *   logout A; refresh as B.
     * @output Different slots / cookie names; refresh A -> A, B -> B; 401 + B's cookie deleted;
     *   logout clears only A's cookie; B refreshes again.
     */
    public function test_two_accounts_in_one_browser(): void
    {
        $a = $this->user();
        $b = $this->user();
        $loginA = $this->logIn($a, true)->assertJsonPath('data.session_slot', AuthCookies::slotFor($a->id));
        $loginB = $this->logIn($b, false)->assertJsonPath('data.session_slot', AuthCookies::slotFor($b->id));
        $this->assertNotSame(AuthCookies::slotFor($a->id), AuthCookies::slotFor($b->id));

        $cookies = [
            $this->refreshCookieName($a) => $this->credentialCookie($loginA, $this->refreshCookieName($a), '/api/refresh')->getValue(),
            $this->refreshCookieName($b) => $this->credentialCookie($loginB, $this->refreshCookieName($b), '/api/refresh')->getValue(),
        ];

        $refreshA = $this->refreshAs(AuthCookies::slotFor($a->id), $cookies)->assertOk()->assertJsonPath('data.user.user_email', $a->user_email);
        $cookies[$this->refreshCookieName($a)] = $this->credentialCookie($refreshA, $this->refreshCookieName($a), '/api/refresh')->getValue();
        $this->assertNull($refreshA->getCookie($this->refreshCookieName($b), false));

        $refreshB = $this->refreshAs(AuthCookies::slotFor($b->id), $cookies)->assertOk()->assertJsonPath('data.user.user_email', $b->user_email);
        $cookies[$this->refreshCookieName($b)] = $this->credentialCookie($refreshB, $this->refreshCookieName($b), '/api/refresh')->getValue();

        // A's token under B's cookie name: refused, never signs in as A in B's tab.
        $mixed = $this->refreshAs(AuthCookies::slotFor($b->id), [$this->refreshCookieName($b) => $cookies[$this->refreshCookieName($a)]])->assertStatus(401);
        $this->assertCredentialCookieCleared($mixed, $this->refreshCookieName($b), '/api/refresh');

        $this->flushHeaders();
        // One test = one application: forget the user of the previous requests (logins / cookies).
        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $logout = $this->withHeaders($this->bearer($a))->postJson('/api/logout')->assertOk();
        $this->assertCredentialCookieCleared($logout, $this->refreshCookieName($a), '/api/refresh');
        $this->assertNull($logout->getCookie($this->refreshCookieName($b), false));
        $this->assertSame(0, RefreshToken::where('user_id', $a->id)->count());

        $this->unencryptedCookies = [];
        $this->refreshAs(AuthCookies::slotFor($b->id), $cookies)->assertOk()->assertJsonPath('data.user.user_email', $b->user_email);
    }

    /**
     * @description The single cookie of older versions keeps working once: the refresh without a
     *   slot uses it, answers the slot and moves the session to the slot cookie (old cookie deleted).
     * @input Legacy cookie 'raw' of A; refresh without a slot header; invalid slot header.
     * @output 200 with session_slot of A; slot cookie set, `jsw_refresh` deleted; an invalid header
     *   is treated as none.
     */
    public function test_cookie_of_older_versions_moves_to_a_slot(): void
    {
        $a = $this->user();
        RefreshToken::create(['user_id' => $a->id, 'token' => hash('sha256', 'raw'), 'expires_at' => now()->addDay(), 'remember' => true]);

        $response = $this->refreshAs('NOT-A-SLOT', [AuthCookies::REFRESH => 'raw'])->assertOk()
            ->assertJsonPath('data.session_slot', AuthCookies::slotFor($a->id));
        $this->assertNotSame('', (string) $this->credentialCookie($response, $this->refreshCookieName($a), '/api/refresh')->getValue());
        $this->assertCredentialCookieCleared($response, AuthCookies::REFRESH, '/api/refresh');
    }

    /**
     * @description The login page lists only the accounts REMEMBERED in this browser: valid
     *   remembered cookies (also the one of older versions, slot null); not the ones without
     *   "Remember me", blocked accounts or invalid cookies (those are deleted); nothing is rotated.
     * @input Cookies of A (remember), B (no remember), C (older version, remember), D (blocked,
     *   remember), a slot cookie with an unknown token, a cookie with a wrong name, one of A under
     *   B's slot name.
     * @output [A with slot, C with slot null]; cookies of D, the unknown token and the mismatch deleted;
     *   no refresh token rotated; without cookies [].
     */
    public function test_lists_the_accounts_remembered_in_the_browser(): void
    {
        [$a, $b, $c, $d] = [$this->user(), $this->user(), $this->user(), $this->user(['is_blocked' => true])];
        foreach ([[$a, 'ta', true], [$b, 'tb', false], [$c, 'tc', true], [$d, 'td', true]] as [$user, $raw, $remember]) {
            RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', $raw), 'expires_at' => now()->addDay(), 'remember' => $remember]);
        }
        $unknown = AuthCookies::refreshName('0123456789abcdef');

        $response = $this->withUnencryptedCookies([
            $this->refreshCookieName($a) => 'ta',
            $this->refreshCookieName($b) => 'tb',
            AuthCookies::REFRESH          => 'tc',
            $this->refreshCookieName($d) => 'td',
            $unknown                      => 'nope',
            'jsw_refresh_BAD'             => 'ta',
        ])->withCredentials()->postJson('/api/refresh/accounts')->assertOk();

        $this->assertEqualsCanonicalizing([
            ['slot' => AuthCookies::slotFor($a->id), 'user_email' => $a->user_email, 'full_name' => $a->full_name, 'avatar_url' => null],
            ['slot' => null, 'user_email' => $c->user_email, 'full_name' => $c->full_name, 'avatar_url' => null],
        ], $response->json('data'));
        $this->assertCredentialCookieCleared($response, $this->refreshCookieName($d), '/api/refresh');
        $this->assertCredentialCookieCleared($response, $unknown, '/api/refresh');
        $this->assertNull($response->getCookie($this->refreshCookieName($a), false));
        $this->assertSame(0, RefreshToken::whereNotNull('rotated_at')->count());

        $this->flushHeaders();
        $this->unencryptedCookies = [];
        $mismatch = $this->withUnencryptedCookies([$this->refreshCookieName($b) => 'ta'])->withCredentials()->postJson('/api/refresh/accounts')
            ->assertOk()->assertJsonPath('data', []);
        $this->assertCredentialCookieCleared($mismatch, $this->refreshCookieName($b), '/api/refresh');
    }

    /**
     * @description A listing that races with a refresh of another tab (its cookie still holds the
     *   token rotated a moment ago) keeps the cookie - the browser already has the new token - and
     *   lists the account; a token rotated long ago is left out and its cookie deleted.
     * @input A: remembered token rotated 3 s ago; B: remembered token rotated 1 hour ago.
     * @output [A]; A's cookie untouched; B's cookie deleted; nothing revoked.
     */
    public function test_listing_racing_with_a_refresh_keeps_the_cookie(): void
    {
        [$a, $b] = [$this->user(), $this->user()];
        RefreshToken::create(['user_id' => $a->id, 'token' => hash('sha256', 'ta'), 'expires_at' => now()->addDay(), 'remember' => true, 'rotated_at' => now()->subSeconds(3)]);
        RefreshToken::create(['user_id' => $b->id, 'token' => hash('sha256', 'tb'), 'expires_at' => now()->addDay(), 'remember' => true, 'rotated_at' => now()->subHour()]);

        $response = $this->withUnencryptedCookies([
            $this->refreshCookieName($a) => 'ta',
            $this->refreshCookieName($b) => 'tb',
        ])->withCredentials()->postJson('/api/refresh/accounts')->assertOk();

        $this->assertSame([$a->user_email], array_column($response->json('data'), 'user_email'));
        $this->assertNull($response->getCookie($this->refreshCookieName($a), false));
        $this->assertCredentialCookieCleared($response, $this->refreshCookieName($b), '/api/refresh');
        $this->assertSame(2, RefreshToken::count());
    }
}
