<?php

/**
 * @file ChangelogReleaseCommand.php
 * @path app/Console/Commands/ChangelogReleaseCommand.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description `php artisan changelog:release v2026.11.2` - moves the `unreleased` changes of the
 * changelog under the new version, dated today (App\Support\Changelog\Changelog::release()).
 * Called by deploy/release.sh right before it commits and tags the release.
 * @return int 0 = moved, 1 = refused (invalid version / file, released already, nothing to release).
 */

namespace App\Console\Commands;

use App\Support\Changelog\Changelog;
use Illuminate\Console\Command;
use RuntimeException;

class ChangelogReleaseCommand extends Command
{
    /** @var string */
    protected $signature = 'changelog:release {version : The new tag, e.g. v2026.11.2} {--date= : Date of the release (default today)} {--note= : A change of the core added to the release (e.g. its first release)}';

    /** @var string */
    protected $description = 'Moves the unreleased changes of the changelog under a new version.';

    /**
     * @description Runs the move.
     * @param Changelog $changelog
     * @return int
     */
    public function handle(Changelog $changelog): int
    {
        $version = (string) $this->argument('version');
        try {
            $note = $this->option('note');
            $count = $changelog->release($version, (string) ($this->option('date') ?: now()->toDateString()), is_string($note) ? $note : null);
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
        $this->info("{$count} change(s) released as {$version}.");

        return self::SUCCESS;
    }
}
