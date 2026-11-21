<?php
/**
 * @file JsCreatorRetentionSource.php
 * @path app/Apps/JsCreator/Services/JsCreatorRetentionSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Retention of JS Creator (GDPR Art. 5(1)(e)), registered in
 *   JsCreatorApp::retentionSources():
 *   - `js_creator_trash` (default 30 days): what stays in the trash of a workspace longer than
 *     the period (counted from the deletion) is deleted for good with its files - images and
 *     fonts of the library, folders with their subtree;
 *   - the audit log of the application (core `audit_logs` retention);
 *   - always: files of the workspaces without a record (e.g. after an account was deleted for
 *     good - its rows go with the account through the foreign keys, its files here) older than a
 *     day, so an upload in progress is never touched.
 * @dependencies CreatorAsset, CreatorFont (deleteWithFiles), CreatorFolder, FolderTree,
 *   WorkspaceFiles, JsCreatorLog.
 */

namespace App\Apps\JsCreator\Services;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorFolder;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use App\Services\Retention\RetentionSource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;

final class JsCreatorRetentionSource implements RetentionSource
{
    /** @description Minimum age of a file without a record before it is deleted (hours). */
    private const ORPHAN_MIN_AGE_HOURS = 24;

    /** @description See RetentionSource::defaults(). */
    public function defaults(): array
    {
        return ['js_creator_trash' => 30];
    }

    /** @description See RetentionSource::purge() - items deleted before the cut-off. */
    public function purge(string $key, Carbon $cutoff): int
    {
        if ($key !== 'js_creator_trash') {
            throw new InvalidArgumentException("Unknown JS Creator retention key: {$key}");
        }

        $count = 0;
        CreatorAsset::onlyTrashed()->where('deleted_at', '<', $cutoff)->chunkById(200, function ($assets) use (&$count) {
            foreach ($assets as $asset) {
                $asset->deleteWithFiles();
                $count++;
            }
        });
        CreatorFont::onlyTrashed()->where('deleted_at', '<', $cutoff)->chunkById(200, function ($fonts) use (&$count) {
            foreach ($fonts as $font) {
                $font->deleteWithFiles();
                $count++;
            }
        });
        CreatorFolder::trashRoots()->where('deleted_at', '<', $cutoff)->get()->each(function (CreatorFolder $root) use (&$count) {
            (new FolderTree($root->user_id))->forceDelete($root);
            $count++;
        });

        return $count;
    }

    /** @description See RetentionSource::auditLogModels(). */
    public function auditLogModels(): array
    {
        return [JsCreatorLog::class];
    }

    /** @description See RetentionSource::cleanUp(). */
    public function cleanUp(): array
    {
        return ['js_creator_orphan_files' => $this->deleteOrphanFiles()];
    }

    /**
     * @description Deletes files of the workspaces that no image or font refers to (trash
     *   included) and that are older than ORPHAN_MIN_AGE_HOURS.
     * @return int Number of deleted files.
     */
    private function deleteOrphanFiles(): int
    {
        $disk = Storage::disk(WorkspaceFiles::DISK);
        if (!$disk->exists(WorkspaceFiles::ROOT)) {
            return 0;
        }

        $known = array_flip([
            ...CreatorAsset::withTrashed()->pluck('path')->all(),
            ...CreatorAsset::withTrashed()->pluck('thumb_path')->all(),
            ...CreatorFont::withTrashed()->pluck('path')->all(),
        ]);
        $limit = Carbon::now()->subHours(self::ORPHAN_MIN_AGE_HOURS)->getTimestamp();

        $orphans = array_values(array_filter(
            $disk->allFiles(WorkspaceFiles::ROOT),
            fn (string $path) => !isset($known[$path]) && $disk->lastModified($path) < $limit
        ));
        WorkspaceFiles::delete($orphans);

        return count($orphans);
    }
}
