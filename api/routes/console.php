<?php
/**
 * @file console.php
 * @path routes/console.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Registrace Artisan příkazů a definice naplánovaných (scheduled) úloh
 * aplikace. V Laravel 11+ žije scheduler přímo zde, ne v `app/Console/Kernel.php`.
 *
 * @refactor-note (2026-08-22) BEZPEČNOSTNÍ MONITORING (krok 3/4 backlogu): naplánován
 * denní běh `security:purge-events` (PurgeSecurityEventsCommand) - maže záznamy
 * `core_security_events` starší než `core_security_settings.retention_days` (GDPR
 * retence osobních údajů, primárně IP adres). `withoutOverlapping()` zabraňuje souběhu
 * dvou instancí, pokud by předchozí běh trval nezvykle dlouho (velký objem dat po
 * útoku); `runInBackground()` ať case neblokuje ostatní naplánované úlohy v tomtéž
 * cyklu. Stejnou akci lze kdykoliv spustit i ručně z admin UI
 * (`DELETE /core/security_events/purge`, CoreSecurityEventController::purge) - tenhle
 * scheduled běh je jen automatizace stejné operace, ne náhrada za manuální tlačítko.
 * @note Vyžaduje, aby na serveru běžel systémový cron volající `php artisan schedule:run`
 * jednou za minutu (standardní Laravel nastavení) - bez toho scheduler sám o sobě nic
 * nespustí.
 */

use App\Console\Commands\PurgeSecurityEventsCommand;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Console\Commands\PurgeImportBatchesCommand;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * @description Denní GDPR úklid bezpečnostního monitoringu - viz PurgeSecurityEventsCommand
 * a refactor-note výše. Spouští se brzy ráno, mimo běžnou návštěvnost webu/e-shopu.
 */
Schedule::command(PurgeSecurityEventsCommand::class)
    ->dailyAt('03:15')
    ->withoutOverlapping()
    ->runInBackground();

/**
 * @description Denní úklid nevyzvednutých importních dávek (dry-run bez commitu,
 * nebo se selhaným zpracováním) a jejich dočasných souborů na disku - viz
 * PurgeImportBatchesCommand.
 */
Schedule::command(PurgeImportBatchesCommand::class)
    ->dailyAt('03:30')
    ->withoutOverlapping()
    ->runInBackground();