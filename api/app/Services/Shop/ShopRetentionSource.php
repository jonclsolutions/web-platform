<?php
/**
 * @file ShopRetentionSource.php
 * @path app/Services/Shop/ShopRetentionSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Retention of the e-shop module: only its audit log (deleted by the core
 * `audit_logs` retention). Orders and customers are NOT deleted automatically - accounting periods
 * apply; a customer is anonymised by hand (GDPR erasure). Registered in ShopApp::retentionSources().
 * @dependencies ShopLog.
 */

namespace App\Services\Shop;

use App\Models\Shop\ShopLog;
use App\Services\Retention\RetentionSource;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

final class ShopRetentionSource implements RetentionSource
{
    /** @description See RetentionSource::defaults(). */
    public function defaults(): array
    {
        return [];
    }

    /** @description See RetentionSource::purge(). */
    public function purge(string $key, Carbon $cutoff): int
    {
        throw new InvalidArgumentException("Unknown e-shop retention key: {$key}");
    }

    /** @description See RetentionSource::auditLogModels(). */
    public function auditLogModels(): array
    {
        return [ShopLog::class];
    }

    /** @description See RetentionSource::cleanUp(). */
    public function cleanUp(): array
    {
        return [];
    }
}
