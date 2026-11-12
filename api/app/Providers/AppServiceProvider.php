<?php

/**
 * @file AppServiceProvider.php
 * @path app/Providers/AppServiceProvider.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Bootstraps the application services; defines the named rate limiters: the login
 * (keyed by IP and by e-mail separately), the 2FA code resend and the public web forms; in
 * production forces the safe values of the settings whose mistake would leak data (VT-09); maps the
 * models of the registered applications that own attachments to their morph aliases
 * (AppManifest::morphMap()), so `attachable_type` stores an alias and the classes may move.
 * @note Every limit is keyed per client IP, per e-mail or per account - never one counter shared
 * by everybody - so many people using the application at the same time never block each other;
 * only one client (or one account) repeating itself is stopped. The client IP is correct behind a
 * proxy only with TRUSTED_PROXIES (config/trustedproxy.php).
 */

namespace App\Providers;

use App\Support\Apps\AppRegistry;
use App\Support\Audit\ModelChanges;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Events\RouteMatched;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * @description Production can never run with the debug page (it shows the configuration and
     * stack traces to anybody) or with a session cookie sent over plain HTTP, whatever a
     * forgotten or copied .env says (VT-09). deploy/build.sh refuses such a .env already; this
     * covers a .env edited on the server by hand.
     * @return void
     */
    private function enforceProductionSafety(): void
    {
        if ($this->app->isProduction()) {
            config(['app.debug' => false, 'session.secure' => true]);
        }
    }

    /**
     * Register any application services.
     */
    public function register(): void
    {
        // One collector of data changes per request / job (see LogsActivity: `changes` of a log row).
        $this->app->scoped(ModelChanges::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->enforceProductionSafety();
        Relation::morphMap(AppRegistry::morphMap());

        // ── Audit detail: every model created / updated / deleted / restored is noted with its
        // changed attributes; the next audit log row of the request carries them (`changes`).
        // Changes made before the request reached its route (none in production; test fixtures)
        // are not part of its log rows.
        Event::listen(RouteMatched::class, fn () => $this->app->make(ModelChanges::class)->flush());
        foreach (['created', 'updated', 'deleted', 'restored'] as $event) {
            Event::listen("eloquent.{$event}: *", function (string $name, array $payload) use ($event) {
                if (($payload[0] ?? null) instanceof Model) {
                    $this->app->make(ModelChanges::class)->record($event, $payload[0]);
                }
            });
        }

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