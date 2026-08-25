<?php

/**
 * @file CaptchaVerificationService.php
 * @path app/Services/Security/CaptchaVerificationService.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Server-side ověření Cloudflare Turnstile tokenu. Zvoleno místo Google
 * reCAPTCHA kvůli GDPR/EU zpracování dat (Turnstile negeneruje trackovací cookie a
 * nabízí EU data residency) - viz interní bezpečnostní analýza k 2FA/captcha backlogu.
 * Token z frontendu se NIKDY nesmí považovat za platný bez tohoto server-side ověření.
 *
 * @bugfix-note (2026-08-24) KRITICKÁ NESROVNALOST - CAPTCHA SELHÁNÍ SE VŮBEC
 * NEZAPISOVALO DO BEZPEČNOSTNÍHO MONITORINGU: `AuthController::login()` už DŘÍV volal
 * `$this->captcha->verify($captchaToken, $request->ip(), $context)` se třemi argumenty
 * a hlavička `AuthController.php` tvrdila "Captcha selhání samo zapisuje
 * CaptchaVerificationService::verify()" - ale metoda přijímala jen DVA parametry
 * (`$token`, `$remoteIp`), takže třetí argument (`$context`) PHP tiše ignorovalo (extra
 * argumenty u nevariadické metody nezpůsobí chybu) a uvnitř metody neexistoval ŽÁDNÝ
 * zápis do `CoreSecurityEvent`. Výsledek: opakované selhání captchy (typický signál
 * automatizovaného bota zkoušejícího projít bez lidského ověření) se v bezpečnostním
 * monitoringu neobjevilo vůbec, přestože kód i komentáře tvrdily opak.
 *
 * ŘEŠENÍ: `verify()` teď přijímá `$context` (výstup `CoreSecurityEvent::contextFromRequest()`)
 * a PŘI KAŽDÉM selhání zapisuje bezpečnostní event PŘÍMO ZDE - jak avizovala původní
 * dokumentace, jen to dřív ve skutečnosti nedělala. Rozlišeny DVA typy selhání, protože
 * mají jinou diagnostickou hodnotu:
 * - `login_captcha_failed` (warning) - prázdný token nebo Cloudflare token odmítl. Typicky
 *   bot/skript zkoušející login endpoint bez vyplnění widgetu, nebo starý/expirovaný token.
 * - `login_captcha_service_error` (warning) - výjimka při komunikaci s Cloudflare API
 *   (výpadek služby, síťová chyba). Odlišeno záměrně - hromadění TOHOTO typu značí
 *   problém na straně Cloudflare/sítě, ne útok, a admin by na to měl reagovat jinak
 *   (zkontrolovat konektivitu/API klíč), ne hledat útočníka.
 */

namespace App\Services\Security;

use App\Models\Core\CoreSecurityEvent;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CaptchaVerificationService
{
    /**
     * @description Ověří Turnstile token proti Cloudflare API. Při JAKÉMKOLIV selhání
     * (prázdný token, Cloudflare odmítnutí, výpadek služby) zapisuje bezpečnostní event
     * - viz bugfix-note v hlavičce třídy.
     * @param string $token Token vygenerovaný widgetem na frontendu.
     * @param string|null $remoteIp IP adresa klienta (nepovinné, zvyšuje přesnost validace).
     * @param array $context Kontext requestu pro zápis do `core_security_events` při
     * selhání - typicky výstup `CoreSecurityEvent::contextFromRequest()`. Prázdné pole
     * (default) znamená "nezajímá mě zápis eventu" - použitelné i mimo login flow, kde
     * by captcha selhání nemuselo být bezpečnostně relevantní.
     * @return bool True, pokud je token platný.
     */
    public function verify(string $token, ?string $remoteIp = null, array $context = []): bool
    {
        if (empty($token)) {
            if (!empty($context)) {
                CoreSecurityEvent::record('login_captcha_failed', 'warning', $remoteIp, array_merge($context, [
                    'reason' => 'empty_token',
                ]));
            }
            return false;
        }

        try {
            $response = Http::asForm()->post(config('services.turnstile.verify_url'), [
                'secret'   => config('services.turnstile.secret_key'),
                'response' => $token,
                'remoteip' => $remoteIp,
            ]);

            $success = (bool) ($response->json('success') ?? false);

            if (!$success && !empty($context)) {
                $errorCodes = $response->json('error-codes') ?? [];
                CoreSecurityEvent::record('login_captcha_failed', 'warning', $remoteIp, array_merge($context, [
                    'reason'       => 'rejected_by_provider',
                    'error_codes'  => is_array($errorCodes) ? implode(',', $errorCodes) : (string) $errorCodes,
                ]));
            }

            return $success;
        } catch (\Throwable $e) {
            // Chyba na straně captcha poskytovatele nesmí spadnout do 500 - bezpečněji
            // je request odmítnout (fail closed), ne propustit (fail open).
            Log::warning('Captcha verification request failed', ['error' => $e->getMessage()]);

            if (!empty($context)) {
                // Samostatný event_type (ne 'login_captcha_failed') - hromadění TOHOTO
                // typu značí výpadek Cloudflare/sítě, ne útok, viz bugfix-note výše.
                CoreSecurityEvent::record('login_captcha_service_error', 'warning', $remoteIp, array_merge($context, [
                    'reason' => 'provider_request_exception',
                ]));
            }

            return false;
        }
    }
}