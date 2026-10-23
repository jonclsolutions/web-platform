<?php

/**
 * @file SecurityEventRecordTest.php
 * @path api/tests/Unit/Core/SecurityEventRecordTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CoreSecurityEvent::record() and ::contextFromRequest(): the
 *   bucketed, atomic aggregation of security events and the minimal request context.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema).
 */

namespace Tests\Unit\Core;

use App\Models\Core\CoreSecurityEvent;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * @description App\Models\Core\CoreSecurityEvent (write path).
 */
class SecurityEventRecordTest extends TestCase
{
    /**
     * @description Repeated events (same type, IP, route, 5-minute window) aggregate into one
     *   row - occurrences grows, first_seen_at stays, last_seen_at moves.
     * @input record() twice within the same window (10 s apart).
     * @output One row, occurrences 2, status 'new', last_seen_at 10 s after first_seen_at.
     */
    public function test_same_event_in_window_is_aggregated(): void
    {
        $this->travelTo(now()->startOfHour());
        CoreSecurityEvent::record('login_failed', 'warning', '1.2.3.4', ['route' => 'api/login', 'method' => 'POST', 'user_agent' => 'UA']);
        $this->travel(10)->seconds();
        CoreSecurityEvent::record('login_failed', 'warning', '1.2.3.4', ['route' => 'api/login']);

        $event = CoreSecurityEvent::sole();
        $this->assertSame(2, $event->occurrences);
        $this->assertSame('new', $event->status);
        $this->assertSame('POST', $event->method);
        $this->assertSame('UA', $event->user_agent);
        $this->assertSame(10, (int) $event->first_seen_at->diffInSeconds($event->last_seen_at));
    }

    /**
     * @description A different route, IP or time window starts a new row.
     * @input Same type: route A, route B, other IP, route A again 6 minutes later.
     * @output Four rows.
     */
    public function test_route_ip_and_window_split_rows(): void
    {
        $this->travelTo(now()->startOfHour());
        CoreSecurityEvent::record('throttle_exceeded', 'warning', '1.1.1.1', ['route' => 'api/login']);
        CoreSecurityEvent::record('throttle_exceeded', 'warning', '1.1.1.1', ['route' => 'api/forgot-password']);
        CoreSecurityEvent::record('throttle_exceeded', 'warning', '2.2.2.2', ['route' => 'api/login']);
        $this->travel(6)->minutes();
        CoreSecurityEvent::record('throttle_exceeded', 'warning', '1.1.1.1', ['route' => 'api/login']);

        $this->assertSame(4, CoreSecurityEvent::count());
    }

    /**
     * @description scan_probe aggregates across all routes probed by one IP in a window.
     * @input scan_probe from one IP on '.env' and 'wp-login.php'.
     * @output One row, occurrences 2, route of the first probe.
     */
    public function test_scan_probe_is_route_agnostic(): void
    {
        CoreSecurityEvent::record('scan_probe', 'warning', '6.6.6.6', ['route' => 'api/.env']);
        CoreSecurityEvent::record('scan_probe', 'warning', '6.6.6.6', ['route' => 'wp-login.php']);

        $this->assertSame(2, CoreSecurityEvent::sole()->occurrences);
    }

    /**
     * @description The stored context is always valid JSON of at most 500 characters: an
     *   over-long context is shortened value by value, one that still does not fit is
     *   replaced by a marker; without context (or when it cannot be encoded) nothing is stored.
     * @input Context with a 1000-character note; context with a big nested array; no context;
     *        context with invalid UTF-8.
     * @output a: valid JSON, note cut to 60 chars, route kept; b: {"_truncated":true};
     *   c and d: NULL; missing severity = 'warning', missing IP = NULL.
     */
    public function test_context_is_valid_capped_json(): void
    {
        CoreSecurityEvent::record('a', 'info', '1.1.1.1', ['route' => 'api/login', 'note' => str_repeat('x', 1000)]);
        CoreSecurityEvent::record('b', 'info', '1.1.1.1', ['ids' => range(1, 300)]);
        CoreSecurityEvent::record('c');
        CoreSecurityEvent::record('d', 'info', null, ['user_agent' => "\xB1\x31"]);

        $a = CoreSecurityEvent::where('event_type', 'a')->sole();
        $this->assertLessThanOrEqual(500, mb_strlen($a->getRawOriginal('context_data')));
        $this->assertSame(['route' => 'api/login', 'note' => str_repeat('x', 60)], $a->context_data);
        $this->assertSame(['_truncated' => true], CoreSecurityEvent::where('event_type', 'b')->sole()->context_data);
        $c = CoreSecurityEvent::where('event_type', 'c')->sole();
        $this->assertNull($c->context_data);
        $this->assertSame('warning', $c->severity);
        $d = CoreSecurityEvent::where('event_type', 'd')->sole();
        $this->assertNull($d->context_data);
        $this->assertNull($d->ip_address);
    }

    /**
     * @description Client-controlled columns are cut to their column length, so an over-long
     *   User-Agent / URL / method can never make the insert fail.
     * @input user_agent 300 chars, route 300 chars, method 12 chars.
     * @output Stored lengths 255, 255, 10.
     */
    public function test_client_controlled_columns_are_limited(): void
    {
        CoreSecurityEvent::record('login_failed', 'warning', '1.1.1.1', [
            'user_agent' => str_repeat('u', 300), 'route' => str_repeat('r', 300), 'method' => 'PROPFINDXXXX',
        ]);

        $event = CoreSecurityEvent::sole();
        $this->assertSame(255, mb_strlen($event->user_agent));
        $this->assertSame(255, mb_strlen($event->route));
        $this->assertSame('PROPFINDXX', $event->method);
    }

    /**
     * @description The request context holds only metadata (route, method, user agent, user id)
     *   plus the given extra keys - never the request body.
     * @input POST /api/login with a password in the body, extra ['email' => 'a@b.cz'].
     * @output ['route' => 'api/login', 'method' => 'POST', 'user_agent' => 'UA', 'user_id' => null, 'email' => 'a@b.cz'].
     */
    public function test_context_from_request(): void
    {
        $request = Request::create('/api/login', 'POST', ['password' => 'secret'], [], [], ['HTTP_USER_AGENT' => 'UA']);

        $this->assertSame(
            ['route' => 'api/login', 'method' => 'POST', 'user_agent' => 'UA', 'user_id' => null, 'email' => 'a@b.cz'],
            CoreSecurityEvent::contextFromRequest($request, ['email' => 'a@b.cz'])
        );
    }
}
