<?php

/**
 * @file SecurityHeadersTest.php
 * @path api/tests/Feature/Other/SecurityHeadersTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the SecurityHeaders middleware (every API answer) and of the
 *   CSP violation report endpoint (POST /api/csp-report).
 * @dependencies
 * - Tests\TestCase; App\Http\Middleware\SecurityHeaders; CoreSecurityEvent.
 */

namespace Tests\Feature\Other;

use App\Http\Middleware\SecurityHeaders;
use App\Models\Core\CoreSecurityEvent;
use Tests\TestCase;

/**
 * @description Security headers of the API and the CSP report endpoint.
 */
class SecurityHeadersTest extends TestCase
{
    /**
     * @description Every API answer (also an error) carries the strict API policy; HSTS only on HTTPS.
     * @input GET /api/upload-rules over HTTP; GET of an unknown route; GET /api/upload-rules over HTTPS.
     * @output CSP default-src 'none' + frame-ancestors 'none', nosniff, X-Frame-Options DENY,
     *   Referrer-Policy no-referrer; no HSTS over HTTP; the 404 has them too; HSTS max-age=31536000 over HTTPS.
     */
    public function test_api_answers_carry_the_security_headers(): void
    {
        foreach ([$this->getJson('/api/upload-rules')->assertOk(), $this->getJson('/api/does-not-exist')->assertNotFound()] as $response) {
            $response->assertHeader('Content-Security-Policy', SecurityHeaders::API_CSP)
                ->assertHeader('X-Content-Type-Options', 'nosniff')
                ->assertHeader('X-Frame-Options', 'DENY')
                ->assertHeader('Referrer-Policy', 'no-referrer')
                ->assertHeaderMissing('Strict-Transport-Security');
        }

        $this->getJson('https://localhost/api/upload-rules')
            ->assertOk()
            ->assertHeader('Strict-Transport-Security', SecurityHeaders::HSTS);
    }

    /**
     * @description A CSP the action set itself is kept - the attachment sandbox policy is not
     *   replaced by the generic one.
     * @input Route answering with its own Content-Security-Policy "sandbox".
     * @output The answer keeps "sandbox"; the other headers are added.
     */
    public function test_own_csp_of_an_action_is_kept(): void
    {
        \Illuminate\Support\Facades\Route::get('/api/test-own-csp', fn () => response('x', 200, ['Content-Security-Policy' => 'sandbox']));

        $this->get('/api/test-own-csp')
            ->assertHeader('Content-Security-Policy', 'sandbox')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    /**
     * @description A CSP report (both browser formats) is stored as csp_violation with a minimal
     *   summary only: directive, ORIGIN of the blocked resource, first path segment of the page -
     *   no path, query or token of the URLs. The answer is always 204.
     * @input classic {csp-report} from /projects/<token>/x blocking https://evil.example/a.js?k=1;
     *   Reporting API list blocking 'inline' on /admin/core.
     * @output 204 ×2; two csp_violation events (info) with directive script-src-elem /
     *   script-src, blocked https://evil.example / inline, page /projects / /admin; the token
     *   and the path of the script are stored nowhere.
     */
    public function test_csp_report_is_recorded_minimised(): void
    {
        $classic = json_encode(['csp-report' => [
            'document-uri'        => 'https://www.example.com/projects/secret-portal-token/threads?x=1',
            'effective-directive' => 'script-src-elem',
            'blocked-uri'         => 'https://evil.example/a.js?k=1',
        ]]);
        $this->call('POST', '/api/csp-report', [], [], [], ['CONTENT_TYPE' => 'application/csp-report'], $classic)->assertNoContent();

        $modern = json_encode([['type' => 'csp-violation', 'body' => [
            'documentURL' => 'https://www.example.com/admin/core/users/5', 'effectiveDirective' => 'script-src', 'blockedURL' => 'inline',
        ]]]);
        $this->call('POST', '/api/csp-report', [], [], [], ['CONTENT_TYPE' => 'application/reports+json', 'REMOTE_ADDR' => '10.0.0.2'], $modern)->assertNoContent();

        $events = CoreSecurityEvent::where('event_type', 'csp_violation')->orderBy('id')->get();
        $this->assertCount(2, $events);
        $this->assertSame('info', $events[0]->severity);
        $first = $events[0]->context_data;
        $second = $events[1]->context_data;
        $this->assertSame(['script-src-elem', 'https://evil.example', '/projects'], [$first['directive'], $first['blocked'], $first['page']]);
        $this->assertSame(['script-src', 'inline', '/admin'], [$second['directive'], $second['blocked'], $second['page']]);
        $this->assertStringNotContainsString('secret-portal-token', json_encode(CoreSecurityEvent::pluck('context_data')));
        $this->assertStringNotContainsString('a.js', json_encode(CoreSecurityEvent::pluck('context_data')));
    }

    /**
     * @description Empty, oversized, invalid or foreign bodies are ignored (204, nothing stored);
     *   the endpoint is throttled.
     * @input Empty body; 9 kB body; "not json"; {"foo": 1}; then 20 reports + 1 within a minute.
     * @output 204 and no event for the first four; the 21st request of the minute answers 429.
     */
    public function test_csp_report_ignores_garbage_and_is_throttled(): void
    {
        foreach (['', str_repeat('x', 9000), 'not json', '{"foo":1}'] as $body) {
            $this->call('POST', '/api/csp-report', [], [], [], ['CONTENT_TYPE' => 'application/csp-report'], $body)->assertNoContent();
        }
        $this->assertSame(0, CoreSecurityEvent::where('event_type', 'csp_violation')->count());

        foreach (range(1, 16) as $i) {
            $this->call('POST', '/api/csp-report', [], [], [], ['CONTENT_TYPE' => 'application/csp-report'], '{}')->assertNoContent();
        }
        $this->call('POST', '/api/csp-report', [], [], [], ['CONTENT_TYPE' => 'application/csp-report'], '{}')->assertStatus(429);
    }
}
