<?php
/**
 * @file 2026_11_25_000000_project_portal_maintenance_and_dashboard.php
 * @path app/Apps/ProjectPortal/Database/Migrations/2026_11_25_000000_project_portal_maintenance_and_dashboard.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The project portal gets a maintenance switch like the web and the e-shop, and a
 *   dashboard:
 *   - `project_portal_settings.is_portal_active` (default on) + `portal_maintenance_message`
 *     (text of the maintenance page of the client portal and the order form);
 *   - permission `project-portal-set-maintenance-mode` (switch) for who may edit the settings
 *     of the portal, `project-portal-view-dashboard` (dashboard) for who sees the portal.
 * @note down() removes the columns and the permissions (with their grants).
 * @dependencies project_portal_settings, core_permissions, core_role_permissions, user_permissions.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, array{0: string, 1: string}> New permission => [English fallback description, permission whose holders get it]. */
    private const PERMISSIONS = [
        'project-portal-set-maintenance-mode' => ['Switch the public portal and the order form on / off (maintenance mode)', 'project-portal-settings-update'],
        'project-portal-view-dashboard'       => ['View the dashboard of the project portal (overview metrics and recent activity)', 'view-project-portal'],
    ];

    /**
     * @description Adds the columns and the permissions.
     * @return void
     */
    public function up(): void
    {
        if (!Schema::hasColumn('project_portal_settings', 'is_portal_active')) {
            Schema::table('project_portal_settings', function (Blueprint $table) {
                $table->boolean('is_portal_active')->default(true)->after('id');
                $table->string('portal_maintenance_message', 500)->nullable()->after('is_portal_active');
            });
        }

        DB::transaction(function () {
            foreach (self::PERMISSIONS as $key => [$description, $source]) {
                if (!DB::table('core_permissions')->where('permission_key', $key)->exists()) {
                    DB::table('core_permissions')->insert(['permission_key' => $key, 'description' => $description, 'module' => 'project-portal']);
                }
                $this->grant($key, $source);
            }
        });
    }

    /**
     * @description Removes the permissions (with their grants) and the columns.
     * @return void
     */
    public function down(): void
    {
        DB::transaction(function () {
            $ids = DB::table('core_permissions')->whereIn('permission_key', array_keys(self::PERMISSIONS))->pluck('id');
            DB::table('core_role_permissions')->whereIn('permission_id', $ids)->delete();
            DB::table('user_permissions')->whereIn('permission_id', $ids)->delete();
            DB::table('core_permissions')->whereIn('id', $ids)->delete();
        });

        if (Schema::hasColumn('project_portal_settings', 'is_portal_active')) {
            Schema::table('project_portal_settings', function (Blueprint $table) {
                $table->dropColumn(['is_portal_active', 'portal_maintenance_message']);
            });
        }
    }

    /**
     * @description Gives a permission to every role / account holding the source permission.
     * @param string $key Permission to give.
     * @param string $source Permission whose holders get it.
     * @return void
     */
    private function grant(string $key, string $source): void
    {
        $id = DB::table('core_permissions')->where('permission_key', $key)->value('id');
        $sourceId = DB::table('core_permissions')->where('permission_key', $source)->value('id');
        if ($id === null || $sourceId === null) {
            return;
        }
        foreach (['core_role_permissions' => 'role_id', 'user_permissions' => 'user_id'] as $table => $owner) {
            $holders = DB::table($table)->where('permission_id', $sourceId)->distinct()->pluck($owner);
            $has = DB::table($table)->where('permission_id', $id)->pluck($owner)->all();
            $rows = $holders->diff($has)->map(fn ($ownerId) => [$owner => $ownerId, 'permission_id' => $id])->values()->all();
            if ($rows !== []) {
                DB::table($table)->insert($rows);
            }
        }
    }
};
