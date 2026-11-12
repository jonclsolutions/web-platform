<?php
/**
 * @file StoreCookieConsentRequest.php
 * @path app/Http/Requests/Web/CookieConsent/StoreCookieConsentRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validates a cookie consent record of the cookie bar: random UUID `consent_id`,
 * version of the consent text and the three optional categories (necessary cookies are always on
 * and therefore not sent).
 */

namespace App\Http\Requests\Legal\CookieConsent;

use Illuminate\Foundation\Http\FormRequest;

class StoreCookieConsentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Public endpoint, throttled by the route.
    }

    public function rules(): array
    {
        return [
            'consent_id' => ['required', 'uuid'],
            'version'    => ['required', 'integer', 'min:1', 'max:65535'],
            'functional' => ['required', 'boolean'],
            'analytics'  => ['required', 'boolean'],
            'marketing'  => ['required', 'boolean'],
        ];
    }
}
