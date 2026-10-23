<?php

use Illuminate\Support\Facades\Facade;
use Illuminate\Support\ServiceProvider;

return [

    'name' => env('APP_NAME', 'Laravel'),


    'env' => env('APP_ENV', 'production'),


    'debug' => (bool) env('APP_DEBUG', false),


    'url' => env('APP_URL', 'http://localhost'),


    'timezone' => 'Europe/Prague',


    'locale' => env('APP_LOCALE', 'en'),

    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),

    'faker_locale' => env('APP_FAKER_LOCALE', 'en_US'),

    'frontend_url' => env('FRONTEND_URL', 'http://localhost:4200'),

    'cipher' => 'AES-256-CBC',

    'key' => env('APP_KEY'),

    'previous_keys' => [
        ...array_filter(
            explode(',', (string) env('APP_PREVIOUS_KEYS', ''))
        ),
    ],

    'providers' => ServiceProvider::defaultProviders()->merge([
        /*
         * Package Service Providers...
         */

        /*
         * Application Service Providers...
         */
        App\Providers\AppServiceProvider::class,
        // @refactor-note (2026-10-23) App\Providers\RouteServiceProvider removed from the list (open
        //   finding #33): Laravel 11 loads the routes through withRouting() in bootstrap/app.php, the
        //   provider loaded routes/api.php + web.php a second time; its 'api' rate limiter is used by
        //   no route. The provider file was deleted (approved 2026-10-23).
    ])->toArray(),


    'aliases' => Facade::defaultAliases()->merge([
        // 'Example' => App\Facades\Example::class,
    ])->toArray(),

];