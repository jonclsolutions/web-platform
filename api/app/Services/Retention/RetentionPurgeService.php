<?php
/**
 * @file RetentionPurgeService.php
 * @path app/Services/Retention/RetentionPurgeService.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Enforces the retention periods of CoreRetentionSetting (GDPR Art. 5(1)(e)): every
 * record whose last change is older than its period is deleted for good - the row (also from the
 * trash), its attachments and their files on the disk, legacy single-file uploads and, for a
 * project, its portal sessions, checkpoints, threads and messages. Nothing is anonymised and kept.
 * Expired project portal sessions (IP address, user agent) are always deleted, independent of
 * any setting. Used by the daily `retention:purge` command and the "run now" action of the admin.
 * @note Records are processed in chunks by primary key (chunkById), so a large backlog never
 * loads at once and deleting while iterating skips nothing. The result of every run is stored on
 * the setting (`last_run_at`, `last_deleted_count`) and in the application log - counts only, no
 * personal data.
 */

namespace App\Services\Retention;

use App\Models\Core\CoreRetentionSetting;
use App\Models\Web\WebCookieConsent;
use App\Models\Web\WebJobApplication;
use App\Models\Web\WebProject;
use App\Models\Web\WebProjectSession;
use App\Models\Web\WebRawRequestCommission;
use App\Models\Web\WebSalesLead;
use App\Models\Web\WebSalesOrder;
use App\Models\Web\WebSupportTicket;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class RetentionPurgeService
{
    /** @description Records loaded per chunk. */
    private const CHUNK = 200;

    /**
     * @description Model class of every kind of data with attachments (morphMany `attachments`).
     * Leads have no attachments; projects and consents have their own handling.
     */
    private const ATTACHMENT_MODELS = [
        'job_applications' => WebJobApplication::class,
        'raw_requests'     => WebRawRequestCommission::class,
        'support_tickets'  => WebSupportTicket::class,
        'sales_orders'     => WebSalesOrder::class,
    ];

    /** @description Legacy single-file column (public disk) of the models that had one. */
    private const LEGACY_FILE_COLUMNS = [
        WebJobApplication::class => 'cv_path',
        WebSupportTicket::class  => 'attachment_path',
    ];

    /**
     * @description Runs every enabled retention and the clean-up of expired portal sessions.
     * @return array<string, int|null> Deleted records per data key (null = retention off) plus
     *   `expired_portal_sessions`.
     */
    public function purgeAll(): array
    {
        $result = [];

        foreach (CoreRetentionSetting::allInOrder() as $setting) {
            if ($setting->retention_days === null) {
                $result[$setting->data_key] = null;
                continue;
            }

            $count = $this->purge($setting->data_key, Carbon::now()->subDays($setting->retention_days));
            $setting->update(['last_run_at' => Carbon::now(), 'last_deleted_count' => $count]);
            $result[$setting->data_key] = $count;
        }

        $result['expired_portal_sessions'] = WebProjectSession::where('expires_at', '<', Carbon::now())->delete();

        Log::info('Retention purge finished', $result);

        return $result;
    }

    /**
     * @description Deletes the records of one kind of data last changed before the cut-off.
     * @param string $key Data key of CoreRetentionSetting::DEFAULTS.
     * @param Carbon $cutoff Records last changed before this moment are deleted.
     * @return int Number of deleted records.
     */
    public function purge(string $key, Carbon $cutoff): int
    {
        return match ($key) {
            'sales_leads'     => $this->purgeRecords(WebSalesLead::withTrashed()->where('updated_at', '<', $cutoff)),
            'projects'        => $this->purgeProjects($cutoff),
            'cookie_consents' => WebCookieConsent::where('created_at', '<', $cutoff)->delete(),
            default           => $this->purgeRecords(
                self::ATTACHMENT_MODELS[$key]::withTrashed()->with('attachments')->where('updated_at', '<', $cutoff)
            ),
        };
    }

    /**
     * @description Force-deletes the records of the query with their attachment files.
     * @param Builder $query Query of the expired records (trashed ones included).
     * @return int Number of deleted records.
     */
    private function purgeRecords(Builder $query): int
    {
        $count = 0;
        $query->chunkById(self::CHUNK, function ($records) use (&$count) {
            foreach ($records as $record) {
                $this->deleteFiles($record);
                $record->forceDelete();
                $count++;
            }
        });

        return $count;
    }

    /**
     * @description Projects without any activity since the cut-off - neither a change of the
     * project nor a message in one of its threads - with everything that belongs to them.
     * @param Carbon $cutoff Cut-off of the last activity.
     * @return int Number of deleted projects.
     */
    private function purgeProjects(Carbon $cutoff): int
    {
        $query = WebProject::withTrashed()
            ->where('updated_at', '<', $cutoff)
            ->whereDoesntHave('threads.messages', fn (Builder $q) => $q->where('created_at', '>=', $cutoff))
            ->with('threads.messages.attachments');

        $count = 0;
        $query->chunkById(self::CHUNK, function ($projects) use (&$count) {
            foreach ($projects as $project) {
                WebProjectSession::where('project_id', $project->id)->delete();
                $project->checkpoints()->delete();
                foreach ($project->threads as $thread) {
                    foreach ($thread->messages as $message) {
                        $this->deleteFiles($message);
                        $message->delete();
                    }
                    $thread->delete();
                }
                $project->forceDelete();
                $count++;
            }
        });

        return $count;
    }

    /**
     * @description Deletes the attachment rows and files of a record and its legacy single file.
     * @param Model $record Record with an optional `attachments` relation.
     * @return void
     */
    private function deleteFiles(Model $record): void
    {
        if (method_exists($record, 'attachments')) {
            foreach ($record->attachments as $attachment) {
                Storage::disk($attachment->disk)->delete($attachment->path);
                $attachment->delete();
            }
        }

        $legacy = self::LEGACY_FILE_COLUMNS[$record::class] ?? null;
        if ($legacy && $record->{$legacy}) {
            Storage::disk('public')->delete($record->{$legacy});
        }
    }
}
