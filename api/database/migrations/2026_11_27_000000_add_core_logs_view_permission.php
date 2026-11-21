<?php
/**
 * @file 2026_11_27_000000_add_core_logs_view_permission.php
 * @path api/database/migrations/2026_11_27_000000_add_core_logs_view_permission.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Adds the permission `core-logs-view` - reading the core audit log (sign-ins,
 *   accounts, roles, settings: e-mail and IP addresses of every account) no longer comes with the
 *   Core tab (`view-core`) alone. So that nobody loses access by the release, every role and every
 *   account that holds `view-core` today gets the new key too; the sysadmin then removes it where
 *   it is not needed.
 * @note down() removes the key; its role / user assignments go with it (ON DELETE CASCADE).
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @description The new permission key. */
    private const KEY = 'core-logs-view';

    /** @description The key whose holders get the new one. */
    private const FROM_KEY = 'view-core';

    /**
     * @description Creates the permission (when missing) and grants it to the holders of view-core.
     * @return void
     */
    public function up(): void
    {
        $id = DB::table('core_permissions')->where('permission_key', self::KEY)->value('id')
            ?? DB::table('core_permissions')->insertGetId([
                'permission_key' => self::KEY,
                'description'    => 'View the audit log of the core (sign-ins, accounts, roles, settings) - it contains e-mail and IP addresses',
                'module'         => 'core',
            ]);

        $fromId = DB::table('core_permissions')->where('permission_key', self::FROM_KEY)->value('id');
        if ($fromId === null) {
            return;
        }

        $roles = DB::table('core_role_permissions')->where('permission_id', $fromId)->pluck('role_id');
        foreach ($roles as $roleId) {
            DB::table('core_role_permissions')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $id]);
        }

        $users = DB::table('user_permissions')->where('permission_id', $fromId)->pluck('user_id');
        foreach ($users as $userId) {
            DB::table('user_permissions')->insertOrIgnore(['user_id' => $userId, 'permission_id' => $id]);
        }
    }

    /**
     * @description Removes the permission (and by cascade its assignments).
     * @return void
     */
    public function down(): void
    {
        DB::table('core_permissions')->where('permission_key', self::KEY)->delete();
    }
};
