<?php
/**
 * @file ProjectPortalAgendaSource.php
 * @path app/Apps/ProjectPortal/Services/ProjectPortalAgendaSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calendar entries of the project portal: project deadlines (events) and, while the
 *   web application is installed, web orders without a project (reminder - the order is the usual
 *   start of a project). Registered in ProjectPortalApp::agendaSources().
 * @note The web is reached only through the registry (AppRegistry::app('web')) and its table name -
 *   no web class is used, so the portal works without the web.
 * @dependencies AgendaContext, AppRegistry, Project.
 */

namespace App\Apps\ProjectPortal\Services;

use App\Apps\ProjectPortal\Models\Project;
use App\Services\Agenda\AgendaContext;
use App\Services\Agenda\AgendaSource;
use App\Support\Apps\AppRegistry;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ProjectPortalAgendaSource implements AgendaSource
{
    /** @description See AgendaSource::permissions(). */
    public function permissions(): array
    {
        return ['web-projects-view'];
    }

    /** @description See AgendaSource::events(). */
    public function events(AgendaContext $agenda, Carbon $from, Carbon $to): array
    {
        if (!$agenda->can('web-projects-view')) {
            return [];
        }
        $events = [];
        $today = now()->startOfDay();
        $projects = Project::where('status', '!=', 'finished')->whereBetween('estimated_completion_to', [$from->toDateString(), $to->toDateString()])
            ->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get(['id', 'name', 'estimated_completion_to']);
        foreach ($projects as $project) {
            $date = Carbon::parse($project->estimated_completion_to);
            $events[] = $agenda->event('project_deadline', (string) $project->id, $date, $project->name, "/admin/project-portal/projects/{$project->id}", $date->lt($today) ? 'danger' : 'warning');
        }

        return $events;
    }

    /**
     * @description See AgendaSource::reminders(). Web orders without a project: only with the web
     *   installed and for a user who also sees the web orders (web tab + web-sales-orders-view).
     */
    public function reminders(AgendaContext $agenda): array
    {
        $web = AppRegistry::app('web');
        if ($web === null || !$agenda->can('web-projects-view') || !$agenda->canInModule($web->tabPermission(), 'web-sales-orders-view')) {
            return [];
        }

        return array_values(array_filter([
            $agenda->reminder('web_orders_without_project', '/admin/web/sales-orders',
                DB::table('web_sales_orders')->whereNull('deleted_at')
                    ->whereNotIn('id', Project::withTrashed()->whereNotNull('order_id')->select('order_id'))),
        ]));
    }
}
