<?php

/**
 * @file WebImportTest.php
 * @path api/tests/Apps/Web/Feature/WebImportTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the bulk import of the web section - template download,
 *   validation (dry run) and commit - for the commission requests (the shared flow of
 *   ImportFlowTests with their columns).
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Web\Support\WebFixtures, Tests\Support\ImportFlowTests; Storage
 *   fake ('local' = temporary import files).
 */

namespace Tests\Apps\Web\Feature;

use App\Apps\Web\Models\WebRawRequestCommission;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\Web\Support\WebFixtures;
use Tests\Support\ImportFlowTests;
use Tests\TestCase;

/**
 * @description /api/web/raw_request_commissions/import/*.
 */
class WebImportTest extends TestCase
{
    use WebFixtures, ImportFlowTests;

    /**
     * @description Fake disk for the temporary import files.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /**
     * @description See ImportFlowTests::resources().
     * @return array<string, array{0: string, 1: string, 2: string[], 3: array, 4: array, 5: class-string, 6: string}>
     */
    public static function resources(): array
    {
        return [
            'commission requests' => [
                'web/raw_request_commissions', 'web-user-requests-create',
                ['thema', 'contact_email', 'contact_phone', 'order_description', 'status', 'priority', 'note'],
                ['thema' => 'Imported request', 'contact_email' => 'a@b.cz', 'contact_phone' => '', 'order_description' => 'Text', 'status' => 'new', 'priority' => 'low', 'note' => ''],
                ['thema' => 'x', 'contact_email' => 'bad', 'contact_phone' => '', 'order_description' => '', 'status' => 'new', 'priority' => 'low', 'note' => ''],
                WebRawRequestCommission::class, 'import-template-web-raw_request_commissions',
            ],
        ];
    }

    /**
     * @description See ImportFlowTests::assertImportLog() - the web audit log.
     * @param string $eventType Event type.
     * @param string $descriptionContains Part of the description.
     * @return void
     */
    protected function assertImportLog(string $eventType, string $descriptionContains): void
    {
        $this->assertWebLog($eventType, $descriptionContains);
    }
}
