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
 */

namespace App\Services\Security;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CaptchaVerificationService
{
    /**
     * @description Ověří Turnstile token proti Cloudflare API.
     * @param string $token Token vygenerovaný widgetem na frontendu.
     * @param string|null $remoteIp IP adresa klienta (nepovinné, zvyšuje přesnost validace).
     * @return bool True, pokud je token platný.
     */
    public function verify(string $token, ?string $remoteIp = null): bool
    {
        if (empty($token)) {
            return false;
        }

        try {
            $response = Http::asForm()->post(config('services.turnstile.verify_url'), [
                'secret'   => config('services.turnstile.secret_key'),
                'response' => $token,
                'remoteip' => $remoteIp,
            ]);

            return (bool) ($response->json('success') ?? false);
        } catch (\Throwable $e) {
            // Chyba na straně captcha poskytovatele nesmí spadnout do 500 - bezpečněji
            // je request odmítnout (fail closed), ne propustit (fail open).
            Log::warning('Captcha verification request failed', ['error' => $e->getMessage()]);
            return false;
        }
    }
}