<?php
/**
 * @file CookieConsentController.php
 * @path app/Http/Controllers/Api/Web/CookieConsentController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Records the cookie consent decisions of the visitors (GDPR Art. 7(1) - the
 * controller must be able to demonstrate the consent: which version of the text, which
 * categories, when). Every decision is a new row of `web_cookie_consents`. A legal concern of the
 * core - the cookie bar is shown by every public application.
 * @security Public and anonymous: only the random consent id generated in the browser, the
 * version, the categories and the time are stored - no IP address, no user agent, no cookie.
 * Throttled by the route; deleted after the `cookie_consents` retention period.
 */

namespace App\Http\Controllers\Api\Legal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Legal\CookieConsent\StoreCookieConsentRequest;
use App\Models\Legal\CookieConsent;
use Illuminate\Http\Response;

class CookieConsentController extends Controller
{
    /**
     * @description Stores one consent decision.
     * @param StoreCookieConsentRequest $request { consent_id, version, functional, analytics, marketing }.
     * @return Response 204 - the answer carries nothing.
     */
    public function store(StoreCookieConsentRequest $request): Response
    {
        CookieConsent::create($request->validated());

        return response()->noContent();
    }
}
