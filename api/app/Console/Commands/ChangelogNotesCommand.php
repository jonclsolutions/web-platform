<?php

/**
 * @file ChangelogNotesCommand.php
 * @path app/Console/Commands/ChangelogNotesCommand.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description `php artisan changelog:notes v2026.11.2` - prints the notes of a release as
 * Markdown (deploy/release.sh shows them; the release workflow makes the GitHub Release from them).
 * @return int 0 = printed, 1 = the version is not in the changelog.
 */

namespace App\Console\Commands;

use App\Support\Changelog\Changelog;
use Illuminate\Console\Command;

class ChangelogNotesCommand extends Command
{
    /** @var string */
    protected $signature = 'changelog:notes {version : A released version}';

    /** @var string */
    protected $description = 'Prints the notes of a release as Markdown.';

    /**
     * @description Prints the notes.
     * @param Changelog $changelog
     * @return int
     */
    public function handle(Changelog $changelog): int
    {
        $version = (string) $this->argument('version');
        $notes = $changelog->notes($version);
        if ($notes === null) {
            $this->error("{$version} is not in the changelog.");

            return self::FAILURE;
        }
        $this->line($notes);

        return self::SUCCESS;
    }
}
