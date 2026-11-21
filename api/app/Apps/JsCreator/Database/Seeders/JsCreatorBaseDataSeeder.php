<?php
/**
 * @file JsCreatorBaseDataSeeder.php
 * @path app/Apps/JsCreator/Database/Seeders/JsCreatorBaseDataSeeder.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Base data of the application "JS Creator" (JsCreatorApp::baseDataSeeders(), run by
 *   BaseDataSeeder): its permission keys incl. the tab permission `view-js-creator`
 *   (data/permissions.php).
 * @note Idempotent and never destructive - only missing keys are added.
 * @dependencies ModuleBaseDataSeeder.
 */

namespace App\Apps\JsCreator\Database\Seeders;

use Database\Seeders\ModuleBaseDataSeeder;

class JsCreatorBaseDataSeeder extends ModuleBaseDataSeeder
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
