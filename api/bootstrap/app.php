<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Auth\AuthenticationException; // Důležité: pro zpracování 401
use Illuminate\Http\Request;             // Důležité: pro zpracování 401

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Ponecháváme CORS middleware pro křížové domény
        $middleware->append(HandleCors::class);

        // ⚙️ REGISTRACE NAŠEHO NOVÉHO MIDDLEWARE
        $middleware->alias([
            'shop.active' => \App\Http\Middleware\CheckCoreShopActive::class,
        ]);

        // DŮLEŽITÉ: Zde NEJSOU žádné Sanctum middleware pro API skupinu.
        // To znamená, že API routy NEBUDOU automaticky ověřovány pomocí Sanctum session.
        // Autentizace se bude spoléhat na standardní Laravel session.
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Zajišťuje, že pro API požadavky (očekávající JSON)
        // se při AuthenticationException vrátí 401 Unauthorized.
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });
    })->create();