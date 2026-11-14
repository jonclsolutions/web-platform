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
 *   attachments.
 */

namespace App\Apps\ProjectPortal;

use App\Apps\ProjectPortal\Database\Seeders\ProjectPortalBaseDataSeeder;
use App\Apps\ProjectPortal\Http\Middleware\CheckProjectSession;
use App\Apps\ProjectPortal\Models\ProjectApproval;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\ProjectThreadMessage;
use App\Apps\ProjectPortal\Models\ProjectUpdate;
use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Apps\ProjectPortal\Services\ProjectPortalAgendaSource;
use App\Apps\ProjectPortal\Services\ProjectPortalRetentionSource;
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
     *   session of the project in the URL (HttpOnly cookie).
     */
    public function middlewareAliases(): array
    {
        return ['project.session' => CheckProjectSession::class];
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
}
