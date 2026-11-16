<?php

/**
 * @file VersionTest.php
 * @path api/tests/Feature/Other/VersionTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature test of GET /api/version (release of the running code, deploy smoke test).
 * @dependencies
 * - Tests\TestCase.
 */

namespace Tests\Feature\Other;

use Tests\TestCase;

/**
 * @description App\Http\Controllers\Api\VersionController.
 */
class VersionTest extends TestCase
{
    /**
     * @description The release of config app.version is public, never cached, and nothing else
     *   is disclosed.
     * @input app.version = v2026.11.1; GET /api/version without a token.
     * @output 200 {version: v2026.11.1} (only this key), Cache-Control no-store.
     */
    public function test_version_is_public_and_not_cached(): void
    {
        config(['app.version' => 'v2026.11.1']);

        $response = $this->getJson('/api/version')->assertOk()->assertExactJson(['version' => 'v2026.11.1']);
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }
}
