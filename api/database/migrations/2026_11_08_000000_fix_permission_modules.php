<?php
/**
 * @file 2026_11_08_000000_fix_permission_modules.php
 * @path api/database/migrations/2026_11_08_000000_fix_permission_modules.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Moves four permission keys to the module they belong to - the role editor
 *   groups the permissions by `module`, so they were listed under the wrong section:
 *   core-view-welcome-page and view-deleted (cross-module) -> core, shop-view-dashboard and
 *   shop-view-logs -> shop. Role assignments are not touched.
 * @note down() restores the former modules.
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @description permission_key => [new module, former module]. */
    private const MODULES = [
        'core-view-welcome-page' => ['core', 'web'],
        'view-deleted'           => ['core', 'web'],
        'shop-view-dashboard'    => ['shop', 'core'],
        'shop-view-logs'         => ['shop', 'core'],
    ];

    /**
     * @description Sets the new modules.
     * @return void
     */
    public function up(): void
    {
        foreach (self::MODULES as $key => [$module]) {
            DB::table('core_permissions')->where('permission_key', $key)->update(['module' => $module]);
        }
    }

    /**
     * @description Restores the former modules.
     * @return void
     */
    public function down(): void
    {
        foreach (self::MODULES as $key => [, $former]) {
            DB::table('core_permissions')->where('permission_key', $key)->update(['module' => $former]);
        }
    }
};
