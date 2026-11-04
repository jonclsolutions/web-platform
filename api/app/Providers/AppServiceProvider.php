<?php

/**
 * @file AppServiceProvider.php
 * @path app/Providers/AppServiceProvider.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Bootstraps the application services; defines the named rate limiters: the login
 * (keyed by IP and by e-mail separately), the 2FA code resend and the public web forms.
 * @note Every limit is keyed per client IP, per e-mail or per account - never one counter shared
 * by everybody - so many people using the application at the same time never block each other;
 * only one client (or one account) repeating itself is stopped. The client IP is correct behind a
 * proxy only with TRUSTED_PROXIES (config/trustedproxy.php).
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
        // Per e-mail (= per account): 5 / minute - one account tried again and again is stopped
        // (and from the 3rd failure the captcha is required, AuthController). Per IP: 20 / minute -
        // against one client trying many accounts, but enough for an office whose staff signs in
        // from one shared (NAT) address at the start of the day.
        RateLimiter::for('login', function ($request) {
            $email = mb_strtolower(trim((string) $request->input('email')));

            return [
                Limit::perMinute(20)->by('login-ip:' . $request->ip()),
                Limit::perMinute(5)->by('login-email:' . $email),
            ];
        });

        // ── 2FA code resend: a separate, stricter limiter against mail bombing ─────────
        RateLimiter::for('login-2fa-resend', function ($request) {
            return [
                Limit::perMinute(5)->by('2fa-resend-ip:' . $request->ip()),
            ];
        });

        // ── Public web forms (contact / inquiry, order form, job application) - per IP and form ─
        // 5 / minute and 50 / day per client IP: a person sends one form (maybe corrects it a few
        // times), a script is stopped. Separate counters per form (the route path is part of the
        // key) and per IP, so visitors sending at the same time do not share a limit. The quota
        // per recipient e-mail and the captcha are checked by PublicFormGuard. The admin creates
        // records through the authenticated routes, which this limiter does not cover.
        RateLimiter::for('public-form', function ($request) {
            $key = 'public-form:' . $request->path() . ':' . $request->ip();

            return [
                Limit::perMinute(5)->by($key . ':minute'),
                Limit::perDay(50)->by($key . ':day'),
            ];
        });
    }
}