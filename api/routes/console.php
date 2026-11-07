<?php
/**
 * @file console.php
 * @path routes/console.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Artisan commands and the scheduled jobs of the application (Laravel 11+ keeps the
 * scheduler here, not in `app/Console/Kernel.php`).
 * @note Needs a system cron calling `php artisan schedule:run` every minute on the server -
 * without it the scheduler runs nothing.
 */

use App\Console\Commands\PurgeSecurityEventsCommand;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Console\Commands\PurgeImportBatchesCommand;
use App\Console\Commands\PurgePersonalDataCommand;
use App\Console\Commands\PruneAuthDataCommand;
use App\Console\Commands\PruneOrphanFilesCommand;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * @description Daily GDPR clean-up of the security monitoring (PurgeSecurityEventsCommand) - early
 * in the morning, outside the usual traffic.
 */
Schedule::command(PurgeSecurityEventsCommand::class)
    ->dailyAt('03:15')
    ->withoutOverlapping()
    ->runInBackground();

/**
 * @description Daily clean-up of abandoned import batches (dry run without commit, or failed) and
 * their temporary files (PurgeImportBatchesCommand).
 */
Schedule::command(PurgeImportBatchesCommand::class)
    ->dailyAt('03:30')
    ->withoutOverlapping()
    ->runInBackground();
/**
 * @description Daily GDPR retention clean-up of the personal data (PurgePersonalDataCommand):
 * applications, inquiries, leads, tickets, web orders, projects, cookie consents and audit logs
 * older than their period, with their files, and the expired portal sessions.
 */
Schedule::command(PurgePersonalDataCommand::class)
    ->dailyAt('03:45')
    ->withoutOverlapping()
    ->runInBackground();

/**
 * @description Daily clean-up of expired / used authentication rows (2FA codes, reset and
 * activation tokens, refresh tokens) and expired database cache rows (PruneAuthDataCommand).
 */
Schedule::command(PruneAuthDataCommand::class)
    ->dailyAt('04:00')
    ->withoutOverlapping()
    ->runInBackground();

/**
 * @description Daily clean-up of the expired Sanctum access tokens (60 min each, one per login and
 * refresh) - Laravel's own command; rows expired for more than 24 hours.
 */
Schedule::command('sanctum:prune-expired', ['--hours' => 24])
    ->dailyAt('04:05')
    ->withoutOverlapping()
    ->runInBackground();

/**
 * @description Failed queue jobs (their payload may hold e-mail data) are kept 30 days for
 * diagnosis, then deleted - Laravel's own command.
 */
Schedule::command('queue:prune-failed', ['--hours' => 720])
    ->dailyAt('04:10')
    ->withoutOverlapping()
    ->runInBackground();

/**
 * @description Daily deletion of uploaded files without a web_attachments row
 * (PruneOrphanFilesCommand).
 */
Schedule::command(PruneOrphanFilesCommand::class)
    ->dailyAt('04:15')
    ->withoutOverlapping()
    ->runInBackground();
