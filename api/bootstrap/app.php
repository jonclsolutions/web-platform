<?php
/**
 * @file bootstrap/app.php
 * @path bootstrap/app.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Application bootstrap configuration including routing, middleware, and exception handling.
 */

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;

/**
 * @description Configures the Laravel application lifecycle, routing, global middleware aliases, and custom exception rendering.
 */
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        /**
         * Append global middleware for Cross-Origin Resource Sharing.
         */
        $middleware->append(HandleCors::class);

        /**
         * Register custom middleware aliases for use in route definitions.
         */
        $middleware->alias([
            'shop.active' => \App\Http\Middleware\CheckCoreShopActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        /**
         * Customize the rendering of AuthenticationException.
         * Ensures API requests receive a JSON response with a 401 status code instead of a redirect.
         *
         * @param AuthenticationException $e
         * @param Request $request
         */
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });
    })->create();