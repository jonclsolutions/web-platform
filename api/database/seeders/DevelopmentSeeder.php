<?php
/**
 * @file DevelopmentSeeder.php
 * @path api/database/seeders/DevelopmentSeeder.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Data for LOCAL development only (DatabaseSeeder calls it only when APP_ENV=local):
 *   - the test sysadmin account `sysadmin@sysadmin.sysadmin` / `123456Ab.` - activated, role
 *     sysadmin (2FA by e-mail is forced for the role: the code arrives in Mailpit,
 *     http://127.0.0.1:8025);
 *   - the domain `sysadmin.sysadmin` allowed in the e-mail access policy, so the account keeps
 *     logging in after a company domain is set;
 *   - roles for testing permissions: read-only-<module> for the core and every registered
 *     application (only viewing), full-<application>-core (every permission of the application
 *     and of the core) and all-permissions (every permission - an ordinary user with full
 *     rights, not sysadmin).
 * @note Idempotent and never destructive: an existing account keeps its (possibly changed)
 *   password, an existing role keeps its (possibly edited) permissions - only what is missing
 *   is created. The permissions of a new role are chosen from the permission keys in the
 *   database, so a new permission is picked up by a role created later.
 * @security NEVER run in production: a known password. DatabaseSeeder guards the call and this
 *   seeder refuses itself outside APP_ENV=local.
 * @dependencies
 * - BaseDataSeeder (permissions, sysadmin role) must have run first.
 * - AppRegistry: the registered applications (config/apps.php).
 */

namespace Database\Seeders;

use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use App\Models\User;
use App\Support\Apps\AppRegistry;
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

        $modules = CorePermission::pluck('module', 'permission_key')->all();
        foreach ($this->testRoles($modules) as $name => [$description, $permissionKeys]) {
            $role = CoreRole::withTrashed()->where('role_name', $name)->first();
            if ($role) {
                continue;
            }
            $role = CoreRole::create(['role_name' => $name, 'description' => "{$description} " . self::TEST_ROLE_NOTE, 'forces_2fa' => false]);
            $role->permissions()->sync(CorePermission::whereIn('permission_key', $permissionKeys)->pluck('id')->all());
        }
    }

    /**
     * @description Test roles and their permission keys, chosen from the existing keys by their
     *   module (`core`, or the id of an application - its tab permission included). A read key
     *   is a `view-…`, `…-view` or `…-view-…` key.
     * @param array<string, string> $modules Permission key => module, every key of the database.
     * @return array<string, array{0: string, 1: array<int, string>}> name => [description, keys]
     */
    public function testRoles(array $modules): array
    {
        $isRead = fn (string $key): bool => str_starts_with($key, 'view-') || str_ends_with($key, '-view') || str_contains($key, '-view-');
        $keysOf = fn (string $module, bool $readOnly = false): array => array_keys(array_filter(
            $modules,
            fn (string $keyModule, string $key): bool => $keyModule === $module && (!$readOnly || $isRead($key)),
            ARRAY_FILTER_USE_BOTH
        ));
        $apps = array_map(fn ($app) => $app->id(), AppRegistry::apps());

        $roles = [];
        foreach (['core', ...$apps] as $module) {
            $roles["read-only-{$module}"] = ["Can only view the {$module} module.", $keysOf($module, true)];
        }
        foreach ($apps as $app) {
            $roles["full-{$app}-core"] = ["Every permission of the {$app} and core modules.", [...$keysOf($app), ...$keysOf('core')]];
        }
        $roles['all-permissions'] = [
            'Every permission - an ordinary user with full rights (not the protected sysadmin role).',
            array_keys($modules),
        ];

        return $roles;
    }
}
