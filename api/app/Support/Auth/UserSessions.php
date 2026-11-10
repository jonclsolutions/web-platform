<?php

/**
 * @file UserSessions.php
 * @path app/Support/Auth/UserSessions.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Ends the admin sessions of an account after a change of its credentials (login
 * e-mail, password) - all of them, or all except the session the change was made from.
 * @note A session = one login: its refresh token family (RefreshToken::$family) plus the access
 * tokens issued from it. Every access token carries the family in its name
 * (`access-token:{family}`, accessTokenName()), so the session of the current request is known
 * although the refresh cookie is never sent outside the refresh routes.
 * @note "All except the current one": the other access tokens are revoked, the refresh tokens of
 * other families deleted. Other tabs of the SAME login (same browser, same family) then get a
 * new access token with their next refresh and keep working; other browsers / devices are
 * signed out. An access token without a family (issued by an older version, lives at most 60
 * minutes) keeps the refresh tokens - the family of the current session is unknown.
 * @dependencies
 * - App\Models\RefreshToken, App\Models\User (Sanctum `tokens()`), Laravel\Sanctum\PersonalAccessToken.
 */

namespace App\Support\Auth;

use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

final class UserSessions
{
    /** @description Prefix of the access token name; the session family follows it. */
    public const ACCESS_TOKEN_PREFIX = 'access-token:';

    /**
     * @description Name of an access token issued from a session (login / refresh).
     * @param string $family Refresh token family of the session.
     * @return string `access-token:{family}`
     */
    public static function accessTokenName(string $family): string
    {
        return self::ACCESS_TOKEN_PREFIX . $family;
    }

    /**
     * @description Ends every session of the account (all access and refresh tokens) - its tabs
     *   show the login page with their next request.
     * @param User $user Account.
     * @return void
     */
    public static function endAll(User $user): void
    {
        $user->tokens()->delete();
        RefreshToken::where('user_id', $user->id)->delete();
    }

    /**
     * @description Ends every session of the account except the one of the request (the account
     *   changed its own credentials there).
     * @param User $user Account - the signed-in user of the request.
     * @param Request $request Request authenticated by an access token of that account.
     * @return void
     */
    public static function endOthers(User $user, Request $request): void
    {
        // Only a stored Sanctum token identifies the session (not a transient / session login).
        $current = $request->user()?->currentAccessToken();
        $currentId = $current instanceof PersonalAccessToken ? ($current->getKey() ?: null) : null;
        $name = $current instanceof PersonalAccessToken ? (string) ($current->name ?? '') : '';
        $family = str_starts_with($name, self::ACCESS_TOKEN_PREFIX) ? substr($name, strlen(self::ACCESS_TOKEN_PREFIX)) : '';

        $user->tokens()->when($currentId !== null, fn ($query) => $query->whereKeyNot($currentId))->delete();

        if ($family !== '') {
            RefreshToken::where('user_id', $user->id)->where(fn ($query) => $query->whereNull('family')->orWhere('family', '!=', $family))->delete();
        }
    }
}
