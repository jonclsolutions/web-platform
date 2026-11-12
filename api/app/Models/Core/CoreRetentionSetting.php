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

use App\Services\Retention\RetentionPurgeService;
use Illuminate\Database\Eloquent\Model;

class CoreRetentionSetting extends Model
{
    /**
     * @description Default periods of the core's own kinds of data (days): cookie_consents 1095
     * (3 years) - proof of the visitors' cookie consents within the general limitation period
     * (counted from their creation); audit_logs 730 (2 years) - core and application activity logs
     * (e-mail and IP of the actor) and the history of finished imports, long enough to trace a
     * change, then deleted. The kinds of the applications and their defaults come from their
     * retention sources (see defaults()).
     */
    public const DEFAULTS = [
        RetentionPurgeService::COOKIE_CONSENTS => 1095,
        RetentionPurgeService::AUDIT_LOGS      => 730,
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
     * @description Every kind of data with its default period (null = off) in the admin order: the
     *   kinds of the registered applications (AppManifest::retentionSources()), then the core ones (DEFAULTS).
     * @return array<string, int|null>
     */
    public static function defaults(): array
    {
        $defaults = [];
        foreach (RetentionPurgeService::sources() as $source) {
            $defaults += $source->defaults();
        }

        return $defaults + self::DEFAULTS;
    }

    /**
     * @description Every setting in the order of defaults(); a missing row is created with its
     *   default. Rows of a removed module are kept in the table but not listed.
     * @return array<int, self>
     */
    public static function allInOrder(): array
    {
        $defaults = self::defaults();
        $rows = self::query()->whereIn('data_key', array_keys($defaults))->get()->keyBy('data_key');

        return array_map(
            fn (string $key) => $rows[$key] ?? self::create(['data_key' => $key, 'retention_days' => $defaults[$key]]),
            array_keys($defaults)
        );
    }
}
