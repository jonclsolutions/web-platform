<?php

/**
 * @file ChangelogTest.php
 * @path api/tests/Unit/Core/ChangelogTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the changelog (App\Support\Changelog\Changelog and the commands
 *   changelog:check / changelog:release / changelog:notes) on a temporary file, plus the check of
 *   the real file of the repository.
 * @dependencies
 * - Tests\TestCase (AppRegistry with the web, the e-shop and the project portal).
 */

namespace Tests\Unit\Core;

use App\Support\Changelog\Changelog;
use Tests\TestCase;

/**
 * @description App\Support\Changelog\Changelog.
 */
class ChangelogTest extends TestCase
{
    /** @var string Temporary changelog file. */
    private string $file;

    protected function setUp(): void
    {
        parent::setUp();
        $this->file = (string) tempnam(sys_get_temp_dir(), 'changelog');
        $this->app->instance(Changelog::class, new Changelog($this->file));
    }

    protected function tearDown(): void
    {
        @unlink($this->file);
        parent::tearDown();
    }

    /**
     * @description Writes the temporary changelog.
     * @param array<string, mixed> $data
     * @return Changelog
     */
    private function write(array $data): Changelog
    {
        file_put_contents($this->file, json_encode($data));

        return new Changelog($this->file);
    }

    /**
     * @description One change.
     * @param string $area
     * @param string $part
     * @param string $type
     * @return array<string, string>
     */
    private function change(string $area = 'core', string $part = 'admin', string $type = 'fixed'): array
    {
        return ['type' => $type, 'area' => $area, 'part' => $part, 'text' => "{$type} {$area} {$part}"];
    }

    /**
     * @description The changelog of the repository is valid (every release ships it).
     * @input api/resources/changelog/changelog.json.
     * @output No problem.
     */
    public function test_repository_changelog_is_valid(): void
    {
        $this->assertSame([], (new Changelog())->problems());
    }

    /**
     * @description Problems of a broken file are listed: unknown type / area / part, empty text,
     *   bad ref, bad version, duplicate version, bad date, wrong order, release without changes;
     *   a missing file and invalid JSON.
     * @input A file with each mistake; a missing file; '{'.
     * @output The matching messages.
     */
    public function test_problems(): void
    {
        $problems = $this->write([
            'unreleased' => [['type' => 'new', 'area' => 'blog', 'part' => 'x', 'text' => '', 'ref' => '57']],
            'releases' => [
                ['version' => '2026.1', 'date' => '2026-01-01', 'changes' => [$this->change()]],
                ['version' => 'v2', 'date' => '2026-02-01', 'changes' => [$this->change()]],
                ['version' => 'v2', 'date' => 'x', 'changes' => []],
            ],
        ])->problems();
        $text = implode("\n", $problems);
        foreach (['type must be', 'area must be', 'part must be', 'text must be', 'ref must look', 'version must look', 'newest first', 'listed twice', 'date must be', 'no changes'] as $expected) {
            $this->assertStringContainsString($expected, $text);
        }

        unlink($this->file);
        $this->assertStringContainsString('does not exist', (new Changelog($this->file))->problems()[0]);
        file_put_contents($this->file, '{');
        $this->assertStringContainsString('not valid JSON', (new Changelog($this->file))->problems()[0]);
    }

    /**
     * @description A release moves `unreleased` under the version at the top; the same version,
     *   an empty `unreleased` or a bad version is refused. changelog:check --release requires
     *   the section and an empty `unreleased`.
     * @input unreleased with 2 changes; changelog:release v2 --date=2026-02-01; v2 again; v3; "bad".
     * @output check v2 fails before, passes after; releases [v2, v1], unreleased []; exit 1 for the
     *   refusals; check v9 fails; v3 with --note contains just the note.
     */
    public function test_release(): void
    {
        $this->write(['unreleased' => [$this->change(), $this->change('web', 'public')], 'releases' => [
            ['version' => 'v1', 'date' => '2026-01-01', 'changes' => [$this->change()]],
        ]]);

        $this->artisan('changelog:check', ['--release' => 'v2'])->assertExitCode(1);
        $this->artisan('changelog:release', ['version' => 'v2', '--date' => '2026-02-01'])->expectsOutputToContain('2 change(s) released as v2')->assertExitCode(0);
        $data = json_decode((string) file_get_contents($this->file), true);
        $this->assertSame(['v2', 'v1'], array_column($data['releases'], 'version'));
        $this->assertSame('2026-02-01', $data['releases'][0]['date']);
        $this->assertSame([], $data['unreleased']);

        $this->artisan('changelog:release', ['version' => 'v2'])->expectsOutputToContain('released already')->assertExitCode(1);
        $this->artisan('changelog:release', ['version' => 'v3'])->expectsOutputToContain('Nothing to release')->assertExitCode(1);
        $this->artisan('changelog:release', ['version' => 'bad'])->assertExitCode(1);
        $this->artisan('changelog:check', ['--release' => 'v2'])->assertExitCode(0);
        $this->artisan('changelog:check', ['--release' => 'v9'])->expectsOutputToContain('has no section')->assertExitCode(1);

        // A note makes a release possible without unreleased changes (first release of an installation).
        $this->artisan('changelog:release', ['version' => 'v3', '--date' => '2026-03-01', '--note' => 'First release of acme.cz'])->assertExitCode(0);
        $data = json_decode((string) file_get_contents($this->file), true);
        $this->assertSame([['type' => 'added', 'area' => 'core', 'part' => 'admin', 'text' => 'First release of acme.cz']], $data['releases'][0]['changes']);
    }

    /**
     * @description Releases for a reader: up to the running version, only the given areas / part,
     *   releases without such a change left out, security first; an unknown running version
     *   (development) shows all. Notes of one release in Markdown.
     * @input v3 (web public), v2 (core admin fixed + core admin security #5), v1 (shop admin).
     * @output core up to v2: [v2], security first; web public: [v3]; dev: all three; notes v2:
     *   "### Security" before "### Fixed"; notes v9: null, the command exits 1.
     */
    public function test_releases_for_and_notes(): void
    {
        $log = $this->write(['unreleased' => [], 'releases' => [
            ['version' => 'v3', 'date' => '2026-03-01', 'changes' => [$this->change('web', 'public')]],
            ['version' => 'v2', 'date' => '2026-02-01', 'changes' => [$this->change(), $this->change('core', 'admin', 'security') + ['ref' => '#5']]],
            ['version' => 'v1', 'date' => '2026-01-01', 'changes' => [$this->change('shop')]],
        ]]);

        $core = $log->releasesFor(['core'], null, 'v2');
        $this->assertSame(['v2'], array_column($core, 'version'));
        $this->assertSame(['security', 'fixed'], array_column($core[0]['changes'], 'type'));
        $this->assertSame('#5', $core[0]['changes'][0]['ref']);
        $this->assertSame(['v3'], array_column($log->releasesFor(['web'], 'public', 'v3'), 'version'));
        $this->assertSame([], $log->releasesFor(['web'], 'admin', 'v3'));
        $this->assertSame(['v3', 'v2', 'v1'], array_column($log->releasesFor(['core', 'web', 'shop'], null, 'dev'), 'version'));

        $notes = (string) $log->notes('v2');
        $this->assertLessThan(strpos($notes, '### Fixed'), strpos($notes, '### Security'));
        $this->assertStringContainsString('- **core / admin**: security core admin (#5)', $notes);
        $this->assertNull($log->notes('v9'));
        $this->artisan('changelog:notes', ['version' => 'v9'])->assertExitCode(1);
    }
}
