<?php

/**
 * @file PublicFormGuard.php
 * @path app/Http/Middleware/PublicFormGuard.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Anti-abuse guard of the PUBLIC web forms (contact / inquiry, order form, job
 * application). Applied only to their public routes - the admin creates the same records through
 * the authenticated routes (per-user limit of the auth group), which this guard never touches.
 * Three checks, in this order:
 * 0) Honeypot - the hidden field HONEYPOT_FIELD (CaptchaComponent: off-screen, no tab stop, no
 *    autofill) is never filled by a person. A filled one is a bot: the submission is dropped
 *    WITHOUT an error (204), so the bot does not learn to skip the field; nothing is stored, no
 *    e-mail is sent, the quota is untouched, only the security event `form_honeypot` is recorded.
 * 1) Recipient quota - the forms send a confirmation e-mail to the address typed in the form, so
 *    without a quota the server could be used to mail anybody. At most RECIPIENT_PER_HOUR /
 *    RECIPIENT_PER_DAY SUCCESSFUL submissions per form and e-mail address. Counted only after a
 *    successful submission, so a visitor correcting a rejected form (validation errors) does not
 *    use the quota up. Keyed by the SHA-256 of the normalised address (no e-mail in the cache).
 * 2) Captcha - a valid Cloudflare Turnstile token (`captcha_token`) on every submission, checked
 *    on the server (fail closed). A failure is the security event `form_captcha_failed`. The
 *    widget runs invisibly in the browser (`interaction-only`), the visitor normally clicks nothing.
 * @note The per-IP limit is the named limiter `public-form` of the route (AppServiceProvider) and
 * runs before this middleware. Every limit is per IP or per address - never one shared counter -
 * so many visitors sending at the same time do not block each other.
 * @usage ->middleware(['throttle:public-form', 'public.form:raw_request,contact_email'])
 */

namespace App\Http\Middleware;

use App\Models\Core\CoreSecurityEvent;
use App\Services\Security\CaptchaVerificationService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class PublicFormGuard
{
    /** @description Name of the hidden honeypot field - must match HONEYPOT_FIELD of CaptchaComponent. */
    public const HONEYPOT_FIELD = 'website';

    /** @description Successful submissions per form and recipient address within an hour. */
    public const RECIPIENT_PER_HOUR = 3;

    /** @description Successful submissions per form and recipient address within a day. */
    public const RECIPIENT_PER_DAY = 10;

    /**
     * @param CaptchaVerificationService $captcha Server-side Turnstile check.
     */
    public function __construct(private readonly CaptchaVerificationService $captcha) {}

    /**
     * @description Checks the recipient quota and the captcha; counts a successful submission.
     * @param Request $request Public form submission.
     * @param Closure $next Next middleware.
     * @param string $form Short name of the form (part of the keys and of the events).
     * @param string $emailField Input with the e-mail address the confirmation is sent to.
     * @return Response 204 for a filled honeypot, 429 with error_code `RECIPIENT_LIMIT` over the quota, 422 with `captcha_required` for a
     *   failed captcha (the forms show their own text for both).
     */
    public function handle(Request $request, Closure $next, string $form, string $emailField): Response
    {
        if (trim((string) $request->input(self::HONEYPOT_FIELD)) !== '') {
            CoreSecurityEvent::record('form_honeypot', 'info', $request->ip(), CoreSecurityEvent::contextFromRequest($request, ['form' => $form]));

            return response()->noContent();
        }

        $email = mb_strtolower(trim((string) $request->input($emailField)));
        $keys = $email === '' ? [] : [
            "public-form:{$form}:to-hour:" . hash('sha256', $email) => [self::RECIPIENT_PER_HOUR, 3600],
            "public-form:{$form}:to-day:" . hash('sha256', $email)  => [self::RECIPIENT_PER_DAY, 86400],
        ];

        foreach ($keys as $key => [$max]) {
            if (RateLimiter::tooManyAttempts($key, $max)) {
                return response()->json([
                    'message'     => 'Too many submissions for this e-mail address. Please try again later.',
                    'error_code'  => 'RECIPIENT_LIMIT',
                    'retry_after' => RateLimiter::availableIn($key),
                ], 429);
            }
        }

        $context = CoreSecurityEvent::contextFromRequest($request, ['form' => $form]);
        if (!$this->captcha->verify((string) $request->input('captcha_token'), $request->ip(), $context, 'form')) {
            return response()->json([
                'message'          => 'Captcha verification failed. Please try again.',
                'captcha_required' => true,
            ], 422);
        }

        $response = $next($request);

        if ($response->isSuccessful()) {
            foreach ($keys as $key => [, $decay]) {
                RateLimiter::hit($key, $decay);
            }
        }

        return $response;
    }
}
