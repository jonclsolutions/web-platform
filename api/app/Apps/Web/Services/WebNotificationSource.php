<?php
/**
 * @file WebNotificationSource.php
 * @path app/Apps/Web/Services/WebNotificationSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the website: new inquiries from the contact form and new job
 * applications (unread, red); texts missing in the active languages of the website texts
 * (attention, orange - for the admins who may edit them). Registered in WebApp::notificationSources().
 * @dependencies WebRawRequestCommission, WebJobApplication, MissingTranslations, NotificationContext
 */

namespace App\Apps\Web\Services;

use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Services\Notifications\NotificationContext;
use App\Services\Notifications\NotificationSource;
use App\Support\I18n\MissingTranslations;

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

        if ($context->can('web-edit-website-update')) {
            $kinds[] = $context->attention('web_texts_missing', '/admin/web/edit-website', MissingTranslations::count('web'));
        }

        return $kinds;
    }
}
