<?php
/**
 * @file WebNotificationSource.php
 * @path app/Apps/Web/Services/WebNotificationSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the website: new inquiries from the contact form and new job
 * applications (unread, red); texts missing in the active languages of the website texts, of the
 * page titles (web_page_titles_missing), of the content in the database - FAQ, positions, references,
 * knowledge base - and of the inquiry confirmation e-mail (web_inquiry_email_missing, Czech always)
 * (attention, orange - for the admins who may edit them; the page tabs show them too). Each also
 * carries `preparing`: the same in the switched off languages (a grey dot - the language is being
 * prepared, visitors do not see it). Registered in WebApp::notificationSources().
 * @dependencies WebRawRequestCommission, WebJobApplication, WebSiteSetting, RawRequestEmailTemplate,
 *   MissingTranslations, MissingPageTitles, WebContentMissing, TranslationController, NotificationContext
 */

namespace App\Apps\Web\Services;

use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Apps\Web\Models\WebSiteSetting;
use App\Apps\Web\Support\RawRequestEmailTemplate;
use App\Http\Controllers\Api\TranslationController;
use App\Services\Notifications\NotificationContext;
use App\Services\Notifications\NotificationSource;
use App\Support\I18n\MissingTranslations;
use App\Support\I18n\MissingPageTitles;

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

        $inactive = TranslationController::inactiveLanguageCodes('web');
        if ($context->can('web-edit-website-update')) {
            $missing = MissingTranslations::byLanguage('web');
            $kinds[] = $context->attention('web_texts_missing', '/admin/web/edit-website', array_sum($missing), $missing,
                MissingTranslations::byLanguage('web', $inactive));
            $titles = MissingPageTitles::byLanguage('web');
            $kinds[] = $context->attention('web_page_titles_missing', '/admin/web/edit-website', array_sum($titles), $titles,
                MissingPageTitles::byLanguage('web', $inactive));
            $preparing = WebContentMissing::byLanguage($inactive);
            foreach (WebContentMissing::counts() as $tab => $count) {
                $kinds[] = $context->attention(self::CONTENT_KINDS[$tab], '/admin/web/edit-website', $count, [], $preparing[$tab]);
            }
        }
        if ($context->can('web-user-requests-update')) {
            $settings = WebSiteSetting::first();
            $email = RawRequestEmailTemplate::countsByLanguage($settings, array_merge(['cz'], TranslationController::activeLanguageCodes('web')));
            $kinds[] = $context->attention('web_inquiry_email_missing', '/admin/web/user-request', array_sum($email), $email,
                RawRequestEmailTemplate::countsByLanguage($settings, $inactive));
        }

        return $kinds;
    }
}
