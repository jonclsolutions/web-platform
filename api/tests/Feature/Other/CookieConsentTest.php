<?php

/**
 * @file CookieConsentTest.php
 * @path api/tests/Feature/Other/CookieConsentTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the cookie consent records (VT-12, CookieConsentController):
 *   anonymous record of every decision, validation, no personal data, throttle.
 * @dependencies
 * - Tests\TestCase.
 */

namespace Tests\Feature\Other;

use App\Models\Legal\CookieConsent;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * @description POST /api/cookie-consents.
 */
class CookieConsentTest extends TestCase
{
    /** @var array<string, mixed> A valid decision of the cookie bar. */
    private const BODY = [
        'consent_id' => '0b6f6c2e-6f5e-4c55-9a3e-1d2f3a4b5c6d', 'version' => 1,
        'functional' => true, 'analytics' => false, 'marketing' => false,
    ];

    /**
     * @description Every decision is stored as a new row (the history proves the consent);
     *   the table has no column for an IP address or user agent.
     * @input Two decisions of one consent id (reject, then accept analytics).
     * @output 204 ×2; 2 rows with the categories and version; no ip / user_agent column.
     */
    public function test_decisions_are_recorded_anonymously(): void
    {
        $this->postJson('/api/cookie-consents', self::BODY)->assertNoContent();
        $this->postJson('/api/cookie-consents', ['analytics' => true] + self::BODY)->assertNoContent();

        $rows = CookieConsent::orderBy('id')->get();
        $this->assertSame([false, true], $rows->pluck('analytics')->all());
        $this->assertSame([self::BODY['consent_id']], $rows->pluck('consent_id')->unique()->values()->all());
        $this->assertSame(1, $rows->first()->version);
        $this->assertNotNull($rows->first()->created_at);
        $columns = Schema::getColumnListing('web_cookie_consents');
        $this->assertNotContains('ip_address', $columns);
        $this->assertNotContains('user_agent', $columns);
    }

    /**
     * @description Invalid records are refused; the endpoint is throttled per IP.
     * @input consent_id 'x'; missing categories; version 0; then 21 valid requests.
     * @output 422 ×3 with the field errors; the 21st answers 429.
     */
    public function test_validation_and_throttle(): void
    {
        $this->postJson('/api/cookie-consents', ['consent_id' => 'x'] + self::BODY)->assertStatus(422)->assertJsonValidationErrors('consent_id');
        $this->postJson('/api/cookie-consents', ['consent_id' => self::BODY['consent_id'], 'version' => 1])->assertStatus(422)
            ->assertJsonValidationErrors(['functional', 'analytics', 'marketing']);
        $this->postJson('/api/cookie-consents', ['version' => 0] + self::BODY)->assertStatus(422)->assertJsonValidationErrors('version');

        for ($i = 4; $i <= 20; $i++) {
            $this->postJson('/api/cookie-consents', self::BODY)->assertNoContent();
        }
        $this->postJson('/api/cookie-consents', self::BODY)->assertStatus(429);
    }
}
