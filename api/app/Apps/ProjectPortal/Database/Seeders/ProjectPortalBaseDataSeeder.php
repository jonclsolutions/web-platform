<?php
/**
 * @file ProjectPortalBaseDataSeeder.php
 * @path api/app/Apps/ProjectPortal/Database/Seeders/ProjectPortalBaseDataSeeder.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Base data of the project portal (ProjectPortalApp::baseDataSeeders(), run by
 *   BaseDataSeeder): the permission keys of the portal incl. the tab permission
 *   `view-project-portal` (data/permissions.php), the browser tab titles of its public pages
 *   (data/page_titles.php) and the settings row (data/project_portal_settings.php).
 * @note Idempotent and never destructive - only missing keys / rows are added.
 * @dependencies ModuleBaseDataSeeder.
 */

namespace App\Apps\ProjectPortal\Database\Seeders;

use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use Database\Seeders\ModuleBaseDataSeeder;
use Illuminate\Support\Facades\DB;

class ProjectPortalBaseDataSeeder extends ModuleBaseDataSeeder
{
    /** @description See ModuleBaseDataSeeder::moduleDir(). */
    protected static function moduleDir(): string
    {
        return __DIR__;
    }

    /** @description See ModuleBaseDataSeeder::run(). */
    public function run(): void
    {
        DB::transaction(function () {
            self::addPermissions(self::permissions());
            self::addPageTitles(self::data('page_titles'));
            if (!ProjectPortalSetting::query()->exists()) {
                ProjectPortalSetting::create(self::data('project_portal_settings'));
            }
        });
    }
}
