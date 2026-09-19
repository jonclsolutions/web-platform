<?php

/**
 * @file bootstrap/app.php
 * @path bootstrap/app.php
 * @project RPSW Web
 * @author RPSW
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
         * a zapíše bezpečnostní event - viz refactor-note (2026-08-24) v hlavičce
         * souboru. Tohle je NEJČASTĚJŠÍ místo, kde reálně vzniká "chybějící/expirovaný
         * token na chráněné routě", protože `auth:sanctum` middleware vyhazuje tuhle
         * výjimku dřív, než request vůbec dorazí ke `CheckPermission`.
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
         * @description Zachytí vyhození throttle limitu na kterékoliv routě (viz
         * refactor-note výše) a zapíše bezpečnostní event PŘED vrácením standardní 429
         * odpovědi - ALE JEN pokud request nemá přihlášeného uživatele (veřejný/cizí
         * provoz). Throttle na chráněných admin routách u PŘIHLÁŠENÉHO uživatele je
         * jen kapacitní ochrana vlastní práce, ne bezpečnostní incident - viz
         * bugfix-note (2026-08-23) v hlavičce souboru. `Retry-After` hlavička z
         * původní výjimky se přenáší dál v OBOU případech, ať se chování API pro
         * klienta nijak neliší od výchozího Laravel throttle handlingu.
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
                    'message' => 'Příliš mnoho požadavků. Zkuste to prosím později.',
                ], 429, $headers);
            }
        });
    })->create();