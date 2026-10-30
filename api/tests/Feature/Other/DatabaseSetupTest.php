<?php

/**
 * @file DatabaseSetupTest.php
 * @path api/tests/Feature/Other/DatabaseSetupTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-30
 * @description Tests of the database setup of a new installation (2026-10-30):
 *   `db:create-if-missing` (database created only when missing, invalid settings refused, no
 *   privilege reported), `security:create-sysadmin` (first production sysadmin: validated input,
 *   hidden password typed twice, activated account with the sysadmin role, e-mail exception of
 *   the access policy, core log, `--if-none`) and DevelopmentSeeder (local test account, allowed
 *   test domain, test roles; local only, never overwrites), BaseDataSeeder (permissions, protected
 *   sysadmin role with all of them, page titles, document types, settings rows; only adds) and
 *   DatabaseSeeder (development data only in APP_ENV=local).
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers); a PDO mock for the MySQL server.
 */

namespace Tests\Feature\Other;

use App\Console\Commands\CreateDatabaseCommand;
use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use App\Models\User;
use App\Models\Legal\DocumentType;
use App\Models\Shop\ShopSiteSetting;
use App\Models\Web\WebSiteSetting;
use Database\Seeders\BaseDataSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DevelopmentSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PDO;
use PDOException;
use PDOStatement;
use RuntimeException;
use Tests\TestCase;

/**
 * @description db:create-if-missing, security:create-sysadmin, DevelopmentSeeder.
 */
class DatabaseSetupTest extends TestCase
{
    /** Current fake server connection of db:create-if-missing (changed per scenario). */
    private ?\Closure $connect = null;

    /**
     * @description Makes db:create-if-missing use the given server connection. The command is
     *   bound once (Artisan keeps the resolved instance) and asks this test for the connection.
     * @param \Closure(array<string, mixed>): PDO $connect Returns the PDO (or throws).
     * @return void
     */
    private function fakeServer(\Closure $connect): void
    {
        $first = $this->connect === null;
        $this->connect = $connect;
        if (!$first) {
            return;
        }
        $test = $this;
        $this->app->instance(CreateDatabaseCommand::class, new class($test) extends CreateDatabaseCommand {
            public function __construct(private DatabaseSetupTest $test)
            {
                parent::__construct();
            }

            protected function connectToServer(array $config): PDO
            {
                return $this->test->connectFake($config);
            }
        });
    }

    /**
     * @description Server connection of the fake command (see fakeServer()).
     * @param array<string, mixed> $config Connection settings.
     * @return PDO
     */
    public function connectFake(array $config): PDO
    {
        return ($this->connect)($config);
    }

    /**
     * @description A MySQL connection named `fake` with the given database name.
     * @param string $database DB_DATABASE.
     * @return void
     */
    private function fakeConnection(string $database): void
    {
        config(['database.connections.fake' => ['driver' => 'mysql', 'host' => '127.0.0.1', 'port' => 3306, 'database' => $database, 'username' => 'root', 'password' => 'p4ss']]);
    }

    /**
     * @description PDO mock: `SELECT … SCHEMATA` answers $exists, `exec` records the statement
     *   or throws when $createFails.
     * @param bool $exists Whether the database exists.
     * @param bool $createFails Whether CREATE DATABASE fails (no privilege).
     * @param array<int, string> $executed Receives the executed statements.
     * @return PDO
     */
    private function pdo(bool $exists, bool $createFails = false, array &$executed = []): PDO
    {
        $statement = $this->createMock(PDOStatement::class);
        $statement->method('execute')->willReturn(true);
        $statement->method('fetchColumn')->willReturn($exists ? 1 : false);
        $pdo = $this->createMock(PDO::class);
        $pdo->method('prepare')->willReturn($statement);
        $pdo->method('exec')->willReturnCallback(function (string $sql) use (&$executed, $createFails) {
            if ($createFails) {
                throw new PDOException('Access denied to database');
            }
            $executed[] = $sql;
            return 1;
        });
        return $pdo;
    }

    /**
     * @description Settings that cannot be used are refused before connecting; the SQLite
     *   connection of the tests has nothing to create.
     * @input --connection=missing; default connection (sqlite); fake mysql with DB name 'bad-name;'.
     * @output exit 1 "Unknown database connection: missing"; exit 0 "… uses the driver 'sqlite' -
     *   nothing to create."; exit 1 "Invalid database name …" (no connection attempt).
     */
    public function test_create_database_refuses_unusable_settings(): void
    {
        $this->fakeServer(fn () => $this->fail('must not connect'));

        $this->artisan('db:create-if-missing', ['--connection' => 'missing'])
            ->expectsOutput('Unknown database connection: missing')->assertExitCode(1);
        $this->artisan('db:create-if-missing')
            ->expectsOutputToContain("uses the driver 'sqlite' - nothing to create.")->assertExitCode(0);

        $this->fakeConnection('bad-name;');
        $this->artisan('db:create-if-missing', ['--connection' => 'fake'])
            ->expectsOutputToContain("Invalid database name 'bad-name;'")->assertExitCode(1);
    }

    /**
     * @description The database is created only when missing, with utf8mb4_unicode_ci; an
     *   existing one is left alone; no connection and no privilege are reported (no password).
     * @input fake mysql `shop_db`: missing; exists; connection error; CREATE fails.
     * @output CREATE DATABASE `shop_db` … utf8mb4_unicode_ci, exit 0; "already exists", exit 0,
     *   nothing executed; exit 1 "Cannot connect …"; exit 1 "could not be created" + hosting hint.
     */
    public function test_create_database_creates_only_a_missing_database(): void
    {
        $this->fakeConnection('shop_db');
        $seen = null;
        $executed = [];
        $this->fakeServer(function (array $config) use (&$seen, &$executed) {
            $seen = $config;
            return $this->pdo(false, false, $executed);
        });
        $this->artisan('db:create-if-missing', ['--connection' => 'fake'])
            ->expectsOutput('Database shop_db created (utf8mb4_unicode_ci).')->assertExitCode(0);
        $this->assertSame(['CREATE DATABASE `shop_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'], $executed);
        $this->assertSame('shop_db', $seen['database']);

        $executed = [];
        $this->fakeServer(fn () => $this->pdo(true, false, $executed));
        $this->artisan('db:create-if-missing', ['--connection' => 'fake'])
            ->expectsOutput('Database shop_db already exists - left unchanged.')->assertExitCode(0);
        $this->assertSame([], $executed);

        $this->fakeServer(fn () => throw new PDOException('Connection refused'));
        $this->artisan('db:create-if-missing', ['--connection' => 'fake'])
            ->expectsOutput('Cannot connect to the database server: Connection refused')
            ->doesntExpectOutputToContain('p4ss')->assertExitCode(1);

        $this->fakeServer(fn () => $this->pdo(false, true));
        $this->artisan('db:create-if-missing', ['--connection' => 'fake'])
            ->expectsOutput('Database shop_db could not be created: Access denied to database')
            ->expectsOutputToContain('create the empty database in the hosting panel')->assertExitCode(1);
    }

    /**
     * @description The real server connection: an unreachable server is reported (TCP and unix
     *   socket settings both build a DSN).
     * @input fake mysql on 127.0.0.1:1 (nothing listens); the same with a unix socket path that does not exist.
     * @output exit 1 "Cannot connect to the database server: …" both times.
     */
    public function test_create_database_reports_an_unreachable_server(): void
    {
        config(['database.connections.fake' => ['driver' => 'mysql', 'host' => '127.0.0.1', 'port' => 1, 'database' => 'x', 'username' => 'u', 'password' => '']]);
        $this->artisan('db:create-if-missing', ['--connection' => 'fake'])
            ->expectsOutputToContain('Cannot connect to the database server:')->assertExitCode(1);

        config(['database.connections.fake.unix_socket' => '/nonexistent/mysql.sock']);
        $this->artisan('db:create-if-missing', ['--connection' => 'fake'])
            ->expectsOutputToContain('Cannot connect to the database server:')->assertExitCode(1);
    }

    /**
     * @description The first sysadmin: e-mail normalized and validated, name, password typed twice
     *   (hidden) and checked by the password policy; activated account with the sysadmin role, the
     *   e-mail allowed by the access policy, core log without the password.
     * @input role sysadmin; email ' Root@Firma.CZ '; name 'Jan'; passwords: 'short' (policy),
     *   'Valid1!x' + 'other' (mismatch), 'Valid1!x' twice.
     * @output exit 0; user root@firma.cz activated, not blocked, password verifies, role sysadmin;
     *   e-mail rule root@firma.cz; core log sysadmin_created without the password.
     */
    public function test_create_sysadmin(): void
    {
        $this->role('sysadmin');

        $this->artisan('security:create-sysadmin', ['email' => ' Root@Firma.CZ '])
            ->expectsQuestion('Full name', 'Jan')
            ->expectsQuestion('Password (8–16 characters, a letter, a digit and a symbol)', 'short')
            ->expectsQuestion('Password (8–16 characters, a letter, a digit and a symbol)', 'Valid1!x')
            ->expectsQuestion('Password again', 'other')
            ->expectsOutput('The passwords do not match.')
            ->expectsQuestion('Password (8–16 characters, a letter, a digit and a symbol)', 'Valid1!x')
            ->expectsQuestion('Password again', 'Valid1!x')
            ->expectsOutputToContain('Sysadmin root@firma.cz created and activated.')
            ->assertExitCode(0);

        $user = User::where('user_email', 'root@firma.cz')->firstOrFail();
        $this->assertSame('Jan', $user->full_name);
        $this->assertNotNull($user->activated_at);
        $this->assertFalse((bool) $user->is_blocked);
        $this->assertTrue(Hash::check('Valid1!x', $user->user_password_hash));
        $this->assertSame(['sysadmin'], $user->roles()->pluck('role_name')->all());
        $this->assertTrue(CoreEmailAccessRule::where('type', 'email')->where('value', 'root@firma.cz')->exists());
        $this->assertCoreLog('sysadmin_created', 'from the server console: root@firma.cz');
        $this->assertDatabaseMissing('core_logs', ['context_data' => json_encode(['password' => 'Valid1!x'])]);
    }

    /**
     * @description Refusals: no sysadmin role (seed first), invalid / taken e-mail, three invalid
     *   passwords; `--if-none` does nothing once a sysadmin exists; an existing e-mail rule is reused;
     *   an empty name falls back to the default.
     * @input no role; role + 'not-an-email'; existing e-mail; three bad passwords; --if-none with a
     *   sysadmin; asked e-mail + rule existing + empty name.
     * @output exit 1 seed hint; exit 1 validation texts; exit 1 "No valid password entered";
     *   exit 0 "nothing to do"; exit 0 with one rule and name 'System administrator'.
     */
    public function test_create_sysadmin_refusals(): void
    {
        $this->artisan('security:create-sysadmin', ['email' => 'a@b.cz'])
            ->expectsOutputToContain('run `php artisan db:seed --force` first')->assertExitCode(1);

        $this->role('sysadmin');
        $this->artisan('security:create-sysadmin', ['email' => 'not-an-email'])
            ->expectsOutputToContain('must be a valid email address')->assertExitCode(1);
        $this->user(['user_email' => 'taken@b.cz']);
        $this->artisan('security:create-sysadmin', ['email' => 'taken@b.cz'])
            ->expectsOutputToContain('has already been taken')->assertExitCode(1);

        $prompt = 'Password (8–16 characters, a letter, a digit and a symbol)';
        $this->artisan('security:create-sysadmin', ['email' => 'new@b.cz'])
            ->expectsQuestion('Full name', 'X')
            ->expectsQuestion($prompt, 'a')
            ->expectsQuestion($prompt, 'TooLongPassword1!x')
            ->expectsQuestion($prompt, 'nodigits!')
            ->expectsOutput('No valid password entered - account not created.')
            ->assertExitCode(1);
        $this->assertFalse(User::where('user_email', 'new@b.cz')->exists());

        CoreEmailAccessRule::create(['type' => 'email', 'value' => 'asked@b.cz']);
        $this->artisan('security:create-sysadmin')
            ->expectsQuestion('E-mail of the sysadmin account', 'asked@b.cz')
            ->expectsQuestion('Full name', '')
            ->expectsQuestion($prompt, 'Valid1!x')
            ->expectsQuestion('Password again', 'Valid1!x')
            ->assertExitCode(0);
        $this->assertSame('System administrator', User::where('user_email', 'asked@b.cz')->value('full_name'));
        $this->assertSame(1, CoreEmailAccessRule::where('value', 'asked@b.cz')->count());

        $this->artisan('security:create-sysadmin', ['--if-none' => true])
            ->expectsOutput('A sysadmin account exists already - nothing to do.')->assertExitCode(0);
    }

    /**
     * @description DevelopmentSeeder (local): test sysadmin with the known password, the test
     *   domain allowed, the test roles with permissions chosen from the existing keys.
     * @input APP_ENV local; role sysadmin; permissions of core / web / shop (view, create, update,
     *   delete, maintenance, tab permissions, administrators, security).
     * @output user sysadmin@sysadmin.sysadmin (activated, password 123456Ab., role sysadmin);
     *   domain rule sysadmin.sysadmin; six roles with exactly the expected keys.
     */
    public function test_development_seeder_creates_the_test_data(): void
    {
        $this->app['env'] = 'local';
        $this->role('sysadmin');
        $keys = [
            'view-core', 'view-web', 'view-eshop', 'core-view-welcome-page',
            'core-administrators-view', 'core-administrators-update', 'core-security-view', 'core-external-links-view',
            'core-external-links-create', 'web-news-view', 'web-news-create', 'web-news-update', 'web-news-delete',
            'web-view-dashboard', 'web-set-maintenance-mode', 'shop-products-view', 'shop-products-update', 'shop-products-delete',
        ];
        foreach ($keys as $key) {
            CorePermission::create(['permission_key' => $key, 'module' => 'core']);
        }

        $this->seed(DevelopmentSeeder::class);

        $user = User::where('user_email', DevelopmentSeeder::TEST_EMAIL)->firstOrFail();
        $this->assertNotNull($user->activated_at);
        $this->assertTrue(Hash::check('123456Ab.', $user->user_password_hash));
        $this->assertSame(['sysadmin'], $user->roles()->pluck('role_name')->all());
        $this->assertTrue(CoreEmailAccessRule::isEmailAllowed(DevelopmentSeeder::TEST_EMAIL)
            && CoreEmailAccessRule::where('type', 'domain')->where('value', 'sysadmin.sysadmin')->exists());

        $roleKeys = fn (string $name) => CoreRole::where('role_name', $name)->firstOrFail()->permissions()->pluck('permission_key')->sort()->values()->all();
        $this->assertSame(['core-administrators-view', 'core-external-links-view', 'core-security-view', 'core-view-welcome-page', 'view-core'], $roleKeys('read-only-core'));
        $this->assertSame(['view-web', 'web-news-view', 'web-view-dashboard'], $roleKeys('read-only-web'));
        $this->assertSame(['shop-products-view', 'view-eshop'], $roleKeys('read-only-shop'));
        $this->assertSame(['core-view-welcome-page', 'view-core', 'view-web', 'web-news-create', 'web-news-update', 'web-news-view', 'web-view-dashboard'], $roleKeys('editor-web'));
        $this->assertSame(['core-view-welcome-page', 'shop-products-update', 'shop-products-view', 'view-core', 'view-eshop'], $roleKeys('editor-shop'));
        $manager = $roleKeys('manager');
        $this->assertNotContains('core-administrators-view', $manager);
        $this->assertNotContains('core-security-view', $manager);
        $this->assertContains('web-news-delete', $manager);
        $this->assertStringContainsString('Test role (local development).', CoreRole::where('role_name', 'manager')->value('description'));
    }

    /**
     * @description Running it again changes nothing that exists: a changed password and an edited
     *   role stay; nothing is duplicated.
     * @input seeded once; password changed; manager permissions removed; seeded again.
     * @output password unchanged; manager still without permissions; one user, one domain rule, six roles + sysadmin.
     */
    public function test_development_seeder_never_overwrites(): void
    {
        $this->app['env'] = 'local';
        $this->role('sysadmin');
        CorePermission::create(['permission_key' => 'web-news-view', 'module' => 'web']);
        $this->seed(DevelopmentSeeder::class);

        User::where('user_email', DevelopmentSeeder::TEST_EMAIL)->update(['user_password_hash' => Hash::make('Changed1!')]);
        CoreRole::where('role_name', 'manager')->firstOrFail()->permissions()->sync([]);
        $this->seed(DevelopmentSeeder::class);

        $this->assertTrue(Hash::check('Changed1!', User::where('user_email', DevelopmentSeeder::TEST_EMAIL)->value('user_password_hash')));
        $this->assertSame(0, CoreRole::where('role_name', 'manager')->firstOrFail()->permissions()->count());
        $this->assertSame(1, User::where('user_email', DevelopmentSeeder::TEST_EMAIL)->count());
        $this->assertSame(1, CoreEmailAccessRule::where('value', 'sysadmin.sysadmin')->count());
        $this->assertSame(7, CoreRole::count());
    }

    /**
     * @description Outside APP_ENV=local the seeder refuses (an account with a known password).
     * @input APP_ENV production (testing default replaced); run DevelopmentSeeder.
     * @output RuntimeException; no test account.
     */
    public function test_development_seeder_is_local_only(): void
    {
        $this->app['env'] = 'production';
        try {
            (new DevelopmentSeeder())->run();
            $this->fail('expected RuntimeException');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('APP_ENV=local', $e->getMessage());
        }
        $this->assertFalse(User::where('user_email', DevelopmentSeeder::TEST_EMAIL)->exists());
    }

    /**
     * @description Base data of every installation: all permission keys, the sysadmin role with
     *   all of them, the page titles, document types and the web / e-shop settings rows.
     * @input empty database (test schema); BaseDataSeeder.
     * @output permissions = data/permissions.php (96 keys incl. view-core, core-administrators-view);
     *   sysadmin with every permission and protected; 23 titles incl. web.not-found and
     *   admin.panel; types gdpr / tos / cookies; web + shop active; no account.
     */
    public function test_base_data_seeder(): void
    {
        $this->seed(BaseDataSeeder::class);

        $expected = array_column(require database_path('seeders/data/permissions.php'), 'permission_key');
        $this->assertCount(96, $expected);
        $this->assertEqualsCanonicalizing($expected, CorePermission::pluck('permission_key')->all());
        $sysadmin = CoreRole::where('role_name', 'sysadmin')->firstOrFail();
        $this->assertTrue($sysadmin->isProtected());
        $this->assertSame(96, $sysadmin->permissions()->count());
        $this->assertSame(23, DB::table('legal_page_titles')->count());
        $this->assertTrue(DB::table('legal_page_titles')->where(['area' => 'web', 'page_key' => 'not-found'])->exists());
        $this->assertTrue(DB::table('legal_page_titles')->where(['area' => 'admin', 'page_key' => 'panel'])->exists());
        $this->assertEqualsCanonicalizing(['gdpr', 'tos', 'cookies'], DocumentType::pluck('slug')->all());
        $this->assertTrue(WebSiteSetting::firstOrFail()->is_web_active);
        $this->assertSame('Your request has been accepted', WebSiteSetting::firstOrFail()->raw_request_email_title_i18n['en']);
        $this->assertTrue(ShopSiteSetting::firstOrFail()->is_shop_active);
        $this->assertSame(0, User::count());
    }

    /**
     * @description Running it again only adds: edited texts / settings stay, a deleted sysadmin role
     *   is restored, a new permission key goes to the sysadmin role, nothing is duplicated.
     * @input seeded; title + permission description + shop setting edited; sysadmin soft-deleted;
     *   one permission row removed; seeded again.
     * @output edits kept; role restored with 96 permissions; 96 permissions, 23 titles, 1 settings row each.
     */
    public function test_base_data_seeder_only_adds(): void
    {
        $this->seed(BaseDataSeeder::class);
        DB::table('legal_page_titles')->where(['area' => 'web', 'page_key' => 'home'])->update(['title_i18n' => '{"cz":"Můj titulek"}']);
        CorePermission::where('permission_key', 'view-core')->update(['description' => 'edited']);
        ShopSiteSetting::firstOrFail()->update(['is_shop_active' => false]);
        CoreRole::where('role_name', 'sysadmin')->firstOrFail()->delete();
        CorePermission::where('permission_key', 'web-news-delete')->delete();

        $this->seed(BaseDataSeeder::class);

        $this->assertSame('{"cz":"Můj titulek"}', DB::table('legal_page_titles')->where(['area' => 'web', 'page_key' => 'home'])->value('title_i18n'));
        $this->assertSame('edited', CorePermission::where('permission_key', 'view-core')->value('description'));
        $this->assertFalse(ShopSiteSetting::firstOrFail()->is_shop_active);
        $role = CoreRole::where('role_name', 'sysadmin')->firstOrFail();
        $this->assertSame(96, $role->permissions()->count());
        $this->assertSame(96, CorePermission::count());
        $this->assertSame(23, DB::table('legal_page_titles')->count());
        $this->assertSame(1, WebSiteSetting::count());
        $this->assertSame(1, ShopSiteSetting::count());
    }

    /**
     * @description db:seed: base data always, the test account and roles only with APP_ENV=local.
     * @input DatabaseSeeder with APP_ENV production; then with APP_ENV local.
     * @output production: sysadmin role, no account, no test role; local: test account + 6 test roles.
     */
    public function test_database_seeder_adds_development_data_only_locally(): void
    {
        $this->app['env'] = 'production';
        // --force: db:seed asks for a confirmation in production (as on the server).
        $this->artisan('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true])->assertExitCode(0);
        $this->assertTrue(CoreRole::where('role_name', 'sysadmin')->exists());
        $this->assertSame(0, User::count());
        $this->assertSame(1, CoreRole::count());

        $this->app['env'] = 'local';
        $this->seed(DatabaseSeeder::class);
        $this->assertTrue(User::where('user_email', DevelopmentSeeder::TEST_EMAIL)->exists());
        $this->assertSame(7, CoreRole::count());
    }
}
