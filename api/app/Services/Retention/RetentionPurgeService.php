<?php
/**
 * @file RetentionPurgeService.php
 * @path app/Services/Retention/RetentionPurgeService.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Enforces the retention periods of CoreRetentionSetting (GDPR Art. 5(1)(e)): every
 * record whose period is over is deleted for good. The kinds of data come from the modules
 * registered in config/retention.php (RetentionSource - web, e-shop, …); the core itself owns only
 * `audit_logs`: the core log, the logs of the registered modules and finished import batches,
 * deleted by their creation time. The always-run clean-ups of the modules (e.g. expired portal
 * sessions) run on every purge. Used by the daily `retention:purge` command and the "run now"
 * action of the admin.
 * @note The core names no module model: a removed module (its source class no longer exists) is
 * skipped, its settings are no longer listed. Each kind of data runs on its own - a failure is
 * logged and the others still run. The result of every run is stored on the setting
 * (`last_run_at`, `last_deleted_count`) and in the application log - counts only, no personal data.
 */

namespace App\Services\Retention;

use App\Models\Core\CoreImportBatch;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreRetentionSetting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class RetentionPurgeService
{
    use PurgesRecords;

    /** @description Data key of the core retention (audit logs of all modules + import batches). */
    public const AUDIT_LOGS = 'audit_logs';

    /** @var array<int, string> Data keys whose purge failed in the last purgeAll() run. */
    private array $failed = [];

    /**
     * @description The registered module sources whose class exists (config/retention.php).
     * @return array<int, RetentionSource>
     */
    public static function sources(): array
    {
        $sources = [];
        foreach ((array) config('retention.sources', []) as $class) {
            if (is_string($class) && class_exists($class) && is_subclass_of($class, RetentionSource::class)) {
                $sources[] = app($class);
            }
        }

        return $sources;
    }

    /**
     * @description Runs every enabled retention and the always-run clean-ups of the modules. Each
     *   kind of data runs on its own: a failure is logged (Log::error) and the next kinds still run;
     *   the failed setting keeps its previous `last_run_at`. Failed keys: failedKeys().
     * @return array<string, int|null> Deleted records per data key (null = retention off or
     *   failed) plus the clean-up counts of the modules (e.g. `expired_portal_sessions`).
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

        foreach (self::sources() as $source) {
            $key = class_basename($source) . ':clean_up';
            $this->attempt($key, function () use ($source, &$result) {
                $counts = $source->cleanUp();
                $result += $counts;

                return array_sum($counts);
            });
        }

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
     * @description Deletes the records of one kind of data older than the cut-off: `audit_logs` by
     *   the core, any other key by the module source that declares it.
     * @param string $key Data key (CoreRetentionSetting::defaults()).
     * @param Carbon $cutoff Records last changed (or created) before this moment are deleted.
     * @return int Number of deleted records.
     * @throws InvalidArgumentException A key no registered module declares.
     */
    public function purge(string $key, Carbon $cutoff): int
    {
        if ($key === self::AUDIT_LOGS) {
            return $this->purgeAuditLogs($cutoff);
        }

        foreach (self::sources() as $source) {
            if (array_key_exists($key, $source->defaults())) {
                return $source->purge($key, $cutoff);
            }
        }

        throw new InvalidArgumentException("No retention source for the key: {$key}");
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
     * @description Deletes the rows of the core log, of the audit logs of the registered modules
     * and the finished import batches (their temporary file is already gone) created before the
     * cut-off.
     * @param Carbon $cutoff Rows created before this moment are deleted.
     * @return int Number of deleted rows.
     */
    private function purgeAuditLogs(Carbon $cutoff): int
    {
        $models = [CoreLog::class];
        foreach (self::sources() as $source) {
            array_push($models, ...$source->auditLogModels());
        }

        $count = 0;
        foreach ($models as $model) {
            $count += $this->deleteInBatches($model::where('created_at', '<', $cutoff));
        }

        return $count + $this->deleteInBatches(CoreImportBatch::where('status', 'completed')->where('created_at', '<', $cutoff));
    }
}
