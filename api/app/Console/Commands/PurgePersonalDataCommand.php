<?php
/**
 * @file PurgePersonalDataCommand.php
 * @path app/Console/Commands/PurgePersonalDataCommand.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Scheduled (daily) GDPR retention clean-up: deletes job applications, inquiries,
 * leads, support tickets, web orders, projects and cookie consents older than their retention
 * period (core_retention_settings) together with their files, and the expired portal sessions -
 * see RetentionPurgeService. The admin can run the same purge at once (Web settings → Data retention).
 * @note Requires the production cron calling `php artisan schedule:run` every minute.
 */

namespace App\Console\Commands;

use App\Services\Retention\RetentionPurgeService;
use Illuminate\Console\Command;

class PurgePersonalDataCommand extends Command
{
    /**
     * @description Name and signature of the Artisan command.
     * @var string
     */
    protected $signature = 'retention:purge';

    /**
     * @description Short description shown by `php artisan list`.
     * @var string
     */
    protected $description = 'Deletes personal data older than its retention period (GDPR storage limitation).';

    /**
     * @description Runs the purge and prints the deleted counts per kind of data; a kind that
     *   failed is printed as FAILED and the command ends with an error code (scheduler output).
     * @param RetentionPurgeService $service The purge.
     * @return int Exit code (0 = success, 1 = at least one kind failed).
     */
    public function handle(RetentionPurgeService $service): int
    {
        $result = $service->purgeAll();
        $failed = $service->failedKeys();

        foreach ($result as $key => $count) {
            $state = in_array($key, $failed, true) ? 'FAILED' : ($count === null ? 'off' : $count);
            $this->line(sprintf('%-24s %s', $key, $state));
        }

        if ($failed !== []) {
            $this->error('Retention purge failed for: ' . implode(', ', $failed) . ' (see the application log).');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
