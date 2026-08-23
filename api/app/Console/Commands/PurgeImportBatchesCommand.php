<?php
/**
 * @file PurgeImportBatchesCommand.php
 * @path app/Console/Commands/PurgeImportBatchesCommand.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Denní úklid nevyzvednutých importních dávek - smaže dočasné soubory
 * (a jejich `core_import_batches` záznamy) starší než `temp_file_ttl_hours`
 * (`config/importable_resources.php`), které zůstaly ve stavu `validated` (uživatel
 * udělal dry-run, ale nikdy nepotvrdil commit) nebo `failed`. Zabraňuje neomezenému
 * hromadění dočasných souborů na disku.
 *
 * @note Dávky ve stavu `completed` se NEMAŽOU automaticky - zůstávají jako audit trail
 * (samotný dočasný soubor už byl smazán hned po dokončení zpracování, viz
 * `ImportBatchProcessor::process()`).
 */

namespace App\Console\Commands;

use App\Models\Core\CoreImportBatch;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class PurgeImportBatchesCommand extends Command
{
    protected $signature = 'imports:purge-stale';

    protected $description = 'Smaže nevyzvednuté (validated/failed) importní dávky a jejich dočasné soubory starší než temp_file_ttl_hours.';

    public function handle(): int
    {
        $ttlHours = config('importable_resources.temp_file_ttl_hours', 4);
        $cutoff = Carbon::now()->subHours($ttlHours);

        $stale = CoreImportBatch::whereIn('status', ['validated', 'failed'])
            ->where('created_at', '<', $cutoff)
            ->get();

        foreach ($stale as $batch) {
            if ($batch->temp_path && Storage::disk('local')->exists($batch->temp_path)) {
                Storage::disk('local')->delete($batch->temp_path);
            }
            $batch->delete();
        }

        $this->info("Smazáno {$stale->count()} nevyzvednutých importních dávek.");

        return self::SUCCESS;
    }
}