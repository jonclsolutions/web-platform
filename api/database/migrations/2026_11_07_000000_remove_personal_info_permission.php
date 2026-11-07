<?php
/**
 * @file 2026_11_07_000000_remove_personal_info_permission.php
 * @path api/database/migrations/2026_11_07_000000_remove_personal_info_permission.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Removes the permission `web-view-personal-info` (VT-13): the own personal info
 *   page (password, 2FA) is open to every signed-in user, so a role without the key could not
 *   change its own password or switch on 2FA. Its role / user assignments go with it
 *   (core_role_permissions, user_permissions: ON DELETE CASCADE).
 * @note down() adds the key back without any assignment - the former role assignments are not
 *   restored.
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @description The removed permission key. */
    private const KEY = 'web-view-personal-info';

    /**
     * @description Deletes the permission (and by cascade its assignments).
     * @return void
     */
    public function up(): void
    {
        DB::table('core_permissions')->where('permission_key', self::KEY)->delete();
    }

    /**
     * @description Adds the permission back (without assignments).
     * @return void
     */
    public function down(): void
    {
        if (!DB::table('core_permissions')->where('permission_key', self::KEY)->exists()) {
            DB::table('core_permissions')->insert([
                'permission_key' => self::KEY,
                'description'    => 'Zobrazit a upravit vlastní osobní údaje přihlášeného uživatele',
                'module'         => 'web',
            ]);
        }
    }
};
