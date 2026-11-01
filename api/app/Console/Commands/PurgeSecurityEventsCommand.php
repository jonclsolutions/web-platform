<?php
/**
 * @file PurgeSecurityEventsCommand.php
 * @path app/Console/Commands/PurgeSecurityEventsCommand.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Scheduled (daily) clean-up of `core_security_events` by the GDPR retention period
 * stored in `core_security_settings.retention_days`. The IP address is personal data - this
 * command enforces storage limitation (Art. 5(1)(e) GDPR).
 * @note The same purge can be started in the admin (`DELETE /core/security_events/purge`,
 * CoreSecurityEventController::purge); both compute the cut-off as now() - retention_days.
 * @note Deletes in batches by primary key instead of one large DELETE: a long lock on a table
 * with many rows would block the concurrent INSERTs of an ongoing attack - the very events
 * this monitoring has to record.
 */

namespace App\Console\Commands;

use App\Models\Core\CoreSecurityEvent;
use App\Models\Core\CoreSecuritySetting;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class PurgeSecurityEventsCommand extends Command
{
    /**
     * @description Name and signature of the Artisan command.
     * @var string
     */
    protected $signature = 'security:purge-events';

    /**
     * @description Short description shown by `php artisan list`.
     * @var string
     */
    protected $description = 'Deletes core_security_events records older than the configured retention period (GDPR).';

    /** @description Size of one delete batch (see the class description - locks / concurrent INSERTs). */
    private const BATCH_SIZE = 1000;

    /**
     * @description Computes the cut-off from the current retention and deletes the older events
     * batch by batch until none is left.
     * @return int Exit code (0 = success).
     */
    public function handle(): int
    {
        $retentionDays = CoreSecuritySetting::current()->retention_days;
        $cutoff = Carbon::now()->subDays($retentionDays);

        $this->info("Deleting core_security_events records older than {$retentionDays} days (before {$cutoff->toDateTimeString()})...");

        $totalDeleted = 0;

        do {
            // Batches by primary key, not by offset: the table is written to concurrently
            // (CoreSecurityEvent::record()), so offset paging could skip or repeat rows.
            $deletedInBatch = CoreSecurityEvent::where('last_seen_at', '<', $cutoff)
                ->limit(self::BATCH_SIZE)
                ->delete();

            $totalDeleted += $deletedInBatch;
        } while ($deletedInBatch > 0);

        $this->info("Done. Total deleted records: {$totalDeleted}.");

        return self::SUCCESS;
    }
}