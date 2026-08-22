<?php
/**
 * @file bootstrap/app.php
 * @path bootstrap/app.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Application bootstrap configuration including routing, middleware, and exception handling.
 *
 * @refactor-note (2026-08) Zaregistrován alias `permission` -> CheckPermission middleware,
 * použitý v routes/api.php (`->middleware('permission:web-manage-administrators')` apod.) -
 * viz CheckPermission.php pro odůvodnění (permission systém dřív existoval jen jako
 * Angular route metadata, backend ho nikdy nekontroloval).
 *
 * @refactor-note (2026-08-15) Alias `shop.active` přepojen z `CheckCoreShopActive` na
 * `CheckShopActive` a alias `web.active` přepojen z `CheckCoreWebActive` na
 * `CheckWebActive` - shop i web maintenance middleware se přesunuly z Core domény do
 * vlastních domén (Shop/Web) společně s daty (`shop_site_settings`/`web_site_settings`
 * tabulky, `core_site_settings` zrušena úplně). Aliasy samotné (`shop.active`,
 * `web.active`) zůstávají stejné, mění se jen cílové třídy.
 *
 * @refactor-note (2026-08-22) KROK 2 BEZPEČNOSTNÍHO MONITORINGU: doplněn `render()` handler
 * pro `ThrottleRequestsException` (Laravel ji vyhazuje při zásahu JAKÉHOKOLIV `throttle:*`
 * middlewaru - `throttle:100,1` na chráněných routách, `throttle:login`, `throttle:5,1` na
 * password reset, `throttle:10,1` na sales_orders atd.). Handler zapíše
 * `throttle_exceeded` do `core_security_events` (přes `CoreSecurityEvent::record()`, tedy
 * bucketovaně - nezpůsobí DB zátěž ani při skutečném útoku) a teprve poté vrátí standardní
 * 429 JSON odpověď se zachovaným `Retry-After` hlavičkovým polem. Bez tohoto handleru by
 * throttle limity fungovaly (request by byl odmítnut), ale admin by o překročení limitu
 * neměl v UI žádnou viditelnou stopu.
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

        /**
         * @description Zachytí vyhození throttle limitu na kterékoliv routě (viz
         * refactor-note výše) a zapíše bezpečnostní event PŘED vrácením standardní 429
         * odpovědi. `Retry-After` hlavička z původní výjimky se přenáší dál, ať se
         * chování API pro klienta nijak neliší od výchozího Laravel throttle handlingu.
         * @param ThrottleRequestsException $e
         * @param Request $request
         */
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            CoreSecurityEvent::record(
                'throttle_exceeded',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request)
            );

            if ($request->expectsJson()) {
                $headers = $e->getHeaders();

                return response()->json([
                    'message' => 'Příliš mnoho požadavků. Zkuste to prosím později.',
                ], 429, $headers);
            }
        });
    })->create();