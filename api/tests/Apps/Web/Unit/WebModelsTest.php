<?php

/**
 * @file WebModelsTest.php
 * @path api/tests/Apps/Web/Unit/WebModelsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the web models: relations not reached through the API.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Web\Support\WebFixtures.
 */

namespace Tests\Apps\Web\Unit;

use Illuminate\Support\Facades\Storage;
use Tests\Apps\Web\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description App\Apps\Web\Models\*.
 */
class WebModelsTest extends TestCase
{
    use WebFixtures;

    /**
     * @description The attachments of the web records resolve to their owners (morph aliases of
     *   WebApp::morphMap()).
     * @input Raw request and job application, one attachment each.
     * @output attachment → its owner; owner → its attachments.
     */
    public function test_relations(): void
    {
        Storage::fake('private');
        $request = $this->rawRequest();
        $application = $this->jobApplication();

        $this->assertTrue($this->attach($request)->attachable->is($request));
        $this->assertTrue($this->attach($application)->attachable->is($application));
        $this->assertSame(1, $request->attachments()->count());
    }
}
