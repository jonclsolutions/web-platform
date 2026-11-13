<?php

/**
 * @file PublicFormGuardTest.php
 * @path api/tests/Apps/Web/Feature/PublicFormGuardTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the anti-abuse protection of the public web forms
 *   (PublicFormGuard + the named limiter `public-form`): captcha on every submission, quota per
 *   recipient e-mail address, limits per IP and form that are never shared between visitors, the
 *   admin routes untouched, and the parsing of TRUSTED_PROXIES (config/trustedproxy.php).
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Web\Support\WebFixtures; Http / Mail fakes.
 */

namespace Tests\Apps\Web\Feature;

use App\Http\Middleware\PublicFormGuard;
use App\Models\Core\CoreSecurityEvent;
use App\Apps\Web\Models\WebRawRequestCommission;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\Web\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description POST /api/raw_request_commissions (contact form) as the representative public form.
 */
class PublicFormGuardTest extends TestCase
{
    use WebFixtures;

    /**
     * @description Fake disks and mailer; the captcha is accepted unless a test says otherwise.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        Mail::fake();
        $this->fakeCaptcha();
    }

    /**
     * @description Restores TRUSTED_PROXIES after the config test.
     * @return void
     */
    protected function tearDown(): void
    {
        putenv('TRUSTED_PROXIES');
        unset($_ENV['TRUSTED_PROXIES'], $_SERVER['TRUSTED_PROXIES']);
        parent::tearDown();
    }

    /**
     * @description Sends the contact form from one IP address.
     * @param array<string, mixed> $overrides Field overrides.
     * @param string $ip REMOTE_ADDR of the visitor.
     * @return \Illuminate\Testing\TestResponse
     */
    private function submit(array $overrides = [], string $ip = '10.0.0.1')
    {
        $data = array_merge([
            'thema' => 'New website', 'contact_email' => 'client@example.com', 'contact_phone' => '+420 777 123 456',
            'order_description' => 'Please call me.', 'lang' => 'en',
        ] + $this->captcha(), $overrides);

        return $this->withServerVariables(['REMOTE_ADDR' => $ip])->postJson('/api/raw_request_commissions', $data);
    }

    /**
     * @description A missing or rejected captcha stops the submission before the controller and
     *   is recorded as the security event `form_captcha_failed` with the name of the form.
     * @input No captcha_token; then a token Cloudflare rejects.
     * @output 422 with captcha_required twice; nothing stored; event form_captcha_failed (form raw_request) with 2 occurrences
     *   (repeated events of one IP are aggregated).
     */
    public function test_captcha_is_required(): void
    {
        $this->submit(['captcha_token' => null])->assertStatus(422)->assertJsonPath('captcha_required', true);

        $this->fakeCaptcha(false);
        $this->submit()->assertStatus(422)->assertJsonPath('captcha_required', true);

        $this->assertSame(0, WebRawRequestCommission::count());
        $event = CoreSecurityEvent::where('event_type', 'form_captcha_failed')->sole();
        $this->assertSame(2, (int) $event->occurrences);
        $this->assertSame('raw_request', $event->context_data['form'] ?? null);
    }

    /**
     * @description A filled honeypot (hidden field a person never fills) is a bot: the submission
     *   is dropped silently - no error the bot could learn from, nothing stored, no e-mail, the
     *   recipient quota untouched; only the event `form_honeypot`. An empty field passes.
     * @input website 'http://spam.example' (×4, same e-mail); then website '' once.
     * @output 204 ×4; nothing stored, no mail; an event form_honeypot per IP (form raw_request); then 201.
     */
    public function test_honeypot_drops_bot_submissions_silently(): void
    {
        for ($i = 0; $i < PublicFormGuard::RECIPIENT_PER_HOUR + 1; $i++) {
            $this->submit([PublicFormGuard::HONEYPOT_FIELD => 'http://spam.example'], "10.0.6.{$i}")->assertNoContent();
        }

        $this->assertSame(0, WebRawRequestCommission::count());
        Mail::assertNothingQueued();
        $events = CoreSecurityEvent::where('event_type', 'form_honeypot')->get();
        $this->assertCount(PublicFormGuard::RECIPIENT_PER_HOUR + 1, $events);
        $this->assertSame('raw_request', $events->first()->context_data['form'] ?? null);

        $this->submit([PublicFormGuard::HONEYPOT_FIELD => ''], '10.0.7.1')->assertCreated();
    }

    /**
     * @description An unreachable Cloudflare API fails closed and is its own event, so a
     *   provider outage is not mistaken for an attack.
     * @input The Turnstile API throws a connection error.
     * @output 422 captcha_required; event form_captcha_service_error; nothing stored.
     */
    public function test_captcha_service_error_fails_closed(): void
    {
        Http::swap(new \Illuminate\Http\Client\Factory());
        Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('down'));

        $this->submit()->assertStatus(422)->assertJsonPath('captcha_required', true);

        $this->assertSame(0, WebRawRequestCommission::count());
        $this->assertSame(1, CoreSecurityEvent::where('event_type', 'form_captcha_service_error')->count());
    }

    /**
     * @description The quota of one recipient address counts only successful submissions: a
     *   visitor correcting a rejected form does not use it up, and the address is not stored in
     *   the cache key in plain text. Another address is not affected.
     * @input 2 invalid submissions, then RECIPIENT_PER_HOUR valid ones for client@example.com
     *        (different IPs, so the per-IP limit plays no role), one more, one for other@example.com.
     * @output 422 ×2, 201 ×3, then 429 with error_code RECIPIENT_LIMIT and retry_after; the other address 201.
     */
    public function test_recipient_quota_counts_successful_submissions_only(): void
    {
        $this->submit(['contact_phone' => 'abc'], '10.0.1.1')->assertStatus(422);
        $this->submit(['thema' => 'x'], '10.0.1.2')->assertStatus(422);

        for ($i = 0; $i < PublicFormGuard::RECIPIENT_PER_HOUR; $i++) {
            $this->submit(['contact_email' => 'Client@Example.com '], "10.0.2.{$i}")->assertCreated();
        }
        $this->submit([], '10.0.3.1')->assertStatus(429)
            ->assertJsonPath('error_code', 'RECIPIENT_LIMIT')
            ->assertJsonPath('retry_after', fn ($v) => is_int($v) && $v > 0);
        $this->submit(['contact_email' => 'other@example.com'], '10.0.3.2')->assertCreated();

        $this->assertSame(PublicFormGuard::RECIPIENT_PER_HOUR + 1, WebRawRequestCommission::count());
    }

    /**
     * @description The per-IP limit belongs to ONE visitor: an IP over the limit is refused,
     *   while other visitors sending at the same moment still get through (no shared counter).
     * @input 5 submissions from 10.0.4.1 (distinct e-mails), a 6th; then 5 other IPs once each.
     * @output 201 ×5, 429; the other IPs 201 each.
     */
    public function test_ip_limit_is_per_visitor(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->submit(['contact_email' => "a{$i}@example.com"], '10.0.4.1')->assertCreated();
        }
        $this->submit(['contact_email' => 'a9@example.com'], '10.0.4.1')->assertStatus(429);

        for ($i = 0; $i < 5; $i++) {
            $this->submit(['contact_email' => "b{$i}@example.com"], "10.0.5.{$i}")->assertCreated();
        }
    }

    /**
     * @description The admin creates records through the authenticated route - no captcha and
     *   neither the public per-IP limit nor the recipient quota (only the per-user limit of the
     *   auth group), so e.g. many inquiries for one client in a row are possible.
     * @input Creator: 10 × POST /api/web/raw_request_commissions with the same e-mail, no captcha_token.
     * @output 201 ×10; no form_captcha_failed event.
     */
    public function test_admin_route_is_not_guarded(): void
    {
        $this->signIn($this->userWith(['web-user-requests-create']));

        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/web/raw_request_commissions', [
                'thema' => "Inquiry {$i}", 'contact_email' => 'client@example.com', 'contact_phone' => '+420 777 123 456',
                'order_description' => 'Imported by the admin.', 'lang' => 'cz',
            ])->assertCreated();
        }

        $this->assertSame(0, CoreSecurityEvent::where('event_type', 'form_captcha_failed')->count());
    }

    /**
     * @description config/trustedproxy.php reads TRUSTED_PROXIES: unset = no proxy is trusted,
     *   '*' = every proxy, otherwise a trimmed comma separated list.
     * @input Unset; '*'; ' 10.0.0.1 , ,172.16.0.0/12'.
     * @output null; '*'; ['10.0.0.1', '172.16.0.0/12'].
     */
    public function test_trusted_proxies_config(): void
    {
        putenv('TRUSTED_PROXIES');
        $this->assertNull((require config_path('trustedproxy.php'))['proxies']);

        putenv('TRUSTED_PROXIES=*');
        $this->assertSame('*', (require config_path('trustedproxy.php'))['proxies']);

        putenv('TRUSTED_PROXIES= 10.0.0.1 , ,172.16.0.0/12');
        $this->assertSame(['10.0.0.1', '172.16.0.0/12'], (require config_path('trustedproxy.php'))['proxies']);
    }
}
