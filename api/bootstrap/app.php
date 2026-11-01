<?php

/**
 * @file bootstrap/app.php
 * @path bootstrap/app.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Application bootstrap configuration including routing, middleware, and exception handling.
 */

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use App\Models\Core\CoreSecurityEvent;

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
            'shop.active'  => \App\Http\Middleware\CheckShopActive::class,
            'web.active'   => \App\Http\Middleware\CheckWebActive::class,
            'permission'   => \App\Http\Middleware\CheckPermission::class,
            'project.session' => \App\Http\Middleware\CheckProjectSession::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        /**
         * @description Customize the rendering of AuthenticationException. Ensures API
         * requests receive a JSON response with a 401 status code instead of a redirect,
         * and records a security event - the most common place of a "missing / expired token
         * on a protected route", because `auth:sanctum` throws it before `CheckPermission`.
         *
         * @param AuthenticationException $e
         * @param Request $request
         */
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->expectsJson()) {
                CoreSecurityEvent::record(
                    'unauthenticated_access_attempt',
                    'info',
                    $request->ip(),
                    CoreSecurityEvent::contextFromRequest($request)
                );

                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });

        /**
         * @description Records a security event for a throttle limit hit on any route BEFORE the
         * standard 429 answer - ONLY for requests without a logged-in user (public / foreign
         * traffic); throttling a LOGGED-IN user on admin routes is capacity protection, not an
         * incident. The `Retry-After` header of the original exception is passed on in BOTH cases,
         * so the API behaves like the default Laravel throttle handling.
         * @param ThrottleRequestsException $e
         * @param Request $request
         */
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->user() === null) {
                CoreSecurityEvent::record(
                    'throttle_exceeded',
                    'warning',
                    $request->ip(),
                    CoreSecurityEvent::contextFromRequest($request)
                );
            }

            if ($request->expectsJson()) {
                $headers = $e->getHeaders();

                return response()->json([
                    'message' => 'Too many requests. Please try again later.',
                ], 429, $headers);
            }
        });
    })->create();