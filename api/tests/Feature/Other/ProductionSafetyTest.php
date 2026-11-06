<?php

/**
 * @file ProductionSafetyTest.php
 * @path api/tests/Feature/Other/ProductionSafetyTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the safe defaults of the configuration (VT-09): the session
 *   cookie is HTTPS-only by default in production (config/session.php), and production never
 *   runs with the debug page or a plain-HTTP session cookie whatever the .env says
 *   (AppServiceProvider::enforceProductionSafety).
 * @dependencies
 * - Tests\TestCase; App\Providers\AppServiceProvider.
 */

namespace Tests\Feature\Other;

use App\Providers\AppServiceProvider;
use Tests\TestCase;

/**
 * @description Production safety of app.debug and session.secure.
 */
class ProductionSafetyTest extends TestCase
{
    /**
     * @description Restores the environment variables the tests set.
     * @return void
     */
    protected function tearDown(): void
    {
        putenv('APP_ENV=testing');
        $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = 'testing';
        putenv('SESSION_SECURE_COOKIE');
        unset($_ENV['SESSION_SECURE_COOKIE'], $_SERVER['SESSION_SECURE_COOKIE']);
        parent::tearDown();
    }

    /**
     * @description Without SESSION_SECURE_COOKIE the session cookie is HTTPS-only in production and
     *   not on a local HTTP system; an explicit value wins.
     * @input config/session.php with APP_ENV production / local, unset; local + SESSION_SECURE_COOKIE=true.
     * @output true; false; true.
     */
    public function test_session_cookie_is_secure_by_default_in_production(): void
    {
        $secure = function (string $env): bool {
            putenv("APP_ENV={$env}");
            $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = $env;

            return (require config_path('session.php'))['secure'];
        };

        putenv('SESSION_SECURE_COOKIE');
        unset($_ENV['SESSION_SECURE_COOKIE'], $_SERVER['SESSION_SECURE_COOKIE']);
        $this->assertTrue($secure('production'));
        $this->assertFalse($secure('local'));
        putenv('SESSION_SECURE_COOKIE=true');
        $this->assertTrue($secure('local'));
    }

    /**
     * @description In production the debug page and a plain-HTTP session cookie are switched off
     *   at boot even when the .env turns them on; other environments keep their values.
     * @input app.debug true, session.secure false; boot in testing, then in production.
     * @output testing: unchanged; production: app.debug false, session.secure true.
     */
    public function test_production_forces_safe_values(): void
    {
        config(['app.debug' => true, 'session.secure' => false]);
        (new AppServiceProvider($this->app))->boot();
        $this->assertSame([true, false], [config('app.debug'), config('session.secure')]);

        $this->app->detectEnvironment(fn () => 'production');
        (new AppServiceProvider($this->app))->boot();
        $this->assertSame([false, true], [config('app.debug'), config('session.secure')]);
    }
}
