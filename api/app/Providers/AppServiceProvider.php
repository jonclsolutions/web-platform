<?php

/**
 * @file AppServiceProvider.php
 * @path app/Providers/AppServiceProvider.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Bootstrapuje aplikační služby. Definuje kombinovaný rate limiter pro
 * login endpoint (IP + e-mail současně - viz @refactor-note níže).
 * @refactor-note (2026-08) Přidán pojmenovaný limiter 'login' přes RateLimiter::for().
 * Dřívější `throttle:5,1` na routě limitoval pouze podle IP - útočník mohl útok
 * distribuovat přes více IP adres a limit tak efektivně obejít, protože z pohledu
 * každé jednotlivé IP šlo jen o pár pokusů. Nový limiter kombinuje DVA nezávislé klíče
 * (IP i normalizovaný e-mail) do jednoho throttle bucketu - stačí překročit limit
 * podle KTERÉHOKOLIV z nich a request je odmítnut. To pokrývá jak útok na jeden účet
 * z mnoha IP, tak "spray" útok z jedné IP na mnoho účtů.
 */

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // ── Login rate limiter: 5 pokusů / minutu, klíčováno IP i e-mailem zvlášť ──────
        RateLimiter::for('login', function ($request) {
            $email = mb_strtolower(trim((string) $request->input('email')));

            return [
                Limit::perMinute(5)->by('login-ip:' . $request->ip()),
                Limit::perMinute(5)->by('login-email:' . $email),
            ];
        });

        // ── Resend 2FA kódu: samostatný, přísnější limiter proti mail-bombingu ─────────
        RateLimiter::for('login-2fa-resend', function ($request) {
            return [
                Limit::perMinute(5)->by('2fa-resend-ip:' . $request->ip()),
            ];
        });
    }
}