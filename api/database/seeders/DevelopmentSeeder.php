<?php
/**
 * @file DevelopmentSeeder.php
 * @path api/database/seeders/DevelopmentSeeder.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-30
 * @description Data for LOCAL development only (DatabaseSeeder calls it only when APP_ENV=local):
 *   - the test sysadmin account `sysadmin@sysadmin.sysadmin` / `123456Ab.` - activated, role
 *     sysadmin (2FA by e-mail is forced for the role: the code arrives in Mailpit,
 *     http://127.0.0.1:8025);
 *   - the domain `sysadmin.sysadmin` allowed in the e-mail access policy, so the account keeps
 *     logging in after a company domain is set;
 *   - roles for testing permissions: read-only-core / -web / -shop (only viewing),
 *     full-web-core / full-shop-core (every permission of the module and of Core) and
 *     all-permissions (every permission - an ordinary user with full rights, not sysadmin).
 * @note Idempotent and never destructive: an existing account keeps its (possibly changed)
 *   password, an existing role keeps its (possibly edited) permissions - only what is missing
 *   is created. The permissions of a new role are chosen from the permission keys in the
 *   database, so a new permission is picked up by a role created later.
 * @security NEVER run in production: a known password. DatabaseSeeder guards the call and this
 *   seeder refuses itself outside APP_ENV=local.
 * @refactor-note (2026-10-31) Test role set changed: editor-web, editor-shop and manager
 *   replaced by full-web-core, full-shop-core and all-permissions. The former test roles are
 *   soft-deleted when they still carry the test note and no user has them (OBSOLETE_TEST_ROLES).
 * @dependencies
 * - BaseDataSeeder (permissions, sysadmin role) must have run first.
 */

namespace Database\Seeders;

use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class DevelopmentSeeder extends Seeder
{
    /** Test sysadmin account of local development. */
    public const TEST_EMAIL = 'sysadmin@sysadmin.sysadmin';
    public const TEST_PASSWORD = '123456Ab.';
    public const TEST_DOMAIN = 'sysadmin.sysadmin';

    /** Note in the description of every test role. */
    private const TEST_ROLE_NOTE = 'Test role (local development).';

    /** Test roles of the former set (until 2026-10-31) - removed when unused, see removeObsoleteTestRoles(). */
    private const OBSOLETE_TEST_ROLES = ['editor-web', 'editor-shop', 'manager'];

    /**
     * @description Creates the missing test account, policy rule and test roles.
     * @return void
     * @throws RuntimeException Outside APP_ENV=local.
     */
    public function run(): void
    {
        if (!app()->environment('local')) {
            throw new RuntimeException('DevelopmentSeeder runs only with APP_ENV=local (it creates an account with a known password).');
        }

        if (!CoreEmailAccessRule::where('type', 'domain')->where('value', self::TEST_DOMAIN)->exists()) {
            CoreEmailAccessRule::create(['type' => 'domain', 'value' => self::TEST_DOMAIN]);
        }

        $sysadminRole = CoreRole::where('role_name', 'sysadmin')->firstOrFail();
        $user = User::withTrashed()->where('user_email', self::TEST_EMAIL)->first();
        if (!$user) {
            $user = User::create([
                'user_email'         => self::TEST_EMAIL,
                'full_name'          => 'Sysadmin (local test)',
                'user_password_hash' => Hash::make(self::TEST_PASSWORD),
                'activated_at'       => now(),
                'is_blocked'         => false,
            ]);
        }
        $user->roles()->syncWithoutDetaching([$sysadminRole->id]);

        $keys = CorePermission::pluck('permission_key')->all();
        foreach ($this->testRoles($keys) as $name => [$description, $permissionKeys]) {
            $role = CoreRole::withTrashed()->where('role_name', $name)->first();
            if ($role) {
                continue;
            }
            $role = CoreRole::create(['role_name' => $name, 'description' => "{$description} " . self::TEST_ROLE_NOTE, 'forces_2fa' => false]);
            $role->permissions()->sync(CorePermission::whereIn('permission_key', $permissionKeys)->pluck('id')->all());
        }

        $this->removeObsoleteTestRoles();
    }

    /**
     * @description Soft-deletes the test roles of the former set - only a role that still carries
     *   the test note (= created by this seeder, not a real role of the same name) and that no
     *   user has. Anything else stays untouched.
     * @return void
     */
    private function removeObsoleteTestRoles(): void
    {
        CoreRole::whereIn('role_name', self::OBSOLETE_TEST_ROLES)
            ->where('description', 'like', '%' . self::TEST_ROLE_NOTE)
            ->whereDoesntHave('users')
            ->get()
            ->each(fn (CoreRole $role) => $role->delete());
    }

    /**
     * @description Test roles and their permission keys, chosen from the existing keys.
     *   Module of a key = its prefix (`core-`, `web-`, `shop-`); the tab permissions
     *   (`view-core`, `view-web`, `view-eshop`) belong to their module. A key of no module
     *   (e.g. `view-deleted`) is only in all-permissions.
     * @param array<int, string> $keys All permission keys of the database.
     * @return array<string, array{0: string, 1: array<int, string>}> name => [description, keys]
     */
    public function testRoles(array $keys): array
    {
        $tab = ['core' => 'view-core', 'web' => 'view-web', 'shop' => 'view-eshop'];
        $inModule = fn (string $key, string $module): bool => $key === $tab[$module] || str_starts_with($key, "{$module}-");
        $isRead = fn (string $key): bool => str_starts_with($key, 'view-') || str_ends_with($key, '-view') || str_contains($key, '-view-');
        $isWrite = fn (string $key): bool => str_ends_with($key, '-create') || str_ends_with($key, '-update');
        $pick = fn (callable $filter): array => array_values(array_filter($keys, $filter));

        $roles = [];
        foreach (['core', 'web', 'shop'] as $module) {
            $roles["read-only-{$module}"] = [
                "Can only view the {$module} module.",
                $pick(fn ($k) => $inModule($k, $module) && $isRead($k)),
            ];
        }
        foreach (['web', 'shop'] as $module) {
            $roles["full-{$module}-core"] = [
                "Every permission of the {$module} and core modules.",
                $pick(fn ($k) => $inModule($k, $module) || $inModule($k, 'core')),
            ];
        }
        $roles['all-permissions'] = [
            'Every permission - an ordinary user with full rights (not the protected sysadmin role).',
            $keys,
        ];

        return $roles;
    }
}
