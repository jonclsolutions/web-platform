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
 * project, its portal sessions, checkpoints, threads and messages. Audit logs (core / web / e-shop)
 * and finished import batches are deleted by their creation time. Nothing is anonymised and kept.
 * Expired project portal sessions (IP address, user agent) are always deleted, independent of
 * any setting. Used by the daily `retention:purge` command and the "run now" action of the admin.
 * @note Records are processed in chunks by primary key (chunkById), so a large backlog never
 * loads at once and deleting while iterating skips nothing. The result of every run is stored on
 * the setting (`last_run_at`, `last_deleted_count`) and in the application log - counts only, no
 * personal data.
 */

namespace App\Services\Retention;

use App\Models\Core\CoreImportBatch;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreRetentionSetting;
use App\Models\Shop\ShopLog;
use App\Models\Web\WebCookieConsent;
use App\Models\Web\WebJobApplication;
use App\Models\Web\WebLog;
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

    /** @description Audit log models deleted by the `audit_logs` retention. */
    private const AUDIT_LOG_MODELS = [CoreLog::class, WebLog::class, ShopLog::class];

    /** @description Rows deleted per statement of a bulk delete (short locks on large tables). */
    private const DELETE_BATCH = 5000;

    /** @var array<int, string> Data keys whose purge failed in the last purgeAll() run. */
    private array $failed = [];

    /**
     * @description Runs every enabled retention and the clean-up of expired portal sessions. Each
     *   kind of data runs on its own: a failure is logged (Log::error) and the next kinds still run;
     *   the failed setting keeps its previous `last_run_at`. Failed keys: failedKeys().
     * @return array<string, int|null> Deleted records per data key (null = retention off or
     *   failed) plus `expired_portal_sessions`.
     */
    public function purgeAll(): array
    {
        $result = [];
        $this->failed = [];

        foreach (CoreRetentionSetting::allInOrder() as $setting) {
            if ($setting->retention_days === null) {
                $result[$setting->data_key] = null;
                continue;
            }

            $result[$setting->data_key] = $this->attempt($setting->data_key, function () use ($setting) {
                $count = $this->purge($setting->data_key, Carbon::now()->subDays($setting->retention_days));
                $setting->update(['last_run_at' => Carbon::now(), 'last_deleted_count' => $count]);

                return $count;
            });
        }

        $result['expired_portal_sessions'] = $this->attempt('expired_portal_sessions',
            fn () => WebProjectSession::where('expires_at', '<', Carbon::now())->delete());

        if ($this->failed === []) {
            Log::info('Retention purge finished', $result);
        } else {
            Log::error('Retention purge finished with failures', ['failed' => $this->failed, 'result' => $result]);
        }

        return $result;
    }

    /**
     * @description Data keys whose purge failed in the last purgeAll() run.
     * @return array<int, string>
     */
    public function failedKeys(): array
    {
        return $this->failed;
    }

    /**
     * @description Runs one kind of the purge; a failure (also a missing class) is logged and
     *   remembered instead of stopping the whole run.
     * @param string $key Data key (for the log / failedKeys()).
     * @param callable(): int $purge The purge of that kind of data.
     * @return int|null Deleted records, null when it failed.
     */
    private function attempt(string $key, callable $purge): ?int
    {
        try {
            return $purge();
        } catch (\Throwable $e) {
            $this->failed[] = $key;
            Log::error('Retention purge failed', ['data_key' => $key, 'error' => get_class($e) . ': ' . $e->getMessage()]);

            return null;
        }
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
            'audit_logs'      => $this->purgeAuditLogs($cutoff),
            default           => $this->purgeRecords(
                self::ATTACHMENT_MODELS[$key]::withTrashed()->with('attachments')->where('updated_at', '<', $cutoff)
            ),
        };
    }

    /**
     * @description Deletes the audit log rows of the three modules and the finished import
     * batches (their temporary file is already gone) created before the cut-off.
     * @param Carbon $cutoff Rows created before this moment are deleted.
     * @return int Number of deleted rows.
     */
    private function purgeAuditLogs(Carbon $cutoff): int
    {
        $count = 0;
        foreach (self::AUDIT_LOG_MODELS as $model) {
            $count += $this->deleteInBatches($model::where('created_at', '<', $cutoff));
        }

        return $count + $this->deleteInBatches(CoreImportBatch::where('status', 'completed')->where('created_at', '<', $cutoff));
    }

    /**
     * @description Deletes the rows of the query in statements of DELETE_BATCH rows.
     * @param Builder $query Query of the rows to delete.
     * @return int Number of deleted rows.
     */
    private function deleteInBatches(Builder $query): int
    {
        $count = 0;
        do {
            $deleted = (clone $query)->limit(self::DELETE_BATCH)->delete();
            $count += $deleted;
        } while ($deleted === self::DELETE_BATCH);

        return $count;
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

        $legacy = defined($record::class . '::LEGACY_FILE_COLUMN') ? $record::LEGACY_FILE_COLUMN : null;
        if ($legacy && $record->{$legacy}) {
            Storage::disk('public')->delete($record->{$legacy});
        }
    }
}
