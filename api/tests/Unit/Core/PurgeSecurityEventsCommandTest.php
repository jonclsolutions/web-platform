<?php

/**
 * @file PurgeSecurityEventsCommandTest.php
 * @path api/tests/Unit/Core/PurgeSecurityEventsCommandTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the scheduled GDPR clean-up `security:purge-events`.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema).
 */

namespace Tests\Unit\Core;

use App\Models\Core\CoreSecurityEvent;
use App\Models\Core\CoreSecuritySetting;
use Tests\TestCase;

/**
 * @description App\Console\Commands\PurgeSecurityEventsCommand.
 */
class PurgeSecurityEventsCommandTest extends TestCase
{
    /**
     * @description Events older than the retention are deleted (in batches), newer ones stay.
     * @input Retention 14 days; 3 events seen 20 days ago, 1 event seen 2 days ago.
     * @output Exit 0; output names the retention and "Total deleted records: 3"; 1 event left.
     */
    public function test_purges_events_older_than_retention(): void
    {
        CoreSecuritySetting::current()->update(['retention_days' => 14]);
        foreach ([20, 20, 20, 2] as $i => $daysAgo) {
            CoreSecurityEvent::create([
                'fingerprint' => hash('sha256', (string) $i), 'event_type' => 'x',
                'first_seen_at' => now()->subDays($daysAgo), 'last_seen_at' => now()->subDays($daysAgo),
            ]);
        }

        $this->artisan('security:purge-events')
            ->expectsOutputToContain('older than 14 days')
            ->expectsOutputToContain('Total deleted records: 3')
            ->assertExitCode(0);

        $this->assertSame(1, CoreSecurityEvent::count());
    }
}
