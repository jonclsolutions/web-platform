<?php
/**
 * @file PruneOrphanFilesCommand.php
 * @path app/Console/Commands/PruneOrphanFilesCommand.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Daily check that no uploaded file outlives its record: every file in the upload
 * folders of the private disk (those of the registered applications, AppManifest::uploadFolders(),
 * e.g. CVs, inquiry, order and portal attachments) must have its attachment row (CoreAttachment), every profile photo (avatars) its users row. A file without one - e.g. left by an upload whose database write
 * failed, or by a manual change of the database - is personal data without an owner and is
 * deleted (GDPR storage limitation). `--dry-run` only lists the counts.
 * @note Only files older than one day are touched, so an upload in progress (file stored, row
 * not written yet) is never deleted.
 * @dependencies CoreAttachment, AppRegistry, User (avatar_path), UserAvatar::FOLDER
 */

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Apps\AppRegistry;
use App\Models\Core\CoreAttachment;
use App\Support\Images\UserAvatar;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class PruneOrphanFilesCommand extends Command
{
    /** @description Disk of the uploads. */
    private const DISK = 'private';

    /** @description Upload folders of the core (the applications add theirs, see folders()). */
    public const CORE_FOLDERS = [UserAvatar::FOLDER];

    /** @description Minimum age of a file without a record before it is deleted (hours). */
    private const MIN_AGE_HOURS = 24;

    /**
     * @description Name and signature of the Artisan command.
     * @var string
     */
    protected $signature = 'storage:prune-orphans {--dry-run : Only report, delete nothing}';

    /**
     * @description Short description shown by `php artisan list`.
     * @var string
     */
    protected $description = 'Deletes uploaded files that no attachment / users row refers to (older than one day).';

    /**
     * @description Finds and deletes (or with --dry-run reports) the files without a record.
     * @return int Exit code (0 = success).
     */
    public function handle(): int
    {
        $disk = Storage::disk(self::DISK);
        // Soft-deleted accounts keep their photo (restore) - it is still known.
        $known = CoreAttachment::where('disk', self::DISK)->pluck('path')
            ->merge(User::withTrashed()->whereNotNull('avatar_path')->pluck('avatar_path'))
            ->flip();
        $cutoff = Carbon::now()->subHours(self::MIN_AGE_HOURS)->getTimestamp();
        $dryRun = (bool) $this->option('dry-run');
        $orphans = 0;

        foreach (self::folders() as $folder) {
            foreach ($disk->allFiles($folder) as $path) {
                if ($known->has($path) || $disk->lastModified($path) >= $cutoff) {
                    continue;
                }
                $orphans++;
                if (!$dryRun) {
                    $disk->delete($path);
                }
            }
        }

        $this->info(($dryRun ? 'Files without a record: ' : 'Deleted files without a record: ') . $orphans);
        if (!$dryRun) {
            Log::info('Orphan upload files pruned', ['deleted' => $orphans]);
        }

        return self::SUCCESS;
    }

    /**
     * @description Folders checked: the core ones and those of the registered applications.
     * @return array<int, string>
     */
    public static function folders(): array
    {
        return array_values(array_unique([...self::CORE_FOLDERS, ...AppRegistry::uploadFolders()]));
    }
}
