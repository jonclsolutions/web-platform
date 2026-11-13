<?php

/**
 * @file PortalCookie.php
 * @path app/Apps/ProjectPortal/Support/PortalCookie.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Session cookie of the customer project portal: HttpOnly, Secure, SameSite=Strict,
 *   host-only and limited by Path to the portal routes of ONE project
 *   (/api/projects/public/{token}) - see App\Support\Auth\AuthCookies for the attributes.
 *   JavaScript never sees the value; only its SHA-256 hash is stored (ProjectSession).
 * @dependencies AuthCookies::credential(), ProjectSession::LIFETIME_MINUTES, the named route ROUTE.
 */

namespace App\Apps\ProjectPortal\Support;

use App\Apps\ProjectPortal\Models\ProjectSession;
use App\Support\Auth\AuthCookies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Cookie;

final class PortalCookie
{
    /** @description Cookie name of the portal session. */
    public const NAME = 'jsw_project_session';

    /** @description Name of the portal session routes group root - its path (per project) is the Path of the cookie. */
    public const ROUTE = 'projects.public.me';

    /**
     * @description Session cookie of the project portal, valid only for the routes of that project.
     * @param Request $request Current request.
     * @param string $projectToken Permanent access token of the project (from the URL).
     * @param string $plainSession Raw session token.
     * @return Cookie
     * @note Re-issued on every request of the session, so the cookie slides together with the
     * session in the database (ProjectSession::slideExpiry()).
     */
    public static function issue(Request $request, string $projectToken, string $plainSession): Cookie
    {
        return AuthCookies::credential(self::NAME, $plainSession, ProjectSession::LIFETIME_MINUTES, self::path($request, $projectToken));
    }

    /**
     * @description Expired portal cookie of the project - the browser deletes it.
     * @param Request $request Current request.
     * @param string $projectToken Permanent access token of the project.
     * @return Cookie
     */
    public static function forget(Request $request, string $projectToken): Cookie
    {
        return AuthCookies::credential(self::NAME, '', -5 * 365 * 24 * 60, self::path($request, $projectToken));
    }

    /**
     * @description Path of the portal routes of one project ("/api/projects/public/{token}").
     * @param Request $request Current request.
     * @param string $projectToken Permanent access token of the project.
     * @return string
     */
    private static function path(Request $request, string $projectToken): string
    {
        $uri = Route::getRoutes()->getByName(self::ROUTE)->uri();

        return $request->getBaseUrl() . '/' . str_replace('{token}', rawurlencode($projectToken), $uri);
    }
}
