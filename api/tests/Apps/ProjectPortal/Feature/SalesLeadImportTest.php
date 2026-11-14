<?php

/**
 * @file SalesLeadImportTest.php
 * @path api/tests/Apps/ProjectPortal/Feature/SalesLeadImportTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the bulk import of the sales leads - template download,
 *   validation (dry run) and commit (the shared flow of ImportFlowTests with the lead columns).
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures, Tests\Support\ImportFlowTests;
 *   Storage fake ('local' = temporary import files).
 */

namespace Tests\Apps\ProjectPortal\Feature;

use App\Apps\ProjectPortal\Models\SalesLead;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\Support\ImportFlowTests;
use Tests\TestCase;

/**
 * @description /api/project-portal/sales_leads/import/*.
 */
class SalesLeadImportTest extends TestCase
{
    use ProjectFixtures, ImportFlowTests;

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
            'sales leads' => [
                'project-portal/sales_leads', 'project-portal-sales-leads-create',
                ['subject_name', 'first_contact_date', 'source_channel', 'salesman_name', 'contact_person', 'contact_email', 'contact_phone', 'contact_other',
                    'location', 'source_url', 'description', 'priority', 'status', 'last_contact_date', 'next_step', 'rejection_reason'],
                ['subject_name' => 'Imported lead', 'first_contact_date' => '2026-10-01', 'source_channel' => 'referral', 'salesman_name' => 'Petr', 'contact_person' => '',
                    'contact_email' => 'lead@x.cz', 'contact_phone' => '', 'contact_other' => '', 'location' => 'Praha', 'source_url' => '', 'description' => '',
                    'priority' => 'high', 'status' => 'new', 'last_contact_date' => '', 'next_step' => '', 'rejection_reason' => ''],
                ['subject_name' => 'X', 'first_contact_date' => 'not a date', 'source_channel' => 'nope', 'salesman_name' => '', 'contact_person' => '',
                    'contact_email' => '', 'contact_phone' => '', 'contact_other' => '', 'location' => '', 'source_url' => '', 'description' => '',
                    'priority' => 'x', 'status' => 'x', 'last_contact_date' => '', 'next_step' => '', 'rejection_reason' => ''],
                SalesLead::class, 'import-template-project-portal-sales_leads',
            ],
        ];
    }

    /**
     * @description See ImportFlowTests::assertImportLog() - the portal audit log.
     * @param string $eventType Event type.
     * @param string $descriptionContains Part of the description.
     * @return void
     */
    protected function assertImportLog(string $eventType, string $descriptionContains): void
    {
        $this->assertPortalLog($eventType, $descriptionContains);
    }
}
