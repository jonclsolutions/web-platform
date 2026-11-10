<?php

/**
 * @file AuthCookies.php
 * @path app/Support/Auth/AuthCookies.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Builds the cookies that carry the long-lived credentials of the application: the
 * admin refresh token and the session of the customer project portal. JavaScript never sees
 * either value - the browser stores and sends them by itself.
 * @security Every cookie is:
 * - HttpOnly: unreadable for scripts, so an XSS cannot steal it and keep the account;
 * - Secure (SESSION_SECURE_COOKIE, always on in production): sent over HTTPS only;
 * - SameSite=Strict: never sent with a request started by another site (no CSRF);
 * - host-only (no Domain) and limited by Path to the endpoints that need it - the refresh token
 *   goes only to the refresh routes (/api/refresh...), a portal session only to the routes of ITS
 *   project.
 * @note Several admin accounts can be signed in in one browser at once: every account has its own
 * refresh cookie `jsw_refresh_{slot}` (REFRESH_PREFIX). The slot is a keyed hash of the user ID
 * (no ID in the cookie name, the same account always the same cookie); a tab tells the refresh
 * route its slot in the X-Session-Slot header. The single cookie `jsw_refresh` of older versions
 * (REFRESH) is still read once and replaced by the slot cookie.
 * The API routes do not encrypt cookies (no EncryptCookies middleware), so the value is the raw
 * random token; only its SHA-256 hash is stored in the database.
 */

namespace App\Support\Auth;

use App\Models\Web\WebProjectSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Cookie;

final class AuthCookies
{
    /** @description Refresh cookie of older versions (one account per browser) - read once, then replaced. */
    public const REFRESH = 'jsw_refresh';

    /** @description Prefix of the refresh cookie of one account: `jsw_refresh_{slot}`. */
    public const REFRESH_PREFIX = 'jsw_refresh_';

    /** @description Request header with the slot of the tab's account (refresh route). */
    public const SLOT_HEADER = 'X-Session-Slot';

    /** @description Cookie of the customer project portal session. */
    public const PORTAL = 'jsw_project_session';

    /**
     * @description Idle limit of a remembered login (days): the refresh token of "Remember me"
     * expires this long after its last use - the cookie and the database row together.
     */
    public const REFRESH_TTL_DAYS = 7;

    /**
     * @description Idle limit of a login WITHOUT "Remember me" (hours). Its cookie is a browser
     * session cookie (deleted when the browser closes); this limit also ends a session of a
     * browser that is never closed or restores its session cookies.
     */
    public const SESSION_IDLE_HOURS = 12;

    /**
     * @description Absolute limit of one login (days): however active the session is, no refresh
     * token lives past this many days after the login - then a new login (with 2FA) is required.
     */
    public const SESSION_MAX_DAYS = 30;

    /** @description Name of the refresh route - its path is the Path of the refresh cookie. */
    public const REFRESH_ROUTE = 'auth.refresh';

    /** @description Name of the portal session routes group root - its path (per project) is the Path of the portal cookie. */
    public const PORTAL_ROUTE = 'projects.public.me';

    /**
     * @description Slot of an account: 16 hex characters of an HMAC of the user ID with the
     * application key - stable per account, without revealing the ID.
     * @param int $userId Account ID.
     * @return string
     */
    public static function slotFor(int $userId): string
    {
        return substr(hash_hmac('sha256', 'refresh-slot:' . $userId, (string) config('app.key')), 0, 16);
    }

    /**
     * @description Whether a value has the form of a slot (16 lower-case hex characters).
     * @param string $value Value from a header / cookie name.
     * @return bool
     */
    public static function isSlot(string $value): bool
    {
        return preg_match('/^[a-f0-9]{16}$/', $value) === 1;
    }

    /**
     * @description Refresh cookie name of a slot; null = the cookie of older versions.
     * @param string|null $slot Slot of the account.
     * @return string
     */
    public static function refreshName(?string $slot): string
    {
        return $slot === null ? self::REFRESH : self::REFRESH_PREFIX . $slot;
    }

    /**
     * @description Refresh token cookie of one account (sent only to the refresh routes).
     * @param Request $request Current request (base path of the application).
     * @param string $plainToken Raw refresh token.
     * @param bool $remember "Remember me": persistent cookie for REFRESH_TTL_DAYS; otherwise a
     *   browser session cookie without an expiry.
     * @param string $slot Slot of the account (slotFor()).
     * @return Cookie
     */
    public static function refresh(Request $request, string $plainToken, bool $remember, string $slot): Cookie
    {
        return self::make(self::refreshName($slot), $plainToken, $remember ? self::REFRESH_TTL_DAYS * 24 * 60 : null, self::refreshPath($request));
    }

    /**
     * @description Expiry of a refresh token row issued now (capped by the absolute end of the login).
     * @param bool $remember "Remember me" of the login.
     * @param \Illuminate\Support\Carbon $sessionEnd Absolute end of the login.
     * @return \Illuminate\Support\Carbon
     */
    public static function refreshExpiry(bool $remember, \Illuminate\Support\Carbon $sessionEnd): \Illuminate\Support\Carbon
    {
        $idle = $remember ? now()->addDays(self::REFRESH_TTL_DAYS) : now()->addHours(self::SESSION_IDLE_HOURS);

        return $idle->min($sessionEnd);
    }

    /**
     * @description Expired refresh cookie - the browser deletes it.
     * @param Request $request Current request.
     * @param string|null $slot Slot of the account; null = the cookie of older versions.
     * @return Cookie
     */
    public static function forgetRefresh(Request $request, ?string $slot = null): Cookie
    {
        return self::make(self::refreshName($slot), '', -5 * 365 * 24 * 60, self::refreshPath($request));
    }

    /**
     * @description Session cookie of the project portal, valid only for the routes of that project.
     * @param Request $request Current request.
     * @param string $projectToken Permanent access token of the project (from the URL).
     * @param string $plainSession Raw session token.
     * @return Cookie
     * @note Re-issued on every request of the session, so the cookie slides together with the
     * session in the database (WebProjectSession::slideExpiry()).
     */
    public static function portal(Request $request, string $projectToken, string $plainSession): Cookie
    {
        return self::make(self::PORTAL, $plainSession, WebProjectSession::LIFETIME_MINUTES, self::portalPath($request, $projectToken));
    }

    /**
     * @description Expired portal cookie of the project - the browser deletes it.
     * @param Request $request Current request.
     * @param string $projectToken Permanent access token of the project.
     * @return Cookie
     */
    public static function forgetPortal(Request $request, string $projectToken): Cookie
    {
        return self::make(self::PORTAL, '', -5 * 365 * 24 * 60, self::portalPath($request, $projectToken));
    }

    /**
     * @description Path of the refresh route under the base path of the application ("/api/refresh")
     * - also the prefix of the account list route (/api/refresh/accounts).
     * @param Request $request Current request.
     * @return string
     */
    private static function refreshPath(Request $request): string
    {
        return $request->getBaseUrl() . '/' . Route::getRoutes()->getByName(self::REFRESH_ROUTE)->uri();
    }

    /**
     * @description Path of the portal routes of one project ("/api/projects/public/{token}").
     * @param Request $request Current request.
     * @param string $projectToken Permanent access token of the project.
     * @return string
     */
    private static function portalPath(Request $request, string $projectToken): string
    {
        $uri = Route::getRoutes()->getByName(self::PORTAL_ROUTE)->uri();

        return $request->getBaseUrl() . '/' . str_replace('{token}', rawurlencode($projectToken), $uri);
    }

    /**
     * @description One credential cookie with the attributes described in the file header.
     * @param string $name Cookie name.
     * @param string $value Raw value ('' to delete).
     * @param int|null $minutes Lifetime in minutes (negative = delete, null = browser session cookie).
     * @param string $path Path the browser sends the cookie to.
     * @return Cookie
     */
    private static function make(string $name, string $value, ?int $minutes, string $path): Cookie
    {
        return Cookie::create($name)
            ->withValue($value)
            ->withExpires($minutes === null ? 0 : now()->addMinutes($minutes)->getTimestamp())
            ->withPath($path)
            ->withSecure(self::secure())
            ->withHttpOnly(true)
            ->withRaw(false)
            ->withSameSite(Cookie::SAMESITE_STRICT);
    }

    /**
     * @description Whether the cookies are sent over HTTPS only: SESSION_SECURE_COOKIE, and always
     * in production even when the variable is missing.
     * @return bool
     */
    private static function secure(): bool
    {
        return (bool) config('session.secure') || app()->isProduction();
    }
}
