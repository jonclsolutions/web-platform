<?php
/**
 * @file PurgeSecurityEventsCommand.php
 * @path app/Console/Commands/PurgeSecurityEventsCommand.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Naplánovaný (denní) úklid tabulky `core_security_events` podle GDPR
 * retenční doby uložené v `core_security_settings.retention_days`. IP adresa je osobní
 * údaj - tenhle příkaz je mechanismus, který reálně dodržuje zásadu minimalizace uchování
 * dat (čl. 5/1/e GDPR), ne jen deklaraci v zásadách zpracování.
 *
 * @note Stejnou logiku lze spustit i ručně z admin UI přes
 * `DELETE /core/security_events/purge` (CoreSecurityEventController::purge) - tenhle
 * command je automatizace TÉ SAMÉ akce naplánovaná přes Laravel scheduler (routes/console.php),
 * ne duplicitní/odlišná implementace. Obě místa počítají cutoff datum stejným způsobem
 * (now() - retention_days), takže chování manuálního tlačítka a automatického běhu je
 * vždy konzistentní.
 *
 * @note Mazání probíhá po dávkách (`chunkById`/limit v cyklu), ne jedním velkým
 * DELETE - u tabulky, která může za dobu retence nabrat desítky/stovky tisíc řádků
 * (i po bucketingu, viz CoreSecurityEvent::record()), by jeden neomezený DELETE mohl
 * dlouho držet zámek nad tabulkou a blokovat souběžné INSERTy z právě probíhajícího
 * útoku - přesně ten scénář, který má tenhle monitoring odhalit, ne zhoršit.
 */

namespace App\Console\Commands;

use App\Models\Core\CoreSecurityEvent;
use App\Models\Core\CoreSecuritySetting;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class PurgeSecurityEventsCommand extends Command
{
    /**
     * @description Název a signatura příkazu pro Artisan CLI / scheduler.
     * @var string
     */
    protected $signature = 'security:purge-events';

    /**
     * @description Krátký popis zobrazený v `php artisan list`.
     * @var string
     */
    protected $description = 'Deletes core_security_events records older than the configured retention period (GDPR).';

    /** @description Velikost jedné mazací dávky - viz doc blok třídy (zámky/souběžné INSERTy). */
    private const BATCH_SIZE = 1000;

    /**
     * @description Provede samotný purge - spočítá cutoff datum z aktuální retenční
     * hodnoty a smaže odpovídající záznamy po dávkách, dokud nějaké zbývají.
     * @return int Exit kód (0 = úspěch).
     */
    public function handle(): int
    {
        $retentionDays = CoreSecuritySetting::current()->retention_days;
        $cutoff = Carbon::now()->subDays($retentionDays);

        $this->info("Deleting core_security_events records older than {$retentionDays} days (before {$cutoff->toDateTimeString()})...");

        $totalDeleted = 0;

        do {
            // Mažeme po dávkách přes primární klíč, ne přes offset - u tabulky, do které
            // se souběžně zapisuje (viz CoreSecurityEvent::record()), by offset-based
            // stránkování mohlo přeskočit nebo duplicitně zpracovat řádky.
            $deletedInBatch = CoreSecurityEvent::where('last_seen_at', '<', $cutoff)
                ->limit(self::BATCH_SIZE)
                ->delete();

            $totalDeleted += $deletedInBatch;
        } while ($deletedInBatch > 0);

        $this->info("Done. Total deleted records: {$totalDeleted}.");

        return self::SUCCESS;
    }
}