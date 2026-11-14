<?php
/**
 * @file WebAgendaSource.php
 * @path app/Apps/Web/Services/WebAgendaSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calendar entries of the web application: new job applicants and new inquiries
 * (reminders). Registered in WebApp::agendaSources().
 * @dependencies AgendaContext, Web models
 */

namespace App\Apps\Web\Services;

use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Services\Agenda\AgendaContext;
use App\Services\Agenda\AgendaSource;
use Illuminate\Support\Carbon;

final class WebAgendaSource implements AgendaSource
{
    /** @description See AgendaSource::permissions(). */
    public function permissions(): array
    {
        return ['web-job-applications-view', 'web-user-requests-view'];
    }

    /** @description See AgendaSource::events() - the web has no dated entries. */
    public function events(AgendaContext $agenda, Carbon $from, Carbon $to): array
    {
        return [];
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

        return array_values(array_filter($reminders));
    }
}
