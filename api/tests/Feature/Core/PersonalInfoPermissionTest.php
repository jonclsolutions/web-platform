<?php

/**
 * @file PersonalInfoPermissionTest.php
 * @path api/tests/Feature/Core/PersonalInfoPermissionTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of VT-13: the permission `web-view-personal-info` is gone - the
 *   migration removes it with its role / user assignments, the seed no longer has it - and an
 *   account WITHOUT any permission still manages its own account (read it, switch 2FA on), but
 *   not somebody else's.
 * @dependencies
 * - Tests\TestCase (InteractsWithAccounts); migration 2026_11_07_000000_remove_personal_info_permission.
 */

namespace Tests\Feature\Core;

use App\Models\Core\CorePermission;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * @description Removal of the personal info permission.
 */
class PersonalInfoPermissionTest extends TestCase
{
    /** @var string The removed key. */
    private const KEY = 'web-view-personal-info';

    /**
     * @description The migration deletes the key and, by cascade, its role and user assignments;
     *   down() adds the key back without assignments; the seed data no longer contains it.
     * @input The key assigned to a role and directly to a user; up(); down().
     * @output Key, role and user assignment gone; after down() the key without assignments;
     *   permissions.php without the key.
     */
    public function test_migration_removes_the_permission(): void
    {
        $user = $this->userWith([self::KEY]);
        $permission = CorePermission::where('permission_key', self::KEY)->sole();
        DB::table('user_permissions')->insert(['user_id' => $user->id, 'permission_id' => $permission->id]);
        $migration = require database_path('migrations/2026_11_07_000000_remove_personal_info_permission.php');

        $migration->up();
        $this->assertFalse(CorePermission::where('permission_key', self::KEY)->exists());
        $this->assertSame(0, DB::table('core_role_permissions')->where('permission_id', $permission->id)->count());
        $this->assertSame(0, DB::table('user_permissions')->where('permission_id', $permission->id)->count());

        $migration->down();
        $restored = CorePermission::where('permission_key', self::KEY)->sole();
        $this->assertSame(0, DB::table('core_role_permissions')->where('permission_id', $restored->id)->count());

        $this->assertNotContains(self::KEY, array_column(require database_path('seeders/data/permissions.php'), 'permission_key'));
    }

    /**
     * @description An account with no permission at all reads its own account and switches its
     *   own 2FA on (the personal info page); another account stays closed to it.
     * @input Account without permissions: GET / PUT {enable_2fa: true} own; GET another.
     * @output 200, 200 with 2FA on; 403.
     */
    public function test_own_account_without_any_permission(): void
    {
        $other = $this->user();
        $me = $this->signIn($this->userWith([]));

        $this->getJson("/api/core/users/{$me->id}")->assertOk();
        $this->putJson("/api/core/users/{$me->id}", ['enable_2fa' => true])->assertOk();
        $this->assertTrue((bool) $me->fresh()->enable_2fa);
        $this->getJson("/api/core/users/{$other->id}")->assertForbidden();
    }
}
