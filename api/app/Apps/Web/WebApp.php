<?php
/**
 * @file WebApp.php
 * @path app/Apps/Web/WebApp.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manifest of the web application (public website, inquiries, job applications) -
 * everything the core needs to know about it. Registered in config/apps.php.
 * @dependencies AppManifest; WebBaseDataSeeder, WebRetentionSource, WebAgendaSource, WebLog,
 *   WebContentLanguages + I18nText (texts of a deleted language), CheckWebActive, the Web models
 *   with attachments and WebJob (sitemap).
 */

namespace App\Apps\Web;

use App\Apps\Web\Http\Middleware\CheckWebActive;
use App\Apps\Web\Services\WebAgendaSource;
use App\Apps\Web\Services\WebContentMissing;
use App\Apps\Web\Services\WebNotificationSource;
use App\Apps\Web\Services\WebRetentionSource;
use App\Apps\Web\Models\WebJob;
use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebLog;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Apps\Web\Models\WebSiteSetting;
use App\Support\Apps\AppAvailability;
use App\Support\Apps\AppManifest;
use App\Support\Uploads\AttachmentPolicy;
use App\Apps\Web\Support\WebContentLanguages;
use App\Support\I18n\I18nText;
use App\Apps\Web\Database\Seeders\WebBaseDataSeeder;

final class WebApp extends AppManifest
{
    /** @description Upload profile of the inquiries (WebRawRequestCommission) - contact form and admin. */
    public const UPLOAD_RAW_REQUEST_COMMISSION = 'raw_request_commission';

    /** @description Upload profile of the CV of a job application (WebJobApplication) - one file. */
    public const UPLOAD_JOB_APPLICATION = 'job_application';

    /**
     * @description Upload profiles of the web (AppManifest::uploadProfiles()) - also read as
     *   constants by the FormRequests (count / total size limits).
     */
    public const UPLOAD_PROFILES = [
        self::UPLOAD_RAW_REQUEST_COMMISSION => [
            'extensions' => AttachmentPolicy::MATERIAL_EXTENSIONS, 'max_files' => 10, 'max_file_kb' => 20480, 'max_total_bytes' => 50 * 1024 * 1024,
        ],
        self::UPLOAD_JOB_APPLICATION => [
            'extensions' => ['pdf', 'doc', 'docx', 'odt', 'pages', 'rtf', 'txt', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'zip', 'rar', '7z'],
            'max_files' => 1, 'max_file_kb' => 20480, 'max_total_bytes' => null,
        ],
    ];

    /** @description See AppManifest::id(). */
    public function id(): string
    {
        return 'web';
    }

    /** @description See AppManifest::tabPermission(). */
    public function tabPermission(): string
    {
        return 'view-web';
    }

    /** @description See AppManifest::logModel(). */
    public function logModel(): string
    {
        return WebLog::class;
    }

    /**
     * @description See AppManifest::middlewareAliases(). `web.active` = the public website
     *   answers 503 while the web is in maintenance mode.
     */
    public function middlewareAliases(): array
    {
        return ['web.active' => CheckWebActive::class];
    }

    /** @description See AppManifest::baseDataSeeders(). */
    public function baseDataSeeders(): array
    {
        return [WebBaseDataSeeder::class];
    }

    /** @description See AppManifest::retentionSources(). */
    public function retentionSources(): array
    {
        return [WebRetentionSource::class];
    }

    /** @description See AppManifest::agendaSources(). */
    public function agendaSources(): array
    {
        return [WebAgendaSource::class];
    }

    /** @description See AppManifest::notificationSources(). */
    public function notificationSources(): array
    {
        return [WebNotificationSource::class];
    }

    /** @description See AppManifest::uploadProfiles(). */
    public function uploadProfiles(): array
    {
        return self::UPLOAD_PROFILES;
    }

    /** @description See AppManifest::uploadFolders() - the ATTACHMENT_FOLDER / CV_FOLDER of the controllers. */
    public function uploadFolders(): array
    {
        return [
            'web/cv_files',
            'web/raw_request_commissions',
        ];
    }

    /** @description See AppManifest::morphMap(). */
    public function morphMap(): array
    {
        return [
            'job_application'        => WebJobApplication::class,
            'raw_request_commission' => WebRawRequestCommission::class,
        ];
    }

    /** @description See AppManifest::translationPermission(). */
    public function translationPermission(): ?string
    {
        return 'web-edit-website-update';
    }

    /**
     * @description See AppManifest::languageDeleted() - FAQ, jobs, references and knowledge base
     *   texts and the texts of the inquiry confirmation e-mail (the page titles are removed by the core).
     */
    public function languageDeleted(string $code): void
    {
        WebContentLanguages::forget($code);
        $settings = WebSiteSetting::query()->first();
        if ($settings) {
            I18nText::forget($settings, self::EMAIL_TEXT_COLUMNS, $code);
        }
    }

    /**
     * @description See AppManifest::contentMissing() - FAQ, positions, references and knowledge
     *   base records missing a text in the language.
     */
    public function contentMissing(string $code): array
    {
        return array_filter(WebContentMissing::counts([$code]));
    }

    /** @description Texts of the inquiry confirmation e-mail stored per language (web settings). */
    private const EMAIL_TEXT_COLUMNS = ['raw_request_email_subject_i18n', 'raw_request_email_title_i18n',
        'raw_request_email_intro_i18n', 'raw_request_email_outro_i18n', 'raw_request_email_labels_i18n'];

    /** @description See AppManifest::servesSiteRoot() - the website is the home page of the domain. */
    public function servesSiteRoot(): bool
    {
        return true;
    }

    /**
     * @description See AppManifest::sitemapPaths() - the pages of the website (routes of
     *   erp/src/app/apps/web/public/web-public.routes.ts) and every position shown on it.
     * @return array<int, string>
     */
    public function sitemapPaths(): array
    {
        $pages = ['/', '/services', '/about-us', '/references', '/jobs', '/faq', '/knowledge-base', '/contact',
            '/privacy-policy', '/tos', '/cookies-policy'];
        $jobs = WebJob::query()->where('is_active', true)->orderBy('sort_order')->pluck('slug')
            ->filter(fn ($slug) => is_string($slug) && $slug !== '')
            ->map(fn (string $slug) => '/jobs/' . rawurlencode($slug));

        return array_values(array_merge($pages, $jobs->all()));
    }

    /** @description See AppManifest::availability() - the switch of the public web (web/settings). */
    public function availability(): AppAvailability
    {
        $settings = WebSiteSetting::query()->first();

        return new AppAvailability((bool) ($settings->is_web_active ?? true), $settings?->web_maintenance_message);
    }
}
