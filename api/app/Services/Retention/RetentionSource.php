<?php
/**
 * @file RetentionSource.php
 * @path app/Services/Retention/RetentionSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Retention contribution of one module (web, e-shop, …) to the core retention purge
 * (RetentionPurgeService): its kinds of personal data with their default periods, how to delete
 * them, its audit log model and its always-run clean-ups. The core never names a module's models -
 * a module lists its sources in its manifest (AppManifest::retentionSources(), config/apps.php);
 * when its folder is removed, the class no longer exists and it is skipped.
 * @usage `final class WebRetentionSource implements RetentionSource { … }` + an entry in
 *   WebApp::retentionSources().
 */

namespace App\Services\Retention;

use Illuminate\Support\Carbon;

interface RetentionSource
{
    /**
     * @description Kinds of data of the module with their default period in days (null = off).
     *   Order = order in the admin. Keys must be unique over all sources (and not `audit_logs`).
     * @return array<string, int|null>
     */
    public function defaults(): array;

    /**
     * @description Deletes the records of one of the module's kinds of data older than the cut-off.
     * @param string $key A key of defaults().
     * @param Carbon $cutoff Records last changed (or created) before this moment are deleted.
     * @return int Number of deleted records.
     */
    public function purge(string $key, Carbon $cutoff): int;

    /**
     * @description Audit log models of the module - deleted by the core `audit_logs` retention.
     * @return array<int, class-string<\Illuminate\Database\Eloquent\Model>>
     */
    public function auditLogModels(): array;

    /**
     * @description Clean-ups that always run, independent of any setting (e.g. expired sessions).
     * @return array<string, int> Deleted rows per clean-up name (part of the purge result).
     */
    public function cleanUp(): array;
}
