<?php
/**
 * @file HandlesImportBatches.php
 * @path app/Traits/HandlesImportBatches.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Two-step bulk import (dry-run validate -> commit), reusable by any resource
 * controller - the ONE place where temporary import files (storage/app/private/imports) are
 * created and deleted.
 * @architecture `startImportBatch()` stores the file and creates the `CoreImportBatch` row.
 * `runImportCommit()` wraps the database write (callback) in `try/finally`: the temporary file
 * is ALWAYS deleted after a commit attempt, successful or not - the controller never deletes it
 * itself.
 * @note Safety net: when a request dies otherwise (fatal error, worker timeout on a large file),
 * `PurgeImportBatchesCommand` (daily, routes/console.php) deletes old `validated` / `failed`
 * batches and their temporary files.
 */

namespace App\Traits;

use App\Models\Core\CoreImportBatch;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

trait HandlesImportBatches
{
    /**
     * @description Disk of the temporary import files - one value for every controller.
     */
    protected function importTempDisk(): string
    {
        return 'local';
    }

    /**
     * @description Stores the uploaded file under `imports/` on `importTempDisk()` and creates
     * the `CoreImportBatch` row in state `'validated'`.
     * @param Request $request Current request (user_id and the uploaded file).
     * @param string $resource Resource key (e.g. 'web/news') - descriptive only, stored.
     * @param string $format 'csv'|'json'|'txt'.
     * @param int $totalRows
     * @param int $validRows
     * @param int $invalidRows
     * @param array $errorSummary
     * @return CoreImportBatch
     */
    protected function startImportBatch(
        Request $request,
        string $resource,
        string $format,
        int $totalRows,
        int $validRows,
        int $invalidRows,
        array $errorSummary
    ): CoreImportBatch {
        $tempPath = 'imports/' . Str::uuid() . '.' . $format;
        Storage::disk($this->importTempDisk())->put(
            $tempPath,
            file_get_contents($request->file('file')->getRealPath())
        );

        return CoreImportBatch::create([
            'resource'          => $resource,
            'user_id'           => $request->user()->id,
            'original_filename' => $request->file('file')->getClientOriginalName(),
            'format'            => $format,
            'temp_path'         => $tempPath,
            'status'            => 'validated',
            'total_rows'        => $totalRows,
            'valid_rows'        => $validRows,
            'invalid_rows'      => $invalidRows,
            'error_summary'     => $errorSummary,
        ]);
    }

    /**
     * @description Finds and checks the `CoreImportBatch` of `import_token` - it must belong to
     * the calling user and be in state `'validated'`.
     * @return CoreImportBatch|null Null = invalid / foreign / already processed token.
     */
    protected function findPendingImportBatch(Request $request, int $importToken): ?CoreImportBatch
    {
        $batch = CoreImportBatch::find($importToken);

        if ($batch === null || $batch->user_id !== $request->user()->id || $batch->status !== 'validated') {
            return null;
        }

        return $batch;
    }

    /**
     * @description Wraps the database write of the import (callback `$commitFn`) so that the
     * temporary file is ALWAYS deleted after the attempt - whether `$commitFn` returns or throws
     * (`finally`).
     * @param CoreImportBatch $batch
     * @param callable(UploadedFile $uploadedFile): array $commitFn Gets an `UploadedFile` rebuilt
     *   from the temporary file and returns `['imported_count' => int, 'skipped_count' => int]`.
     *   May throw - the exception is NOT caught here (the caller handles it in its own
     *   try/catch); the `finally` block still deletes the file.
     * @return array{imported_count: int, skipped_count: int} Result of `$commitFn`.
     * @throws \Throwable Anything `$commitFn` throws - passed on unchanged.
     */
    protected function runImportCommit(CoreImportBatch $batch, callable $commitFn): array
    {
        if (!Storage::disk($this->importTempDisk())->exists($batch->temp_path)) {
            throw new \RuntimeException('The temporary import file has expired. Please upload the file again.', 410);
        }

        $batch->update(['status' => 'processing']);

        try {
            $realPath = Storage::disk($this->importTempDisk())->path($batch->temp_path);
            $uploadedFile = new UploadedFile($realPath, $batch->original_filename ?? 'import', null, null, true);

            $result = $commitFn($uploadedFile);

            $batch->update([
                'status'         => 'completed',
                'imported_count' => $result['imported_count'],
                'skipped_count'  => $result['skipped_count'],
                'completed_at'   => now(),
            ]);

            return $result;
        } catch (\Throwable $e) {
            $batch->update(['status' => 'failed']);
            throw $e;
        } finally {
            // Regardless of success or failure above - the file is no longer needed. This is the ONLY
            // place of the application that deletes a temporary import file.
            Storage::disk($this->importTempDisk())->delete($batch->temp_path);
        }
    }
}