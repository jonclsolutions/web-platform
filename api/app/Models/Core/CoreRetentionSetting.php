<?php
/**
 * @file CoreRetentionSetting.php
 * @path app/Models/Core/CoreRetentionSetting.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Retention period of one kind of personal data (GDPR Art. 5(1)(e) storage
 * limitation) - one row per `data_key`. `retention_days` NULL = automatic deletion off (kept until
 * deleted by hand). Enforced daily by `retention:purge` (RetentionPurgeService), which also stores
 * the result of its last run (`last_run_at`, `last_deleted_count`).
 * @note The period runs from the LAST CHANGE of a record (`updated_at`; projects: their last
 * message too), so records still being worked on are never deleted. Cookie consents run from
 * their creation (they never change).
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

class CoreRetentionSetting extends Model
{
    /**
     * @description Kinds of data with their default period in days (null = off). Order = order
     * in the admin.
     * - job_applications 180 (~6 months): usual period for applications without a consent to a
     *   longer evidence of candidates;
     * - raw_requests / sales_leads / support_tickets 730 (2 years): pre-contractual communication;
     * - sales_orders / projects 3650 (10 years): contractual relationship - accounting and tax
     *   documents may have to be kept that long;
     * - cookie_consents 1095 (3 years): proof of consent within the general limitation period;
     * - audit_logs 730 (2 years): core / web / e-shop activity logs (e-mail and IP of the actor)
     *   and the history of finished imports - long enough to trace a change, then deleted.
     */
    public const DEFAULTS = [
        'job_applications' => 180,
        'raw_requests'     => 730,
        'sales_leads'      => 730,
        'support_tickets'  => 730,
        'sales_orders'     => 3650,
        'projects'         => 3650,
        'cookie_consents'  => 1095,
        'audit_logs'       => 730,
    ];

    /** @description Shortest allowed period - a typo must not delete fresh records. */
    public const MIN_DAYS = 30;

    /** @description Longest allowed period (15 years). */
    public const MAX_DAYS = 5475;

    protected $fillable = [
        'data_key',
        'retention_days',
        'last_run_at',
        'last_deleted_count',
    ];

    protected $casts = [
        'retention_days'     => 'integer',
        'last_run_at'        => 'datetime',
        'last_deleted_count' => 'integer',
    ];

    /**
     * @description Every setting in the order of DEFAULTS; a missing row is created with its default.
     * @return array<int, self>
     */
    public static function allInOrder(): array
    {
        $rows = self::query()->get()->keyBy('data_key');

        return array_map(
            fn (string $key) => $rows[$key] ?? self::create(['data_key' => $key, 'retention_days' => self::DEFAULTS[$key]]),
            array_keys(self::DEFAULTS)
        );
    }
}
