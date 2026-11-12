<?php
/**
 * @file WebApp.php
 * @path app/Services/Web/WebApp.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manifest of the web application (public website, inquiries, leads, orders, job
 * applications, client projects and their portal) - everything the core needs to know about it.
 * Registered in config/apps.php.
 * @dependencies AppManifest; WebBaseDataSeeder, WebRetentionSource, WebAgendaSource, WebLog,
 *   WebContentLanguages and the Web models with attachments.
 */

namespace App\Services\Web;

use App\Models\Web\WebJobApplication;
use App\Models\Web\WebLog;
use App\Models\Web\WebProjectApproval;
use App\Models\Web\WebProjectThreadMessage;
use App\Models\Web\WebProjectUpdate;
use App\Models\Web\WebRawRequestCommission;
use App\Models\Web\WebSalesOrder;
use App\Support\Apps\AppManifest;
use App\Support\I18n\WebContentLanguages;
use Database\Seeders\Web\WebBaseDataSeeder;

final class WebApp extends AppManifest
{
    /** @description Upload profile of the inquiries (WebRawRequestCommission) - contact form and admin. */
    public const UPLOAD_RAW_REQUEST_COMMISSION = 'raw_request_commission';

    /** @description Upload profile of the orders (WebSalesOrder) - public order form and admin. */
    public const UPLOAD_SALES_ORDER = 'sales_order';

    /** @description Upload profile of the CV of a job application (WebJobApplication) - one file. */
    public const UPLOAD_JOB_APPLICATION = 'job_application';

    /** @description Upload profile of the project portal (threads, updates, approvals). */
    public const UPLOAD_PROJECT_THREAD = 'project_thread';

    /**
     * @description Allowed attachments of the inquiry / order forms - documents, images, archives,
     * audio / video, CAD.
     */
    public const COMMISSION_EXTENSIONS = [
        'pdf', 'doc', 'docx', 'dotx', 'odt', 'pages', 'rtf', 'txt', 'csv',
        'xls', 'xlsx', 'xlsm', 'xltx', 'ods', 'numbers', 'ppt', 'pptx', 'key',
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'heic', 'heif', 'psd', 'ai', 'eps',
        'zip', 'rar', '7z', 'tar', 'gz',
        'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
        'mp4', 'mov', 'avi', 'wmv', 'mkv', 'webm',
        'dwg', 'dxf', 'stp', 'step', 'stl', 'obj',
    ];

    /**
     * @description Upload profiles of the web (AppManifest::uploadProfiles()) - also read as
     *   constants by the FormRequests (count / total size limits).
     */
    public const UPLOAD_PROFILES = [
        self::UPLOAD_RAW_REQUEST_COMMISSION => [
            'extensions' => self::COMMISSION_EXTENSIONS, 'max_files' => 10, 'max_file_kb' => 20480, 'max_total_bytes' => 50 * 1024 * 1024,
        ],
        self::UPLOAD_SALES_ORDER => [
            'extensions' => self::COMMISSION_EXTENSIONS, 'max_files' => 10, 'max_file_kb' => 20480, 'max_total_bytes' => 50 * 1024 * 1024,
        ],
        self::UPLOAD_JOB_APPLICATION => [
            'extensions' => ['pdf', 'doc', 'docx', 'odt', 'pages', 'rtf', 'txt', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'zip', 'rar', '7z'],
            'max_files' => 1, 'max_file_kb' => 20480, 'max_total_bytes' => null,
        ],
        self::UPLOAD_PROJECT_THREAD => [
            'extensions' => [
                'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp',
                'jpg', 'jpeg', 'png', 'gif', 'webp',
                'zip', 'rar', '7z',
            ],
            'max_files' => 5, 'max_file_kb' => 15360, 'max_total_bytes' => null,
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
            'web/sales_orders',
            'web/project_threads',
            'web/project_updates',
            'web/project_approvals',
        ];
    }

    /** @description See AppManifest::morphMap(). */
    public function morphMap(): array
    {
        return [
            'job_application'        => WebJobApplication::class,
            'raw_request_commission' => WebRawRequestCommission::class,
            'sales_order'            => WebSalesOrder::class,
            'project_thread_message' => WebProjectThreadMessage::class,
            'project_update'         => WebProjectUpdate::class,
            'project_approval'       => WebProjectApproval::class,
        ];
    }

    /** @description See AppManifest::translationPermission(). */
    public function translationPermission(): ?string
    {
        return 'web-edit-website-update';
    }

    /** @description See AppManifest::languageDeleted() - FAQ, jobs and references texts. */
    public function languageDeleted(string $code): void
    {
        WebContentLanguages::forget($code);
    }
}
