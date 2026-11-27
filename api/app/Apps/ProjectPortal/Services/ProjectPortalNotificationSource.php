<?php
/**
 * @file ProjectPortalNotificationSource.php
 * @path app/Apps/ProjectPortal/Services/ProjectPortalNotificationSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the project portal: new orders from the order form and open sales
 * leads that became overdue after the last look (no contact for
 * ProjectPortalAgendaSource::LEAD_FOLLOW_UP_DAYS days - the same rule as the calendar reminder);
 * texts of the order confirmation e-mail missing in the active languages of the website (whose
 * languages the portal follows) + Czech (portal_order_email_missing, attention, orange) with
 * `preparing` of the switched off ones (grey dot).
 * Registered in ProjectPortalApp::notificationSources().
 * @dependencies SalesOrder, SalesLead, ProjectPortalSetting, SalesOrderEmailTemplate,
 *   ProjectPortalAgendaSource (rule constants), TranslationController, NotificationContext
 */

namespace App\Apps\ProjectPortal\Services;

use App\Apps\ProjectPortal\Models\SalesLead;
use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use App\Apps\ProjectPortal\Support\SalesOrderEmailTemplate;
use App\Http\Controllers\Api\TranslationController;
use App\Services\Notifications\NotificationContext;
use App\Services\Notifications\NotificationSource;
use Illuminate\Support\Carbon;

final class ProjectPortalNotificationSource implements NotificationSource
{
    /** @description See NotificationSource::kinds(). */
    public function kinds(NotificationContext $context): array
    {
        $kinds = [];
        if ($context->can('project-portal-sales-orders-view')) {
            $kinds[] = $context->created('portal_orders', '/admin/project-portal/sales-orders', SalesOrder::query());
        }
        if ($context->can('project-portal-sales-leads-view')) {
            $kinds[] = $context->counted('portal_leads_overdue', '/admin/project-portal/sales-leads', fn (Carbon $since) => self::becameOverdue($since));
        }
        if ($context->can('project-portal-sales-orders-update')) {
            $settings = ProjectPortalSetting::query()->first();
            $email = SalesOrderEmailTemplate::countsByLanguage($settings, array_merge(['cz'], TranslationController::activeLanguageCodes('web')));
            $kinds[] = $context->attention('portal_order_email_missing', '/admin/project-portal/sales-orders', array_sum($email), $email,
                SalesOrderEmailTemplate::countsByLanguage($settings, TranslationController::inactiveLanguageCodes('web')));
        }

        return $kinds;
    }

    /**
     * @description Open leads that are overdue now and were not at the given time: the last
     *   contact (or, without one, the creation) is older than the follow-up period now, but was
     *   not yet at `$since`.
     * @param Carbon $since Last look of the user.
     * @return int
     */
    private static function becameOverdue(Carbon $since): int
    {
        $days = ProjectPortalAgendaSource::LEAD_FOLLOW_UP_DAYS;
        $limitNow = now()->subDays($days);
        $limitThen = $since->copy()->subDays($days);

        return SalesLead::whereNotIn('status', ProjectPortalAgendaSource::LEAD_CLOSED_STATES)
            ->where(fn ($q) => $q
                ->where(fn ($q) => $q->where('last_contact_date', '<', $limitNow->toDateString())
                    ->where('last_contact_date', '>=', $limitThen->toDateString()))
                ->orWhere(fn ($q) => $q->whereNull('last_contact_date')
                    ->where('created_at', '<', $limitNow)->where('created_at', '>=', $limitThen)))
            ->count();
    }
}
