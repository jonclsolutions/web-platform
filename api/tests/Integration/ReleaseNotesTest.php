<?php

/**
 * @file ReleaseNotesTest.php
 * @path api/tests/Integration/ReleaseNotesTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Integration tests of the release notes endpoints (CoreReleaseController): the
 *   admin gets the core and the applications of the user up to the running version, the public
 *   endpoint answers only for an application that publishes its changelog.
 * @dependencies
 * - Tests\TestCase (InteractsWithAccounts); a temporary changelog bound to the container.
 */

namespace Tests\Integration;

use App\Support\Changelog\Changelog;
use Tests\TestCase;

/**
 * @description GET /api/core/releases, GET /api/public/releases/{app}.
 */
class ReleaseNotesTest extends TestCase
{
    /** @var string Temporary changelog file. */
    private string $file;

    protected function setUp(): void
    {
        parent::setUp();
        $this->file = (string) tempnam(sys_get_temp_dir(), 'changelog');
        $change = fn (string $area, string $part) => ['type' => 'fixed', 'area' => $area, 'part' => $part, 'text' => "{$area} {$part}"];
        file_put_contents($this->file, json_encode(['unreleased' => [$change('core', 'admin')], 'releases' => [
            ['version' => 'v2', 'date' => '2026-02-01', 'changes' => [$change('shop', 'admin')]],
            ['version' => 'v1', 'date' => '2026-01-01', 'changes' => [$change('core', 'admin'), $change('web', 'public')]],
        ]]));
        $this->app->instance(Changelog::class, new Changelog($this->file));
    }

    protected function tearDown(): void
    {
        @unlink($this->file);
        parent::tearDown();
    }

    /**
     * @description Sign-in needed; a user sees the core and his applications only, up to the
     *   running version, never the unreleased changes; the sysadmin sees every application.
     * @input Guest; user with view-web at v2; sysadmin at v2; sysadmin at v1.
     * @output 401; [v1] with core + web; [v2, v1]; [v1].
     */
    public function test_admin_release_notes(): void
    {
        $this->getJson('/api/core/releases')->assertStatus(401);
        config(['app.version' => 'v2']);

        $this->signIn($this->userWith(['view-web']));
        $data = $this->getJson('/api/core/releases')->assertOk()->json('data');
        $this->assertSame('v2', $data['current']);
        $this->assertSame(['v1'], array_column($data['releases'], 'version'));
        $this->assertSame(['core', 'web'], array_column($data['releases'][0]['changes'], 'area'));

        $this->signIn($this->sysadmin());
        $this->assertSame(['v2', 'v1'], array_column($this->getJson('/api/core/releases')->json('data.releases'), 'version'));

        config(['app.version' => 'v1']);
        $this->assertSame(['v1'], array_column($this->getJson('/api/core/releases')->json('data.releases'), 'version'));
    }

    /**
     * @description A broken changelog file does not break the admin: empty list, logged.
     * @input The file replaced with '{'.
     * @output 200 with releases [].
     */
    public function test_broken_changelog_gives_empty_list(): void
    {
        file_put_contents($this->file, '{');
        $this->signIn($this->sysadmin());
        $this->assertSame([], $this->getJson('/api/core/releases')->assertOk()->json('data.releases'));
    }

    /**
     * @description The public endpoint: none of the installed applications publishes its notes;
     *   an unknown application is 404 as well.
     * @input GET public/releases/web, /shop, /project-portal, /nothing.
     * @output 404 each time.
     */
    public function test_public_release_notes_are_off_by_default(): void
    {
        foreach (['web', 'shop', 'project-portal', 'nothing'] as $app) {
            $this->getJson("/api/public/releases/{$app}")->assertNotFound();
        }
    }
}
