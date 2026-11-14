<?php
/**
 * @file ProjectPortalAgendaSource.php
 * @path app/Apps/ProjectPortal/Services/ProjectPortalAgendaSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calendar entries of the project portal: project deadlines, follow-ups of sales
 *   leads (LEAD_FOLLOW_UP_DAYS after the last contact) and expiry of their order-form links
 *   (events); leads without contact and orders without a project (reminders - the order is the
 *   usual start of a project). Registered in ProjectPortalApp::agendaSources().
 * @dependencies AgendaContext, Project, SalesLead, SalesOrder.
 */

namespace App\Apps\ProjectPortal\Services;

use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\SalesLead;
use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Services\Agenda\AgendaContext;
use App\Services\Agenda\AgendaSource;
use Illuminate\Support\Carbon;

final class ProjectPortalAgendaSource implements AgendaSource
{
    /** @description A lead without contact for this many days needs a follow-up. */
    public const LEAD_FOLLOW_UP_DAYS = 14;

    /** @description Lead states that need no follow-up (won, lost, handed over, paid). */
    public const LEAD_CLOSED_STATES = ['closed_won', 'closed_lost', 'handed_to_dev_team', 'paid_project_started'];

    /** @description Admin page of the sales leads (target of their entries). */
    private const LEADS_ROUTE = '/admin/project-portal/sales-leads';

    /** @description See AgendaSource::permissions(). */
    public function permissions(): array
    {
        return ['web-projects-view', 'project-portal-sales-leads-view', 'project-portal-sales-orders-view'];
    }

    /** @description See AgendaSource::events(). */
    public function events(AgendaContext $agenda, Carbon $from, Carbon $to): array
    {
        $events = [];
        $today = now()->startOfDay();

        if ($agenda->can('web-projects-view')) {
            $projects = Project::where('status', '!=', 'finished')->whereBetween('estimated_completion_to', [$from->toDateString(), $to->toDateString()])
                ->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get(['id', 'name', 'estimated_completion_to']);
            foreach ($projects as $project) {
                $date = Carbon::parse($project->estimated_completion_to);
                $events[] = $agenda->event('project_deadline', (string) $project->id, $date, $project->name, "/admin/project-portal/projects/{$project->id}", $date->lt($today) ? 'danger' : 'warning');
            }
        }

        if ($agenda->can('project-portal-sales-leads-view')) {
            // Follow-up = last contact + LEAD_FOLLOW_UP_DAYS, so the contacts of the range are shifted back.
            $leads = SalesLead::whereNotIn('status', self::LEAD_CLOSED_STATES)
                ->whereBetween('last_contact_date', [$from->copy()->subDays(self::LEAD_FOLLOW_UP_DAYS)->toDateString(), $to->copy()->subDays(self::LEAD_FOLLOW_UP_DAYS)->toDateString()])
                ->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get(['id', 'subject_name', 'last_contact_date']);
            foreach ($leads as $lead) {
                $date = Carbon::parse($lead->last_contact_date)->addDays(self::LEAD_FOLLOW_UP_DAYS);
                $events[] = $agenda->event('lead_follow_up', (string) $lead->id, $date, $lead->subject_name, self::LEADS_ROUTE, $date->lt($today) ? 'danger' : 'info');
            }
            $links = SalesLead::whereNotNull('public_token')->whereNull('public_token_used_at')->whereBetween('public_token_expires_at', [$from, $to])
                ->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get(['id', 'subject_name', 'public_token_expires_at']);
            foreach ($links as $lead) {
                $events[] = $agenda->event('lead_form_expiry', (string) $lead->id, Carbon::parse($lead->public_token_expires_at), $lead->subject_name, self::LEADS_ROUTE, 'warning');
            }
        }

        return $events;
    }

    /** @description See AgendaSource::reminders(). Orders without a project need both permissions. */
    public function reminders(AgendaContext $agenda): array
    {
        $reminders = [];
        if ($agenda->can('project-portal-sales-leads-view')) {
            $limit = now()->subDays(self::LEAD_FOLLOW_UP_DAYS);
            $reminders[] = $agenda->reminder('leads_without_contact', self::LEADS_ROUTE, SalesLead::whereNotIn('status', self::LEAD_CLOSED_STATES)
                ->where(fn ($q) => $q->where('last_contact_date', '<', $limit->toDateString())
                    ->orWhere(fn ($q) => $q->whereNull('last_contact_date')->where('created_at', '<', $limit))));
        }
        if ($agenda->can('web-projects-view') && $agenda->can('project-portal-sales-orders-view')) {
            $reminders[] = $agenda->reminder('orders_without_project', '/admin/project-portal/sales-orders',
                SalesOrder::whereNotIn('id', Project::withTrashed()->whereNotNull('order_id')->select('order_id')));
        }

        return array_values(array_filter($reminders));
    }
}
