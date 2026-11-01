<?php

/**
 * @file AppServiceProvider.php
 * @path app/Providers/AppServiceProvider.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Bootstraps the application services; defines the rate limiters of the login
 * (keyed by IP and by e-mail separately) and of the 2FA code resend.
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
        // ── Login rate limiter: 5 attempts / minute, keyed by the IP and by the e-mail separately ──────
        RateLimiter::for('login', function ($request) {
            $email = mb_strtolower(trim((string) $request->input('email')));

            return [
                Limit::perMinute(5)->by('login-ip:' . $request->ip()),
                Limit::perMinute(5)->by('login-email:' . $email),
            ];
        });

        // ── 2FA code resend: a separate, stricter limiter against mail bombing ─────────
        RateLimiter::for('login-2fa-resend', function ($request) {
            return [
                Limit::perMinute(5)->by('2fa-resend-ip:' . $request->ip()),
            ];
        });
    }
}