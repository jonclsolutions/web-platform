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
 *   WebContentLanguages, CheckWebActive and the Web models with attachments.
 */

namespace App\Apps\Web;

use App\Apps\Web\Http\Middleware\CheckWebActive;
use App\Apps\Web\Services\WebAgendaSource;
use App\Apps\Web\Services\WebRetentionSource;
use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebLog;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Support\Apps\AppManifest;
use App\Support\Uploads\AttachmentPolicy;
use App\Apps\Web\Support\WebContentLanguages;
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

    /** @description See AppManifest::languageDeleted() - FAQ, jobs and references texts. */
    public function languageDeleted(string $code): void
    {
        WebContentLanguages::forget($code);
    }
}
