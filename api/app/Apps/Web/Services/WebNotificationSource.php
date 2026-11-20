<?php
/**
 * @file WebNotificationSource.php
 * @path app/Apps/Web/Services/WebNotificationSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the website: new inquiries from the contact form and new job
 * applications. Registered in WebApp::notificationSources().
 * @dependencies WebRawRequestCommission, WebJobApplication, NotificationContext
 */

namespace App\Apps\Web\Services;

use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Services\Notifications\NotificationContext;
use App\Services\Notifications\NotificationSource;

final class WebNotificationSource implements NotificationSource
{
    /** @description See NotificationSource::kinds(). */
    public function kinds(NotificationContext $context): array
    {
        $kinds = [];
        if ($context->can('web-user-requests-view')) {
            $kinds[] = $context->created('web_inquiries', '/admin/web/user-request', WebRawRequestCommission::query());
        }
        if ($context->can('web-job-applications-view')) {
            $kinds[] = $context->created('web_job_applications', '/admin/web/job-applications', WebJobApplication::query());
        }

        return $kinds;
    }
}
