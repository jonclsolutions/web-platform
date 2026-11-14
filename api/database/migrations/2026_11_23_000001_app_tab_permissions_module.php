<?php
/**
 * @file 2026_11_23_000001_app_tab_permissions_module.php
 * @path api/database/migrations/2026_11_23_000001_app_tab_permissions_module.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The tab permission of an application (`view-web`, `view-eshop`,
 *   `view-project-portal`, AppManifest::tabPermission()) belongs to the module of the application,
 *   not to the core: the role editor lists it with the other permissions of the application and a
 *   removed application takes it along. Sets `core_permissions.module` of the tab permission of
 *   every registered application to its id (the seeders write new rows that way).
 * @dependencies core_permissions, AppRegistry (config/apps.php).
 */

use App\Support\Apps\AppRegistry;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * @description Module of each tab permission = id of its application.
     */
    public function up(): void
    {
        foreach (AppRegistry::apps() as $app) {
            DB::table('core_permissions')->where('permission_key', $app->tabPermission())->update(['module' => $app->id()]);
        }
    }

    /**
     * @description Back to the core module.
     */
    public function down(): void
    {
        foreach (AppRegistry::apps() as $app) {
            DB::table('core_permissions')->where('permission_key', $app->tabPermission())->update(['module' => 'core']);
        }
    }
};
