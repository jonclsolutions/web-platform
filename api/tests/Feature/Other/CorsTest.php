<?php

/**
 * @file CorsTest.php
 * @path api/tests/Feature/Other/CorsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the CORS configuration (config/cors.php): no other origin is
 *   allowed by default, only the exact origins of CORS_ALLOWED_ORIGINS, never a wildcard.
 * @dependencies
 * - Tests\TestCase; Illuminate\Http\Middleware\HandleCors (global middleware).
 */

namespace Tests\Feature\Other;

use Tests\TestCase;

/**
 * @description Access-Control-* answers of the API.
 */
class CorsTest extends TestCase
{
    /**
     * @description Restores CORS_ALLOWED_ORIGINS after the tests that set it.
     * @return void
     */
    protected function tearDown(): void
    {
        putenv('CORS_ALLOWED_ORIGINS');
        unset($_ENV['CORS_ALLOWED_ORIGINS'], $_SERVER['CORS_ALLOWED_ORIGINS']);
        parent::tearDown();
    }

    /**
     * @description By default no foreign origin gets an Access-Control-Allow-Origin, so another
     *   site can neither read the answers nor send credentials (the application has one origin).
     * @input GET /api/upload-rules and a preflight of POST /api/refresh with Origin https://evil.example.
     * @output No Access-Control-Allow-Origin / -Credentials header for that origin.
     */
    public function test_foreign_origin_is_not_allowed_by_default(): void
    {
        $this->getJson('/api/upload-rules', ['Origin' => 'https://evil.example'])
            ->assertOk()
            ->assertHeaderMissing('Access-Control-Allow-Origin');

        $this->call('OPTIONS', '/api/refresh', [], [], [], [
            'HTTP_ORIGIN' => 'https://evil.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
        ])->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    /**
     * @description An exact origin of the configuration is allowed with credentials; others are not.
     * @input cors.allowed_origins ['https://partner.example']; requests from it and from https://evil.example.
     * @output Allow-Origin https://partner.example + Allow-Credentials true; never evil.example or '*'.
     */
    public function test_configured_origin_is_allowed_exactly(): void
    {
        config(['cors.allowed_origins' => ['https://partner.example']]);

        $this->getJson('/api/upload-rules', ['Origin' => 'https://partner.example'])
            ->assertHeader('Access-Control-Allow-Origin', 'https://partner.example')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');

        // With one allowed origin the answer always names THAT origin - the browser refuses it
        // for any other page.
        $evil = $this->getJson('/api/upload-rules', ['Origin' => 'https://evil.example']);
        $this->assertNotSame('https://evil.example', $evil->headers->get('Access-Control-Allow-Origin'));
        $this->assertNotSame('*', $evil->headers->get('Access-Control-Allow-Origin'));
    }

    /**
     * @description config/cors.php reads CORS_ALLOWED_ORIGINS as a comma separated list, trims
     *   it, drops empty items and a '*' (a wildcard with credentials would open the API to every site).
     * @input CORS_ALLOWED_ORIGINS " https://a.example , ,*, https://b.example"; then unset.
     * @output ['https://a.example', 'https://b.example']; [].
     */
    public function test_config_reads_exact_origins_without_wildcard(): void
    {
        putenv('CORS_ALLOWED_ORIGINS= https://a.example , ,*, https://b.example');
        $this->assertSame(['https://a.example', 'https://b.example'], (require config_path('cors.php'))['allowed_origins']);

        putenv('CORS_ALLOWED_ORIGINS');
        $this->assertSame([], (require config_path('cors.php'))['allowed_origins']);
        $this->assertTrue((require config_path('cors.php'))['supports_credentials']);
    }
}
