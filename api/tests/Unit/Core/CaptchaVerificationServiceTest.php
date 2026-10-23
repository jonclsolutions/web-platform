<?php

/**
 * @file CaptchaVerificationServiceTest.php
 * @path api/tests/Unit/Core/CaptchaVerificationServiceTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the Cloudflare Turnstile verification: empty token, provider
 *   answer (success / rejection) and provider outage (fail closed), with and without a
 *   security event context.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema); Illuminate Http::fake().
 */

namespace Tests\Unit\Core;

use App\Models\Core\CoreSecurityEvent;
use App\Services\Security\CaptchaVerificationService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * @description App\Services\Security\CaptchaVerificationService.
 */
class CaptchaVerificationServiceTest extends TestCase
{
    /** @var array<string, string> Context as built by CoreSecurityEvent::contextFromRequest(). */
    private const CONTEXT = ['route' => 'api/login', 'method' => 'POST'];

    /**
     * @description An empty token fails without calling the provider; the event is written
     *   only when a context is given.
     * @input verify('') without and with context.
     * @output false both; no HTTP request; one login_captcha_failed event (reason empty_token).
     */
    public function test_empty_token(): void
    {
        Http::fake();
        $service = new CaptchaVerificationService();

        $this->assertFalse($service->verify(''));
        $this->assertSame(0, CoreSecurityEvent::count());
        $this->assertFalse($service->verify('', '1.1.1.1', self::CONTEXT));

        Http::assertNothingSent();
        $this->assertStringContainsString('empty_token', CoreSecurityEvent::sole()->getRawOriginal('context_data'));
    }

    /**
     * @description A confirmed token passes; the secret, token and IP are sent as a form.
     * @input Provider answers {success:true}; verify('tok', '1.1.1.1').
     * @output true; request carries secret, response=tok, remoteip.
     */
    public function test_valid_token(): void
    {
        config(['services.turnstile.secret_key' => 'secret-key']);
        Http::fake(['*' => Http::response(['success' => true])]);

        $this->assertTrue((new CaptchaVerificationService())->verify('tok', '1.1.1.1', self::CONTEXT));

        Http::assertSent(fn (ClientRequest $r) => $r['secret'] === 'secret-key' && $r['response'] === 'tok' && $r['remoteip'] === '1.1.1.1');
        $this->assertSame(0, CoreSecurityEvent::count());
    }

    /**
     * @description A rejected token fails and the provider's error codes are recorded
     *   (array or single value).
     * @input Provider answers {success:false, error-codes:[a, b]} then {success:false, error-codes:'c'}.
     * @output false both; events with error_codes "a,b" and "c"; without context no event.
     */
    public function test_rejected_token(): void
    {
        Http::fakeSequence()
            ->push(['success' => false, 'error-codes' => ['invalid-input-response', 'timeout-or-duplicate']])
            ->push(['success' => false, 'error-codes' => 'bad-request'])
            ->push(['success' => false]);
        $service = new CaptchaVerificationService();

        $this->assertFalse($service->verify('t1', '1.1.1.1', self::CONTEXT));
        $this->assertStringContainsString('invalid-input-response,timeout-or-duplicate', CoreSecurityEvent::sole()->getRawOriginal('context_data'));
        $this->assertFalse($service->verify('t2', '2.2.2.2', self::CONTEXT));
        $this->assertStringContainsString('bad-request', CoreSecurityEvent::where('ip_address', '2.2.2.2')->sole()->getRawOriginal('context_data'));
        $this->assertFalse($service->verify('t3'));
        $this->assertSame(2, CoreSecurityEvent::count());
    }

    /**
     * @description A provider outage fails closed and is recorded as a service error, not as
     *   a captcha failure.
     * @input Provider throws a connection error; verify with and without context.
     * @output false both; one login_captcha_service_error event.
     */
    public function test_provider_outage_fails_closed(): void
    {
        Http::fake(fn () => throw new ConnectionException('down'));
        $service = new CaptchaVerificationService();

        $this->assertFalse($service->verify('tok', '1.1.1.1', self::CONTEXT));
        $this->assertFalse($service->verify('tok'));

        $this->assertSame('login_captcha_service_error', CoreSecurityEvent::sole()->event_type);
    }
}
