<?php

/**
 * @file SecurityHeaders.php
 * @path app/Http/Middleware/SecurityHeaders.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Global middleware that adds the security headers to every answer of the API. The
 * API returns JSON (and files through AttachmentDownloadController), never a page, so its policy is
 * the strictest one: nothing may load, run or frame the answer.
 * @security
 * - Content-Security-Policy "default-src 'none'; frame-ancestors 'none'; …" - an answer opened in
 *   the browser can run no script and cannot be framed (clickjacking). A CSP the action set itself
 *   (the sandbox CSP of attachments) is kept.
 * - X-Content-Type-Options: nosniff - the browser never guesses another type than the declared one.
 * - X-Frame-Options: DENY - the same as frame-ancestors for old browsers.
 * - Referrer-Policy: no-referrer - no URL of the API (signed links) leaks to other sites.
 * - Strict-Transport-Security - only on HTTPS requests: the browser uses HTTPS only for one year.
 * The pages of the SPA get their own headers (with the CSP of the application) from
 * deploy/server/.htaccess, which leaves /api to this middleware.
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    /** @description CSP of the API answers - nothing may load, run or frame them. */
    public const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

    /** @description HSTS of HTTPS answers - one year, without includeSubDomains (other subdomains of the customer's domain may not have HTTPS). */
    public const HSTS = 'max-age=31536000';

    /**
     * @description Adds the headers that the answer does not set itself.
     * @param Request $request Incoming request.
     * @param Closure $next Next middleware.
     * @return Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $headers = $response->headers;

        $defaults = [
            'Content-Security-Policy' => self::API_CSP,
            'X-Content-Type-Options'  => 'nosniff',
            'X-Frame-Options'         => 'DENY',
            'Referrer-Policy'         => 'no-referrer',
        ];
        if ($request->isSecure()) {
            $defaults['Strict-Transport-Security'] = self::HSTS;
        }

        foreach ($defaults as $name => $value) {
            if (!$headers->has($name)) {
                $headers->set($name, $value);
            }
        }

        return $response;
    }
}
