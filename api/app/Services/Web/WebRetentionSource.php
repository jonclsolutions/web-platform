<?php
/**
 * @file WebRetentionSource.php
 * @path app/Services/Web/WebRetentionSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Retention of the web module (GDPR Art. 5(1)(e)): job applications, inquiries,
 * leads, support tickets, web orders, client projects and cookie consents - each deleted for good
 * with its attachments and files - plus the web audit log and the always-run clean-up of expired
 * project portal sessions (IP address, user agent). Registered in config/retention.php.
 * @note Default periods (days):
 * - job_applications 180 (~6 months): usual period for applications without a consent to a
 *   longer evidence of candidates;
 * - raw_requests / sales_leads / support_tickets 730 (2 years): pre-contractual communication;
 * - sales_orders / projects 3650 (10 years): contractual relationship - accounting and tax
 *   documents may have to be kept that long;
 * - cookie_consents 1095 (3 years): proof of consent within the general limitation period.
 * The period runs from the LAST CHANGE of a record (projects: also their last message), cookie
 * consents from their creation (they never change).
 * @dependencies Web models, PurgesRecords.
 */

namespace App\Services\Web;

use App\Models\Web\WebCookieConsent;
use App\Models\Web\WebJobApplication;
use App\Models\Web\WebLog;
use App\Models\Web\WebProject;
use App\Models\Web\WebProjectSession;
use App\Models\Web\WebRawRequestCommission;
use App\Models\Web\WebSalesLead;
use App\Models\Web\WebSalesOrder;
use App\Models\Web\WebSupportTicket;
use App\Services\Retention\PurgesRecords;
use App\Services\Retention\RetentionSource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

final class WebRetentionSource implements RetentionSource
{
    use PurgesRecords;

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

    /** @description See RetentionSource::defaults(). */
    public function defaults(): array
    {
        return [
            'job_applications' => 180,
            'raw_requests'     => 730,
            'sales_leads'      => 730,
            'support_tickets'  => 730,
            'sales_orders'     => 3650,
            'projects'         => 3650,
            'cookie_consents'  => 1095,
        ];
    }

    /** @description See RetentionSource::purge(). */
    public function purge(string $key, Carbon $cutoff): int
    {
        return match ($key) {
            'sales_leads'     => $this->purgeRecords(WebSalesLead::withTrashed()->where('updated_at', '<', $cutoff)),
            'projects'        => $this->purgeProjects($cutoff),
            'cookie_consents' => WebCookieConsent::where('created_at', '<', $cutoff)->delete(),
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
        return ['expired_portal_sessions' => WebProjectSession::where('expires_at', '<', Carbon::now())->delete()];
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
        $query->chunkById($this->purgeChunk, function ($projects) use (&$count) {
            foreach ($projects as $project) {
                WebProjectSession::where('project_id', $project->id)->delete();
                $project->accounts()->delete();
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
}
