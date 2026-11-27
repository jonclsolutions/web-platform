<?php
/**
 * @file ProjectPortalApp.php
 * @path app/Apps/ProjectPortal/ProjectPortalApp.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manifest of the customer project portal (sales leads, orders with their public
 *   order form, projects, checkpoints, threads, updates, approvals, templates, client accounts and
 *   the public portal of a project) - everything the core needs to know about it. Registered in
 *   config/apps.php. A project may come from an order (`order_id`) or a lead (`lead_id`).
 * @dependencies AppManifest; ProjectPortalBaseDataSeeder, ProjectPortalRetentionSource,
 *   ProjectPortalAgendaSource, ProjectPortalLog, CheckProjectSession and the portal models with
 *   attachments; I18nText (texts of a deleted language).
 * @note Languages: the portal has no texts module of its own - its order e-mail texts are stored
 *   in the languages of the website (languageModule() 'web'), so a deleted web language removes
 *   them too (languageDeleted()).
 */

namespace App\Apps\ProjectPortal;

use App\Apps\ProjectPortal\Database\Seeders\ProjectPortalBaseDataSeeder;
use App\Apps\ProjectPortal\Http\Middleware\CheckProjectPortalActive;
use App\Apps\ProjectPortal\Http\Middleware\CheckProjectSession;
use App\Apps\ProjectPortal\Models\ProjectApproval;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\ProjectThreadMessage;
use App\Apps\ProjectPortal\Models\ProjectUpdate;
use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Apps\ProjectPortal\Services\ProjectPortalAgendaSource;
use App\Apps\ProjectPortal\Services\ProjectPortalNotificationSource;
use App\Apps\ProjectPortal\Services\ProjectPortalRetentionSource;
use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use App\Apps\ProjectPortal\Support\SalesOrderEmailTemplate;
use App\Support\I18n\I18nText;
use App\Support\Apps\AppAvailability;
use App\Support\Apps\AppManifest;
use App\Support\Uploads\AttachmentPolicy;

final class ProjectPortalApp extends AppManifest
{
    /** @description Upload profile of the portal (thread messages, updates, approvals). */
    public const UPLOAD_PROJECT_THREAD = 'project_thread';

    /** @description Upload profile of the orders (SalesOrder) - public order form and admin. */
    public const UPLOAD_SALES_ORDER = 'sales_order';

    /**
     * @description Upload profiles of the portal (AppManifest::uploadProfiles()) - also read as
     *   constants by the FormRequests (count limit).
     */
    public const UPLOAD_PROFILES = [
        self::UPLOAD_PROJECT_THREAD => [
            'extensions' => [
                'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp',
                'jpg', 'jpeg', 'png', 'gif', 'webp',
                'zip', 'rar', '7z',
            ],
            'max_files' => 5, 'max_file_kb' => 15360, 'max_total_bytes' => null,
        ],
        self::UPLOAD_SALES_ORDER => [
            'extensions' => AttachmentPolicy::MATERIAL_EXTENSIONS, 'max_files' => 10, 'max_file_kb' => 20480, 'max_total_bytes' => 50 * 1024 * 1024,
        ],
    ];

    /** @description See AppManifest::id(). */
    public function id(): string
    {
        return 'project-portal';
    }

    /** @description See AppManifest::tabPermission(). */
    public function tabPermission(): string
    {
        return 'view-project-portal';
    }

    /** @description See AppManifest::logModel(). */
    public function logModel(): string
    {
        return ProjectPortalLog::class;
    }

    /**
     * @description See AppManifest::middlewareAliases(). `project.session` = a valid portal
     *   session of the project in the URL (HttpOnly cookie); `project-portal.active` = the public
     *   portal is not in maintenance.
     */
    public function middlewareAliases(): array
    {
        return ['project.session' => CheckProjectSession::class, 'project-portal.active' => CheckProjectPortalActive::class];
    }

    /** @description See AppManifest::baseDataSeeders(). */
    public function baseDataSeeders(): array
    {
        return [ProjectPortalBaseDataSeeder::class];
    }

    /** @description See AppManifest::retentionSources(). */
    public function retentionSources(): array
    {
        return [ProjectPortalRetentionSource::class];
    }

    /** @description See AppManifest::agendaSources(). */
    public function agendaSources(): array
    {
        return [ProjectPortalAgendaSource::class];
    }

    /** @description See AppManifest::notificationSources(). */
    public function notificationSources(): array
    {
        return [ProjectPortalNotificationSource::class];
    }

    /** @description See AppManifest::uploadProfiles(). */
    public function uploadProfiles(): array
    {
        return self::UPLOAD_PROFILES;
    }

    /** @description See AppManifest::uploadFolders() - the ATTACHMENT_FOLDER of the controllers. */
    public function uploadFolders(): array
    {
        return [
            'web/project_threads',
            'web/project_updates',
            'web/project_approvals',
            'web/sales_orders',
        ];
    }

    /** @description See AppManifest::morphMap(). */
    public function morphMap(): array
    {
        return [
            'project_thread_message' => ProjectThreadMessage::class,
            'project_update'         => ProjectUpdate::class,
            'project_approval'       => ProjectApproval::class,
            'sales_order'            => SalesOrder::class,
        ];
    }

    /** @description See AppManifest::availability() - the switch of the public portal and order form (project-portal/maintenance). */
    public function availability(): AppAvailability
    {
        $settings = ProjectPortalSetting::query()->first();

        return new AppAvailability((bool) ($settings->is_portal_active ?? true), $settings?->portal_maintenance_message);
    }

    /** @description See AppManifest::languageModule() - the order e-mail texts use the website languages. */
    public function languageModule(): string
    {
        return 'web';
    }

    /**
     * @description See AppManifest::contentMissing() - the empty texts of the order confirmation
     *   e-mail in a website language (`portal_order_email` - the client would get Czech there).
     */
    public function contentMissing(string $code): array
    {
        $count = count(SalesOrderEmailTemplate::missingIn(ProjectPortalSetting::query()->first() ?? new \stdClass(), strtolower($code)));

        return $count > 0 ? ['portal_order_email' => $count] : [];
    }

    /** @description See AppManifest::languageDeleted() - the texts of the order confirmation e-mail. */
    public function languageDeleted(string $code): void
    {
        $settings = ProjectPortalSetting::query()->first();
        if ($settings) {
            I18nText::forget($settings, ['sales_order_email_subject_i18n', 'sales_order_email_title_i18n',
                'sales_order_email_intro_i18n', 'sales_order_email_outro_i18n', 'sales_order_email_labels_i18n'], $code);
        }
    }
}
