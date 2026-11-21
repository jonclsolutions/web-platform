<?php
/**
 * @file WebNotificationSource.php
 * @path app/Apps/Web/Services/WebNotificationSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the website: new inquiries from the contact form and new job
 * applications (unread, red); texts missing in the active languages of the website texts and of
 * the content in the database - FAQ, positions, references, knowledge base (attention, orange - for
 * the admins who may edit them; the page tabs show them too). Registered in WebApp::notificationSources().
 * @dependencies WebRawRequestCommission, WebJobApplication, MissingTranslations, WebContentMissing, NotificationContext
 */

namespace App\Apps\Web\Services;

use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Services\Notifications\NotificationContext;
use App\Services\Notifications\NotificationSource;
use App\Support\I18n\MissingTranslations;

final class WebNotificationSource implements NotificationSource
{
    /** @description Attention kind of every content tab of Texty webu (WebContentMissing). */
    public const CONTENT_KINDS = [
        'faq'            => 'web_faq_missing',
        'jobs'           => 'web_jobs_missing',
        'references'     => 'web_references_missing',
        'knowledge_base' => 'web_kb_missing',
    ];

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
            foreach (WebContentMissing::counts() as $tab => $count) {
                $kinds[] = $context->attention(self::CONTENT_KINDS[$tab], '/admin/web/edit-website', $count);
            }
        }

        return $kinds;
    }
}
