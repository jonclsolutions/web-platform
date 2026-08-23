<?php
/**
 * @file ImportRowsJob.php
 * @path app/Jobs/ImportRowsJob.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Queue job pro zpracování velkých importů (nad `queue_threshold` validních
 * řádků z `config/importable_resources.php`) na pozadí, mimo synchronní HTTP request
 * (ochrana proti timeoutu). Deleguje na STEJNÝ `ImportBatchProcessor`, jaký používá
 * synchronní cesta v `ImportController::commit()` - žádná duplicitní logika.
 *
 * @note Bez HTTP requestu (běží v `queue:work` procesu) - `ImportBatchProcessor::process()`
 * proto dostane `$request = null` a zaloguje výsledek bez IP/user-agent kontextu, jen
 * s uživatelem dohledaným podle `$batch->user_id` (viz `ImportBatchProcessor::logResult()`).
 */

namespace App\Jobs;

use App\Models\Core\CoreImportBatch;
use App\Services\Import\ImportBatchProcessor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ImportRowsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** @description Max. počet pokusů - selhání importu se NEMÁ opakovat automaticky (mohlo by vést k duplicitnímu zápisu částí souboru, i přes ochranu unique_by). */
    public int $tries = 1;

    /** @description Timeout jobu v sekundách - velký soubor (desítky tisíc řádků) může běžet dlouho. */
    public int $timeout = 1800; // 30 minut

    public function __construct(
        private readonly int $batchId
    ) {}

    public function handle(ImportBatchProcessor $processor): void
    {
        $batch = CoreImportBatch::find($this->batchId);
        if ($batch === null) {
            return; // Dávka mezitím smazána (např. ruční úklid) - nic k dělání.
        }

        $config = config("importable_resources.resources.{$batch->resource}");
        if ($config === null) {
            $batch->update(['status' => 'failed']);
            return;
        }

        $batch->update(['status' => 'processing']);

        try {
            $processor->process($batch, $config, null);
        } catch (\Throwable $e) {
            $batch->update(['status' => 'failed']);
            report($e);
        }
    }

    /**
     * @description Voláno Laravelem při definitivním selhání jobu (po vyčerpání `$tries`) -
     * jistota, že dávka nezůstane navěky ve stavu 'queued'/'processing', i kdyby handle()
     * spadl na neočekávané chybě dřív, než stihne vlastní try/catch.
     */
    public function failed(\Throwable $exception): void
    {
        $batch = CoreImportBatch::find($this->batchId);
        $batch?->update(['status' => 'failed']);
    }
}