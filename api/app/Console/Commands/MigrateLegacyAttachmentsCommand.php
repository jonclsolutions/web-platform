<?php
/**
 * @file MigrateLegacyAttachmentsCommand.php
 * @path app/Console/Commands/MigrateLegacyAttachmentsCommand.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-23
 * @description One-time GDPR migration (open finding #31): CVs of job applications
 *   (`web_job_applications.cv_path`) and ticket attachments (`web_support_tickets.attachment_path`)
 *   uploaded before the `web_attachments` refactor lie on the PUBLIC disk - with the `storage`
 *   symlink they are reachable by anyone who knows / guesses the URL (`/storage/cv_files/…`),
 *   without a signed link, and no admin screen lists them any more. This command moves every
 *   such file to the PRIVATE disk (`web/cv_files/…`, `web/tickets/…` like new uploads), creates
 *   its `web_attachments` row (signed download / preview as for every other attachment) and
 *   clears the legacy columns.
 * @note Run once after the deploy: `php artisan attachments:migrate-legacy --dry-run`, then without
 *   `--dry-run`. Idempotent: rows already migrated have empty legacy columns. A missing file is
 *   reported and its legacy columns are cleared (nothing to protect any more). Soft-deleted
 *   records are migrated too (the file is personal data either way).
 * @dependencies
 * - WebJobApplication / WebSupportTicket (`attachments()` morph relation), Storage disks public + private.
 */

namespace App\Console\Commands;

use App\Models\Web\WebJobApplication;
use App\Models\Web\WebSupportTicket;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class MigrateLegacyAttachmentsCommand extends Command
{
    /** @var string */
    protected $signature = 'attachments:migrate-legacy {--dry-run : Only report what would be moved}';

    /** @var string */
    protected $description = 'Moves legacy CVs / ticket attachments from the public to the private disk and registers them as web_attachments (GDPR).';

    /**
     * @var array<int, array{model: class-string<Model>, path: string, name: string, folder: string}>
     *   Legacy single-file columns and the private folder of the new uploads.
     */
    private const SOURCES = [
        ['model' => WebJobApplication::class, 'path' => 'cv_path', 'name' => 'cv_original_name', 'folder' => 'web/cv_files'],
        ['model' => WebSupportTicket::class, 'path' => 'attachment_path', 'name' => 'attachment_original_name', 'folder' => 'web/tickets'],
    ];

    /**
     * @description Migrates every legacy file of every source.
     * @return int Command exit code (0 = all done, 1 = at least one file failed).
     */
    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $moved = $missing = $failed = 0;

        foreach (self::SOURCES as $source) {
            $records = $source['model']::withTrashed()
                ->whereNotNull($source['path'])->where($source['path'], '!=', '')
                ->get();

            foreach ($records as $record) {
                $result = $this->migrateRecord($record, $source, $dryRun);
                match ($result) {
                    'moved'   => $moved++,
                    'missing' => $missing++,
                    default   => $failed++,
                };
            }
        }

        $prefix = $dryRun ? '[dry-run] would move' : 'Moved';
        $this->info("{$prefix} {$moved} file(s); missing {$missing}; failed {$failed}.");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @description Moves the file of one record and registers it as an attachment.
     * @param Model $record Job application or ticket with a legacy path.
     * @param array{model: class-string<Model>, path: string, name: string, folder: string} $source
     * @param bool $dryRun Only report.
     * @return string 'moved' | 'missing' | 'failed'
     */
    private function migrateRecord(Model $record, array $source, bool $dryRun): string
    {
        $oldPath = (string) $record->{$source['path']};
        $label = class_basename($record) . " #{$record->getKey()}";
        $public = Storage::disk('public');

        if (!$public->exists($oldPath)) {
            $this->warn("{$label}: file {$oldPath} not found - legacy columns cleared.");
            if (!$dryRun) {
                $this->clearLegacy($record, $source);
            }
            return 'missing';
        }

        $newPath = $source['folder'] . '/' . basename($oldPath);
        if ($dryRun) {
            $this->line("{$label}: {$oldPath} → private:{$newPath}");
            return 'moved';
        }

        try {
            $private = Storage::disk('private');
            $private->put($newPath, $public->get($oldPath));

            DB::transaction(function () use ($record, $source, $oldPath, $newPath, $public) {
                $record->attachments()->create([
                    'disk'              => 'private',
                    'path'              => $newPath,
                    'original_filename' => $record->{$source['name']} ?: basename($oldPath),
                    'mime_type'         => $public->mimeType($oldPath) ?: null,
                    'size_bytes'        => $public->size($oldPath),
                ]);
                $this->clearLegacy($record, $source);
            });

            $public->delete($oldPath);
            $this->line("{$label}: moved to private:{$newPath}");
            return 'moved';
        } catch (\Throwable $e) {
            Storage::disk('private')->delete($newPath);  // no orphaned copy - the public original stays
            $this->error("{$label}: {$e->getMessage()}");
            return 'failed';
        }
    }

    /**
     * @description Clears the legacy path / name columns of a record (without touching updated_at).
     * @param Model $record Job application or ticket.
     * @param array{model: class-string<Model>, path: string, name: string, folder: string} $source
     * @return void
     */
    private function clearLegacy(Model $record, array $source): void
    {
        $record->timestamps = false;
        $record->forceFill([$source['path'] => null, $source['name'] => null])->saveQuietly();
        $record->timestamps = true;
    }
}
