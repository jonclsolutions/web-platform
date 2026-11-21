<?php
/**
 * @file JsCreatorApp.php
 * @path app/Apps/JsCreator/JsCreatorApp.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manifest of the application "JS Creator" - posts for social networks generated
 *   from own templates (no AI, no public part). Everything the core needs to know about it:
 *   permissions, audit log, base data, retention (trash of the workspaces + clean-up of files
 *   without a record) and the upload profiles of the library. Registered in config/apps.php.
 * @note Every account has its own private workspace - nobody else (not even the sysadmin) sees
 *   it. Its files are NOT in uploadFolders(): the core command storage:prune-orphans knows only
 *   attachments and would delete them; JsCreatorRetentionSource cleans them up instead.
 * @dependencies AppManifest; JsCreatorBaseDataSeeder, JsCreatorLog, JsCreatorRetentionSource,
 *   FontFile.
 */

namespace App\Apps\JsCreator;

use App\Apps\JsCreator\Database\Seeders\JsCreatorBaseDataSeeder;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\JsCreatorRetentionSource;
use App\Apps\JsCreator\Support\FontFile;
use App\Support\Apps\AppManifest;

final class JsCreatorApp extends AppManifest
{
    /** @description Upload profile of the images of the library (StoreAssetsRequest). */
    public const UPLOAD_IMAGE = 'js_creator_image';

    /** @description Upload profile of the own fonts (StoreFontRequest). */
    public const UPLOAD_FONT = 'js_creator_font';

    /** @description See AppManifest::id(). */
    public function id(): string
    {
        return 'js-creator';
    }

    /** @description See AppManifest::tabPermission(). */
    public function tabPermission(): string
    {
        return 'view-js-creator';
    }

    /** @description See AppManifest::logModel(). */
    public function logModel(): string
    {
        return JsCreatorLog::class;
    }

    /** @description See AppManifest::baseDataSeeders(). */
    public function baseDataSeeders(): array
    {
        return [JsCreatorBaseDataSeeder::class];
    }

    /** @description See AppManifest::retentionSources(). */
    public function retentionSources(): array
    {
        return [JsCreatorRetentionSource::class];
    }

    /**
     * @description See AppManifest::uploadProfiles() - one file per request in the admin (the
     *   request limit of the server is 25 MB).
     */
    public function uploadProfiles(): array
    {
        return [
            self::UPLOAD_IMAGE => ['extensions' => ['jpg', 'jpeg', 'png', 'webp'], 'max_files' => 10, 'max_file_kb' => 15360, 'max_total_bytes' => null],
            self::UPLOAD_FONT  => ['extensions' => FontFile::EXTENSIONS, 'max_files' => 1, 'max_file_kb' => 5120, 'max_total_bytes' => null],
        ];
    }
}
