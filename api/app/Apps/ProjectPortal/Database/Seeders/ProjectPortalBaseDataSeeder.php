<?php
/**
 * @file ProjectPortalBaseDataSeeder.php
 * @path api/app/Apps/ProjectPortal/Database/Seeders/ProjectPortalBaseDataSeeder.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Base data of the project portal (ProjectPortalApp::baseDataSeeders(), run by
 *   BaseDataSeeder): the permission keys of the portal incl. the tab permission
 *   `view-project-portal` (data/permissions.php).
 * @note Idempotent and never destructive - only missing keys are added.
 * @dependencies ModuleBaseDataSeeder.
 */

namespace App\Apps\ProjectPortal\Database\Seeders;

use Database\Seeders\ModuleBaseDataSeeder;

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
        self::addPermissions(self::permissions());
    }
}
