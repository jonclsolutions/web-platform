<?php

/**
 * @file CheckPermissionTest.php
 * @path api/tests/Unit/Core/CheckPermissionTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the CheckPermission middleware called directly: no user,
 *   sysadmin bypass, OR of several permissions, self access through a route parameter
 *   (plain id or bound model), denial.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Unit\Core;

use App\Http\Middleware\CheckPermission;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

/**
 * @description App\Http\Middleware\CheckPermission.
 */
class CheckPermissionTest extends TestCase
{
    /**
     * @description Runs the middleware for a request with the given user and route parameter.
     * @param User|null $user Signed-in account (null = nobody).
     * @param string $permission Middleware argument, e.g. 'a|b'.
     * @param string|null $selfParam Name of the self route parameter.
     * @param mixed $routeValue Value of the route parameter 'id'.
     * @return Response Response of the middleware (200 'passed' when it let the request through).
     */
    private function handle(?User $user, string $permission, ?string $selfParam = null, mixed $routeValue = null): Response
    {
        $request = Request::create('/api/core/users/1', 'GET');
        $request->setUserResolver(fn () => $user);
        $route = new Route('GET', 'api/core/users/{id}', []);
        $route->bind($request);
        $route->setParameter('id', $routeValue);
        $request->setRouteResolver(fn () => $route);

        return (new CheckPermission())->handle($request, fn () => response('passed'), $permission, $selfParam);
    }

    /**
     * @description Without a signed-in user the middleware answers 401 and records the attempt.
     * @input No user.
     * @output 401 "Not logged in."; unauthenticated_access_attempt event.
     */
    public function test_no_user_is_refused(): void
    {
        $response = $this->handle(null, 'core-security-view');

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSecurityEvent('unauthenticated_access_attempt', 'info');
    }

    /**
     * @description A sysadmin passes every permission check.
     * @input Sysadmin without any permission rows.
     * @output 'passed'.
     */
    public function test_sysadmin_passes(): void
    {
        $this->assertSame('passed', $this->handle($this->sysadmin(), 'anything')->getContent());
    }

    /**
     * @description Any one of the pipe-separated permissions is enough.
     * @input Account with 'b-key', middleware 'a-key|b-key'.
     * @output 'passed'.
     */
    public function test_any_of_several_permissions(): void
    {
        $this->assertSame('passed', $this->handle($this->userWith(['b-key']), 'a-key|b-key')->getContent());
    }

    /**
     * @description The self parameter lets an account through for its own id - as a plain
     *   value or as a bound model.
     * @input Account without permissions; route id = own id (string), own model; foreign id.
     * @output 'passed', 'passed', 403 (permission_denied event).
     */
    public function test_self_parameter(): void
    {
        $me = $this->user();

        $this->assertSame('passed', $this->handle($me, 'x', 'id', (string) $me->id)->getContent());
        $this->assertSame('passed', $this->handle($me, 'x', 'id', $me)->getContent());
        $this->assertSame(403, $this->handle($me, 'x', 'id', $me->id + 1)->getStatusCode());
        $this->assertSecurityEvent('permission_denied');
    }
}
