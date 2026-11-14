<?php
/**
 * @file 2026_11_24_000002_project_portal_table_and_permission_names.php
 * @path app/Apps/ProjectPortal/Database/Migrations/2026_11_24_000002_project_portal_table_and_permission_names.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The tables and permissions of the projects carry the prefix of the project portal
 *   (they still had the one of the web application, where the projects started):
 *   - tables `web_project*` → `project_portal_project*` (rows, foreign keys and the names of the
 *     indexes / foreign keys stay);
 *   - permissions `web-projects-*` → `project-portal-projects-*` (same ids, so roles and accounts
 *     keep them).
 * @note down() reverses both steps.
 * @dependencies the web_project* tables (migrations of the portal before this one), core_permissions.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<int, string> Former table names (renamed by the prefix). */
    private const TABLES = [
        'web_projects', 'web_project_accounts', 'web_project_sessions', 'web_project_login_codes',
        'web_project_checkpoints', 'web_project_threads', 'web_project_thread_messages',
        'web_project_updates', 'web_project_approvals', 'web_project_approval_decisions',
        'web_project_templates', 'web_project_template_checkpoints',
    ];

    /** @description Former / new table prefix. */
    private const OLD_TABLE_PREFIX = 'web_project';
    private const NEW_TABLE_PREFIX = 'project_portal_project';

    /** @description Former / new permission key prefix. */
    private const OLD_PERMISSION_PREFIX = 'web-projects-';
    private const NEW_PERMISSION_PREFIX = 'project-portal-projects-';

    /**
     * @description Renames the tables and the permission keys to the portal prefix.
     * @return void
     */
    public function up(): void
    {
        $this->renameTables(self::OLD_TABLE_PREFIX, self::NEW_TABLE_PREFIX);
        $this->renamePermissions(self::OLD_PERMISSION_PREFIX, self::NEW_PERMISSION_PREFIX);
    }

    /**
     * @description Restores the former table names and permission keys.
     * @return void
     */
    public function down(): void
    {
        $this->renamePermissions(self::NEW_PERMISSION_PREFIX, self::OLD_PERMISSION_PREFIX);
        $this->renameTables(self::NEW_TABLE_PREFIX, self::OLD_TABLE_PREFIX);
    }

    /**
     * @description Renames every table of the list from one prefix to the other (skipped when the
     *   source is missing or the target exists already, so a partly run migration can be re-run).
     * @param string $from Current prefix.
     * @param string $to New prefix.
     * @return void
     */
    private function renameTables(string $from, string $to): void
    {
        foreach (self::TABLES as $table) {
            $source = $from . substr($table, strlen(self::OLD_TABLE_PREFIX));
            $target = $to . substr($table, strlen(self::OLD_TABLE_PREFIX));
            if (Schema::hasTable($source) && !Schema::hasTable($target)) {
                Schema::rename($source, $target);
            }
        }
    }

    /**
     * @description Renames the permission keys with a prefix (ids stay, so do the grants).
     * @param string $from Current key prefix.
     * @param string $to New key prefix.
     * @return void
     */
    private function renamePermissions(string $from, string $to): void
    {
        DB::transaction(function () use ($from, $to) {
            foreach (DB::table('core_permissions')->where('permission_key', 'like', $from . '%')->get(['id', 'permission_key']) as $permission) {
                DB::table('core_permissions')->where('id', $permission->id)
                    ->update(['permission_key' => $to . substr($permission->permission_key, strlen($from))]);
            }
        });
    }
};
