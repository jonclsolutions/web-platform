<?php
/**
 * @file WebRetentionSource.php
 * @path app/Apps/Web/Services/WebRetentionSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Retention of the web application (GDPR Art. 5(1)(e)): job applications,
 * inquiries, leads and web orders - each deleted for good with its attachments and files - plus
 * the web audit log. Registered in WebApp::retentionSources().
 * @note Default periods (days):
 * - job_applications 180 (~6 months): usual period for applications without a consent to a
 *   longer evidence of candidates;
 * - raw_requests / sales_leads 730 (2 years): pre-contractual communication;
 * - sales_orders 3650 (10 years): contractual relationship - accounting and tax documents may
 *   have to be kept that long.
 * The period runs from the LAST CHANGE of a record.
 * @dependencies Web models, PurgesRecords.
 */

namespace App\Apps\Web\Services;

use App\Apps\Web\WebApp;
use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebLog;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Apps\Web\Models\WebSalesLead;
use App\Apps\Web\Models\WebSalesOrder;
use App\Services\Retention\PurgesRecords;
use App\Services\Retention\RetentionSource;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

final class WebRetentionSource implements RetentionSource
{
    use PurgesRecords;

    /**
     * @description Model class of every kind of data with attachments (morphMany `attachments`).
     * Leads have no attachments.
     */
    private const ATTACHMENT_MODELS = [
        'job_applications' => WebJobApplication::class,
        'raw_requests'     => WebRawRequestCommission::class,
        'sales_orders'     => WebSalesOrder::class,
    ];

    /** @description See RetentionSource::defaults(). */
    public function defaults(): array
    {
        return [
            'job_applications' => 180,
            'raw_requests'     => 730,
            'sales_leads'      => 730,
            'sales_orders'     => 3650,
        ];
    }

    /** @description See RetentionSource::purge(). */
    public function purge(string $key, Carbon $cutoff): int
    {
        return match ($key) {
            'sales_leads'     => $this->purgeRecords(WebSalesLead::withTrashed()->where('updated_at', '<', $cutoff)),
            default           => isset(self::ATTACHMENT_MODELS[$key])
                ? $this->purgeRecords(self::ATTACHMENT_MODELS[$key]::withTrashed()->with('attachments')->where('updated_at', '<', $cutoff))
                : throw new InvalidArgumentException("Unknown web retention key: {$key}"),
        };
    }

    /** @description See RetentionSource::auditLogModels(). */
    public function auditLogModels(): array
    {
        return [WebLog::class];
    }

    /** @description See RetentionSource::cleanUp(). */
    public function cleanUp(): array
    {
        return [];
    }
}
