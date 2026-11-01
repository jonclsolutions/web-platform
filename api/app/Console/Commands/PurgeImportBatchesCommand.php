<?php
/**
 * @file PurgeImportBatchesCommand.php
 * @path app/Console/Commands/PurgeImportBatchesCommand.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Daily clean-up of abandoned import batches: deletes the temporary files (and
 * their `core_import_batches` rows) older than `temp_file_ttl_hours`
 * (`config/importable_resources.php`) that stayed `validated` (dry run, never committed) or
 * `failed`, so temporary files do not pile up on the disk.
 * @note `completed` batches are kept as an audit trail (their temporary file was already
 * deleted right after processing, see `ImportBatchProcessor::process()`).
 */

namespace App\Console\Commands;

use App\Models\Core\CoreImportBatch;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class PurgeImportBatchesCommand extends Command
{
    protected $signature = 'imports:purge-stale';

    protected $description = 'Deletes uncollected (validated/failed) import batches and their temporary files older than temp_file_ttl_hours.';

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

        $this->info("Deleted {$stale->count()} uncollected import batches.");

        return self::SUCCESS;
    }
}