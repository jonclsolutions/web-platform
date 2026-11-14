<?php
/**
 * @file __APP__BaseDataSeeder.php
 * @path app/Apps/__APP__/Database/Seeders/__APP__BaseDataSeeder.php
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Base data of the application "__NAME__" (__APP__App::baseDataSeeders(), run by
 *   BaseDataSeeder): its permission keys incl. the tab permission `view-__app__`
 *   (data/permissions.php).
 * @note Idempotent and never destructive - only missing keys are added.
 * @dependencies ModuleBaseDataSeeder.
 */

namespace App\Apps\__APP__\Database\Seeders;

use Database\Seeders\ModuleBaseDataSeeder;

class __APP__BaseDataSeeder extends ModuleBaseDataSeeder
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
