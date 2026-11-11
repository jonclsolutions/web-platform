<?php
/**
 * @file PurgesRecords.php
 * @path app/Services/Retention/PurgesRecords.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared deletion helpers of the retention purge (core service and module sources):
 * force-delete records in chunks with their attachment files and legacy uploads, and bulk delete
 * in short batches.
 * @note Records are processed in chunks by primary key (chunkById), so a large backlog never loads
 * at once and deleting while iterating skips nothing.
 */

namespace App\Services\Retention;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

trait PurgesRecords
{
    /** @description Records loaded per chunk. */
    protected int $purgeChunk = 200;

    /** @description Rows deleted per statement of a bulk delete (short locks on large tables). */
    protected int $deleteBatch = 5000;

    /**
     * @description Force-deletes the records of the query with their attachment files.
     * @param Builder $query Query of the expired records (trashed ones included).
     * @return int Number of deleted records.
     */
    protected function purgeRecords(Builder $query): int
    {
        $count = 0;
        $query->chunkById($this->purgeChunk, function ($records) use (&$count) {
            foreach ($records as $record) {
                $this->deleteFiles($record);
                $record->forceDelete();
                $count++;
            }
        });

        return $count;
    }

    /**
     * @description Deletes the rows of the query in statements of $deleteBatch rows.
     * @param Builder $query Query of the rows to delete.
     * @return int Number of deleted rows.
     */
    protected function deleteInBatches(Builder $query): int
    {
        $count = 0;
        do {
            $deleted = (clone $query)->limit($this->deleteBatch)->delete();
            $count += $deleted;
        } while ($deleted === $this->deleteBatch);

        return $count;
    }

    /**
     * @description Deletes the attachment rows and files of a record and its legacy single file.
     * @param Model $record Record with an optional `attachments` relation.
     * @return void
     */
    protected function deleteFiles(Model $record): void
    {
        if (method_exists($record, 'attachments')) {
            foreach ($record->attachments as $attachment) {
                Storage::disk($attachment->disk)->delete($attachment->path);
                $attachment->delete();
            }
        }

        $legacy = defined($record::class . '::LEGACY_FILE_COLUMN') ? $record::LEGACY_FILE_COLUMN : null;
        if ($legacy && $record->{$legacy}) {
            Storage::disk('public')->delete($record->{$legacy});
        }
    }
}
