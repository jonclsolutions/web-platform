<?php
/**
 * @file RouteServiceProvider.php
 * @path app/Providers/RouteServiceProvider.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Service provider responsible for application route configuration and rate limiting.
 */

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

/**
 * @description Bootstraps the application's route registration, model bindings, and global rate limiting policies.
 */
class RouteServiceProvider extends ServiceProvider
{
    /**
     * @var string The path to the application's home route after authentication.
     */
    public const HOME = '/home';

    /**
     * Define route model bindings, pattern filters, and API/Web route groups.
     *
     * @return void
     */
    public function boot(): void
    {
        $this->configureRateLimiting();

        $this->routes(function () {
            // API routes configuration
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            // Web routes configuration
            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }

    /**
     * Configure the rate limiters for the application.
     *
     * @return void
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });
    }
}