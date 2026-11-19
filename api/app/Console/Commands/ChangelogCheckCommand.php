<?php

/**
 * @file ChangelogCheckCommand.php
 * @path app/Console/Commands/ChangelogCheckCommand.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description `php artisan changelog:check [--release=v2026.11.2]` - validates the changelog
 * (api/resources/changelog/changelog.json, App\Support\Changelog\Changelog). With --release it
 * also requires the section of that version and an empty `unreleased` - the release workflow runs
 * it before building the images of a tag, so no release goes out without its notes.
 * @return int 0 = valid, 1 = problems (listed).
 */

namespace App\Console\Commands;

use App\Support\Changelog\Changelog;
use Illuminate\Console\Command;

class ChangelogCheckCommand extends Command
{
    /** @var string */
    protected $signature = 'changelog:check {--release= : The tag that is being released}';

    /** @var string */
    protected $description = 'Validates the changelog (with --release: the version has its section).';

    /**
     * @description Runs the check.
     * @param Changelog $changelog
     * @return int
     */
    public function handle(Changelog $changelog): int
    {
        $problems = $changelog->problems();
        $version = (string) $this->option('release');
        if ($version !== '' && $problems === []) {
            $data = $changelog->read();
            if (!in_array($version, array_column($data['releases'], 'version'), true)) {
                $problems[] = "{$version} has no section in the changelog - release with deploy/release.sh {$version} (it moves \"unreleased\" under the version before the tag).";
            }
            if ($data['unreleased'] !== []) {
                $problems[] = '"unreleased" is not empty - these changes would be deployed without being listed.';
            }
        }
        foreach ($problems as $problem) {
            $this->error($problem);
        }
        if ($problems === []) {
            $this->info('Changelog OK' . ($version !== '' ? " - {$version} has its notes." : '.'));
        }

        return $problems === [] ? self::SUCCESS : self::FAILURE;
    }
}
