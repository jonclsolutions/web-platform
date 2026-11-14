<?php
/**
 * @file __APP__App.php
 * @path app/Apps/__APP__/__APP__App.php
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Manifest of the application "__NAME__" - everything the core needs to know about
 *   it (permissions, audit log, base data). Registered in config/apps.php.
 * @note Add only what the application uses: retentionSources() (GDPR storage limitation),
 *   agendaSources() (dates in the admin calendar), uploadProfiles() / uploadFolders() (files),
 *   morphMap() (attachments), middlewareAliases(), commands() - see AppManifest.
 * @dependencies AppManifest; __APP__BaseDataSeeder, __APP__Log.
 */

namespace App\Apps\__APP__;

use App\Apps\__APP__\Database\Seeders\__APP__BaseDataSeeder;
use App\Apps\__APP__\Models\__APP__Log;
use App\Support\Apps\AppManifest;

final class __APP__App extends AppManifest
{
    /** @description See AppManifest::id(). */
    public function id(): string
    {
        return '__app__';
    }

    /** @description See AppManifest::tabPermission(). */
    public function tabPermission(): string
    {
        return 'view-__app__';
    }

    /** @description See AppManifest::logModel(). */
    public function logModel(): string
    {
        return __APP__Log::class;
    }

    /** @description See AppManifest::baseDataSeeders(). */
    public function baseDataSeeders(): array
    {
        return [__APP__BaseDataSeeder::class];
    }
}
