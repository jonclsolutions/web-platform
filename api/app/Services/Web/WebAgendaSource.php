<?php
/**
 * @file WebAgendaSource.php
 * @path app/Services/Web/WebAgendaSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calendar entries of the web application: project deadlines, follow-ups of sales
 * leads (LEAD_FOLLOW_UP_DAYS after the last contact) and expiry of their order-form links
 * (events); new job applicants, new inquiries, web orders without a project and leads without
 * contact (reminders). Registered in WebApp::agendaSources().
 * @dependencies AgendaContext, Web models
 */

namespace App\Services\Web;

use App\Models\Web\WebJobApplication;
use App\Models\Web\WebProject;
use App\Models\Web\WebRawRequestCommission;
use App\Models\Web\WebSalesLead;
use App\Models\Web\WebSalesOrder;
use App\Services\Agenda\AgendaContext;
use App\Services\Agenda\AgendaSource;
use Illuminate\Support\Carbon;

final class WebAgendaSource implements AgendaSource
{
    /** @description A lead without contact for this many days needs a follow-up. */
    public const LEAD_FOLLOW_UP_DAYS = 14;

    /** @description Lead states that need no follow-up (won, lost, handed over, paid). */
    public const LEAD_CLOSED_STATES = ['closed_won', 'closed_lost', 'handed_to_dev_team', 'paid_project_started'];

    /** @description See AgendaSource::permissions(). */
    public function permissions(): array
    {
        return ['web-projects-view', 'web-sales-leads-view', 'web-job-applications-view', 'web-user-requests-view', 'web-sales-orders-view'];
    }

    /** @description See AgendaSource::events(). */
    public function events(AgendaContext $agenda, Carbon $from, Carbon $to): array
    {
        $events = [];
        $today = now()->startOfDay();

        if ($agenda->can('web-projects-view')) {
            $projects = WebProject::where('status', '!=', 'finished')->whereBetween('estimated_completion_to', [$from->toDateString(), $to->toDateString()])
                ->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get(['id', 'name', 'estimated_completion_to']);
            foreach ($projects as $project) {
                $date = Carbon::parse($project->estimated_completion_to);
                $events[] = $agenda->event('project_deadline', (string) $project->id, $date, $project->name, "/admin/web/projects/{$project->id}", $date->lt($today) ? 'danger' : 'warning');
            }
        }

        if ($agenda->can('web-sales-leads-view')) {
            // Follow-up = last contact + LEAD_FOLLOW_UP_DAYS, so the contacts of the range are shifted back.
            $leads = WebSalesLead::whereNotIn('status', self::LEAD_CLOSED_STATES)
                ->whereBetween('last_contact_date', [$from->copy()->subDays(self::LEAD_FOLLOW_UP_DAYS)->toDateString(), $to->copy()->subDays(self::LEAD_FOLLOW_UP_DAYS)->toDateString()])
                ->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get(['id', 'subject_name', 'last_contact_date']);
            foreach ($leads as $lead) {
                $date = Carbon::parse($lead->last_contact_date)->addDays(self::LEAD_FOLLOW_UP_DAYS);
                $events[] = $agenda->event('lead_follow_up', (string) $lead->id, $date, $lead->subject_name, '/admin/web/sales-leads', $date->lt($today) ? 'danger' : 'info');
            }
            $links = WebSalesLead::whereNotNull('public_token')->whereNull('public_token_used_at')->whereBetween('public_token_expires_at', [$from, $to])
                ->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get(['id', 'subject_name', 'public_token_expires_at']);
            foreach ($links as $lead) {
                $events[] = $agenda->event('lead_form_expiry', (string) $lead->id, Carbon::parse($lead->public_token_expires_at), $lead->subject_name, '/admin/web/sales-leads', 'warning');
            }
        }

        return $events;
    }

    /** @description See AgendaSource::reminders(). */
    public function reminders(AgendaContext $agenda): array
    {
        $reminders = [];
        if ($agenda->can('web-job-applications-view')) {
            $reminders[] = $agenda->reminder('job_applications_new', '/admin/web/job-applications', WebJobApplication::where('state', 'new'));
        }
        if ($agenda->can('web-user-requests-view')) {
            $reminders[] = $agenda->reminder('inquiries_new', '/admin/web/user-request', WebRawRequestCommission::where('status', 'new'));
        }
        if ($agenda->can('web-sales-orders-view')) {
            $reminders[] = $agenda->reminder('web_orders_without_project', '/admin/web/sales-orders',
                WebSalesOrder::whereNotIn('id', WebProject::withTrashed()->whereNotNull('order_id')->select('order_id')));
        }
        if ($agenda->can('web-sales-leads-view')) {
            $limit = now()->subDays(self::LEAD_FOLLOW_UP_DAYS);
            $reminders[] = $agenda->reminder('leads_without_contact', '/admin/web/sales-leads', WebSalesLead::whereNotIn('status', self::LEAD_CLOSED_STATES)
                ->where(fn ($q) => $q->where('last_contact_date', '<', $limit->toDateString())
                    ->orWhere(fn ($q) => $q->whereNull('last_contact_date')->where('created_at', '<', $limit))));
        }

        return array_values(array_filter($reminders));
    }
}
