<?php
/**
 * @file 2026_11_22_000000_project_portal_application.php
 * @path app/Apps/ProjectPortal/Database/Migrations/2026_11_22_000000_project_portal_application.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The project portal as an application of its own:
 *   - its audit log `project_portal_logs` (same shape as the other audit logs); the project rows
 *     of `web_logs` (module `WebProject…`) move into it with the module / entity names without
 *     the `Web` prefix (`Project`, `ProjectCheckpoint`, `ProjectPortal` …);
 *   - the tab permission `view-project-portal` for every role / account that has
 *     `web-projects-view`, and `project-portal-view-logs` for every role / account that could read
 *     the project rows in the web log (`web-view-web-logs`) - nobody gains or loses access;
 *   - the module of the `web-projects-*` permissions is `project-portal` (the role editor shows
 *     them under the application; the keys stay, so roles stay valid).
 * @note down() moves the rows back to web_logs, drops the table and removes the two permissions.
 * @dependencies web_logs, users, core_permissions, core_role_permissions, user_permissions.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @description Columns of an audit log row (copied between the logs). */
    private const COLUMNS = ['created_at', 'origin', 'event_type', 'module', 'description', 'affected_entity_type',
        'affected_entity_id', 'user_id', 'context_data', 'user_id_plain', 'user_plain'];

    /** @description New permissions => the permission whose holders get them. */
    private const GRANTS = [
        'view-project-portal'      => 'web-projects-view',
        'project-portal-view-logs' => 'web-view-web-logs',
    ];

    /** @description Rows of the new permissions (English fallback descriptions). */
    private const PERMISSIONS = [
        ['permission_key' => 'view-project-portal', 'description' => '[recommended: always on] Show the Project portal application in the admin - without it the application cannot be opened', 'module' => 'core'],
        ['permission_key' => 'project-portal-view-logs', 'description' => 'View the log history (audit trail) of the project portal', 'module' => 'project-portal'],
    ];

    /**
     * @description Creates the portal log, moves the project rows, adds and grants the permissions.
     * @return void
     */
    public function up(): void
    {
        Schema::create('project_portal_logs', function (Blueprint $table) {
            $table->increments('id');
            $table->dateTime('created_at')->useCurrent();
            $table->string('origin')->nullable();
            $table->string('event_type', 50);
            $table->string('module', 100);
            $table->string('description', 1000);
            $table->string('affected_entity_type', 50)->nullable();
            $table->unsignedBigInteger('affected_entity_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->text('context_data')->nullable();
            $table->string('user_id_plain')->nullable();
            $table->string('user_plain')->nullable();
            $table->foreign('user_id', 'fk_project_portal_logs_user_id')->references('id')->on('users')->nullOnDelete();
        });

        DB::transaction(function () {
            $this->moveLogs('web_logs', 'project_portal_logs', 'WebProject', fn (?string $name) => $name === null ? null : preg_replace('/^WebProject/', 'Project', $name));
            $this->addPermissions();
            DB::table('core_permissions')->where('permission_key', 'like', 'web-projects-%')->update(['module' => 'project-portal']);
        });
    }

    /**
     * @description Moves the rows back to web_logs, drops the portal log, removes the permissions.
     * @return void
     */
    public function down(): void
    {
        DB::transaction(function () {
            $this->moveLogs('project_portal_logs', 'web_logs', 'Project', fn (?string $name) => $name === null ? null : preg_replace('/^Project/', 'WebProject', $name));
            $ids = DB::table('core_permissions')->whereIn('permission_key', array_keys(self::GRANTS))->pluck('id');
            DB::table('core_role_permissions')->whereIn('permission_id', $ids)->delete();
            DB::table('user_permissions')->whereIn('permission_id', $ids)->delete();
            DB::table('core_permissions')->whereIn('id', $ids)->delete();
            DB::table('core_permissions')->where('permission_key', 'like', 'web-projects-%')->update(['module' => 'web']);
        });
        Schema::dropIfExists('project_portal_logs');
    }

    /**
     * @description Copies the log rows whose module starts with the prefix (oldest first) and
     *   deletes them in the source.
     * @param string $from Source table.
     * @param string $to Target table.
     * @param string $prefix Module prefix of the moved rows.
     * @param callable(?string): ?string $rename New module / entity name.
     * @return void
     */
    private function moveLogs(string $from, string $to, string $prefix, callable $rename): void
    {
        DB::table($from)->where('module', 'like', $prefix . '%')->orderBy('id')->chunkById(500, function ($rows) use ($from, $to, $rename) {
            $insert = [];
            foreach ($rows as $row) {
                $values = array_intersect_key((array) $row, array_flip(self::COLUMNS));
                $values['module'] = $rename($values['module']);
                $values['affected_entity_type'] = $rename($values['affected_entity_type']);
                $insert[] = $values;
            }
            DB::table($to)->insert($insert);
            DB::table($from)->whereIn('id', $rows->pluck('id'))->delete();
        });
    }

    /**
     * @description Adds the missing new permissions and grants them to the roles / accounts that
     *   hold the permission they replace.
     * @return void
     */
    private function addPermissions(): void
    {
        foreach (self::PERMISSIONS as $permission) {
            if (!DB::table('core_permissions')->where('permission_key', $permission['permission_key'])->exists()) {
                DB::table('core_permissions')->insert($permission);
            }
        }
        foreach (self::GRANTS as $new => $source) {
            $newId = DB::table('core_permissions')->where('permission_key', $new)->value('id');
            $sourceId = DB::table('core_permissions')->where('permission_key', $source)->value('id');
            if ($sourceId === null) {
                continue;
            }
            foreach (['core_role_permissions' => 'role_id', 'user_permissions' => 'user_id'] as $table => $owner) {
                $holders = DB::table($table)->where('permission_id', $sourceId)->pluck($owner);
                $has = DB::table($table)->where('permission_id', $newId)->pluck($owner)->all();
                $rows = $holders->diff($has)->map(fn ($id) => [$owner => $id, 'permission_id' => $newId])->values()->all();
                if ($rows !== []) {
                    DB::table($table)->insert($rows);
                }
            }
        }
    }
};
