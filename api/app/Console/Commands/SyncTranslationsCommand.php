<?php

/**
 * @file SyncTranslationsCommand.php
 * @path app/Console/Commands/SyncTranslationsCommand.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Brings the base translations of a release (the seed - `resources/translations` of
 * the repository, read-only, part of the code) into the translations of the installation
 * (`storage/app/public/translations` - runtime data, edited in the admin, not in git) without
 * losing the texts edited in the admin. Run by deploy/docker/api-entrypoint.sh at the start of
 * the `app` container of every release and by init-workspace.sh / dev.sh before the migrations
 * of a local installation (a change of the seed in a patch then never collides with the texts
 * edited in the local admin).
 *   - `<module>/<lang>.json`: three-way merge (TranslationSeedMerger) against the seed applied by
 *     the previous sync (kept in storage/app/private/translation-seed) - new keys are added, texts
 *     nobody edited follow the release, edited texts stay, keys removed by the release disappear
 *     unless they were edited. A file missing on the server is copied.
 *   - other JSON files (languages.json - languages edited in the admin): copied only when missing.
 *   - anything else (README.md - the developer guide of the folder): ignored, never shipped.
 * Languages added in the admin (e.g. de.json, not in the seed) keep their texts; only the keys the
 * Czech texts of the server no longer have are removed from them (the application does not use
 * them). Their new keys are not added - the editor compares with Czech and shows them as missing.
 * @usage php artisan translations:sync [--seed=<folder, default resources/translations>] [--dry-run]
 * @note The first sync on a server has no previous seed: it only adds the missing keys (it cannot
 * tell an edited text from an old one). From then on texts are updated and removed too.
 * @note A file of the server that is not valid JSON is left as it is (warning) and its previous
 * seed is kept, so the next sync still knows what changed.
 * @dependencies TranslationSeedMerger
 */

namespace App\Console\Commands;

use App\Support\I18n\TranslationSeedMerger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class SyncTranslationsCommand extends Command
{
    /** @description Seed folder, relative to the application root (resources/ - code, never written). */
    public const SEED = 'resources/translations';

    /** @description Translations of the server, relative to the storage folder. */
    public const TARGET = 'app/public/translations';

    /** @description Copy of the seed applied by the last sync (private - never served). */
    public const APPLIED = 'app/private/translation-seed';

    /** @description Language every other language of a module is compared with (the editor does the same). */
    private const REFERENCE_LANG = 'cz';

    /** @description A merged file: `<module>/<lang>.json` (same patterns as TranslationController). */
    private const MERGED_FILE = '#^[a-z][a-z0-9_-]{0,31}/[a-zA-Z]{2}(?:[-_][a-zA-Z0-9]{2,3})?\.json$#';

    /**
     * @description Name and signature of the Artisan command.
     * @var string
     */
    protected $signature = 'translations:sync
        {--seed= : Folder of the base translations of this release (default: resources/translations)}
        {--dry-run : Only report, change nothing}';

    /**
     * @description Short description shown by `php artisan list`.
     * @var string
     */
    protected $description = 'Adds the new and updated base translations of the release, keeps the texts edited in the admin.';

    /**
     * @description Absolute path of the seed of the release.
     * @return string
     */
    public static function defaultSeed(): string
    {
        return base_path(self::SEED);
    }

    /**
     * @description Synchronises every file of the seed.
     * @return int Exit code (0 = success, 1 = a seed file is not valid JSON).
     */
    public function handle(): int
    {
        $seedDir = rtrim((string) ($this->option('seed') ?: self::defaultSeed()), '/');
        if (!File::isDirectory($seedDir)) {
            $this->warn("No base translations in {$seedDir} - nothing to synchronise.");
            return self::SUCCESS;
        }

        $dryRun = (bool) $this->option('dry-run');
        $failed = false;
        $summary = [];

        foreach (File::allFiles($seedDir) as $file) {
            $relative = str_replace('\\', '/', $file->getRelativePathname());
            if (!str_ends_with($relative, '.json')) {
                continue;
            }
            $result = preg_match(self::MERGED_FILE, $relative)
                ? $this->mergeFile($file->getPathname(), $relative, $dryRun)
                : $this->copyIfMissing($file->getPathname(), $relative, $dryRun);

            if ($result === null) {
                $failed = true;
                continue;
            }
            if ($result !== '') {
                $summary[$relative] = $result;
                $this->line(($dryRun ? '[dry run] ' : '') . "translations {$relative}: {$result}");
            }
        }

        foreach ($this->clientLanguages($seedDir) as $relative => $reference) {
            $result = $this->pruneFile($relative, $reference, $dryRun);
            if ($result !== '') {
                $summary[$relative] = $result;
                $this->line(($dryRun ? '[dry run] ' : '') . "translations {$relative}: {$result}");
            }
        }

        if (!$dryRun && $summary !== []) {
            Log::info('Base translations synchronised', $summary);
        }
        if ($summary === [] && !$failed) {
            $this->line('translations: up to date');
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @description Merges one `<module>/<lang>.json` of the seed into the server copy.
     * @param string $seedPath Absolute path of the seed file.
     * @param string $relative Path relative to the translations folder.
     * @param bool $dryRun Change nothing.
     * @return string|null Summary ('' = nothing changed), null = the seed file is not valid JSON.
     */
    private function mergeFile(string $seedPath, string $relative, bool $dryRun): ?string
    {
        $seed = $this->readJson($seedPath);
        if ($seed === null) {
            $this->error("translations {$relative}: the base file of the release is not valid JSON - skipped");
            return null;
        }

        $target = storage_path(self::TARGET . '/' . $relative);
        $applied = storage_path(self::APPLIED . '/' . $relative);

        if (!File::exists($target)) {
            if (!$dryRun) {
                $this->writeFile($target, File::get($seedPath));
                $this->writeFile($applied, File::get($seedPath));
            }
            return 'created';
        }

        $current = $this->readJson($target);
        if ($current === null) {
            $this->warn("translations {$relative}: the file on the server is not valid JSON - left as it is");
            return '';
        }

        $base = File::exists($applied) ? $this->readJson($applied) : null;
        $merge = TranslationSeedMerger::merge($current, $seed, $base);
        $changed = $merge['added'] + $merge['updated'] + $merge['removed'] > 0;

        if (!$dryRun) {
            if ($changed) {
                $this->writeFile($target, $this->encode($merge['data']));
            }
            $this->writeFile($applied, File::get($seedPath));
        }

        if (!$changed) {
            return '';
        }

        return sprintf(
            '%d added, %d updated, %d removed, %d kept as edited in the admin',
            $merge['added'],
            $merge['updated'],
            $merge['removed'],
            $merge['kept']
        );
    }

    /**
     * @description Languages of the server that are not part of the release, per module of the seed,
     *   with the Czech texts of the server they are compared with. A module whose Czech file is
     *   missing or not valid JSON is skipped. In a dry run the Czech texts are merged in memory.
     * @param string $seedDir Seed folder.
     * @return array<string, array<string, mixed>> `<module>/<lang>.json` => Czech texts.
     */
    private function clientLanguages(string $seedDir): array
    {
        $languages = [];

        foreach (File::directories($seedDir) as $moduleDir) {
            $module = basename($moduleDir);
            $reference = $this->referenceTexts($seedDir, $module);
            if ($reference === null) {
                continue;
            }
            foreach (File::glob(storage_path(self::TARGET . '/' . $module . '/*.json')) as $path) {
                $relative = $module . '/' . basename($path);
                if (preg_match(self::MERGED_FILE, $relative) && !File::exists($moduleDir . '/' . basename($path))) {
                    $languages[$relative] = $reference;
                }
            }
        }

        return $languages;
    }

    /**
     * @description Czech texts of a module on the server after this sync.
     * @param string $seedDir Seed folder.
     * @param string $module Module.
     * @return array<string, mixed>|null Null when they cannot be read.
     */
    private function referenceTexts(string $seedDir, string $module): ?array
    {
        $relative = $module . '/' . self::REFERENCE_LANG . '.json';
        $target = storage_path(self::TARGET . '/' . $relative);
        $seedPath = $seedDir . '/' . $relative;

        if (!$this->option('dry-run')) {
            return File::exists($target) ? $this->readJson($target) : null;
        }

        // Dry run: the Czech file was not written - merge it in memory the same way.
        $seed = File::exists($seedPath) ? $this->readJson($seedPath) : null;
        if (!File::exists($target)) {
            return $seed;
        }
        $current = $this->readJson($target);
        if ($current === null || $seed === null) {
            return $current;
        }
        $applied = storage_path(self::APPLIED . '/' . $relative);

        return TranslationSeedMerger::merge($current, $seed, File::exists($applied) ? $this->readJson($applied) : null)['data'];
    }

    /**
     * @description Removes from a language of the client the keys the Czech texts no longer have.
     * @param string $relative `<module>/<lang>.json`.
     * @param array<string, mixed> $reference Czech texts of the module.
     * @param bool $dryRun Change nothing.
     * @return string Summary ('' = nothing removed or the file is not valid JSON).
     */
    private function pruneFile(string $relative, array $reference, bool $dryRun): string
    {
        $target = storage_path(self::TARGET . '/' . $relative);
        $current = $this->readJson($target);
        if ($current === null) {
            $this->warn("translations {$relative}: the file on the server is not valid JSON - left as it is");
            return '';
        }

        $prune = TranslationSeedMerger::prune($current, $reference);
        if ($prune['removed'] === 0) {
            return '';
        }
        if (!$dryRun) {
            $this->writeFile($target, $this->encode($prune['data']));
        }

        return "{$prune['removed']} removed (no longer in Czech)";
    }

    /**
     * @description Copies a seed file the server does not have yet (languages.json, …).
     * @param string $seedPath Absolute path of the seed file.
     * @param string $relative Path relative to the translations folder.
     * @param bool $dryRun Change nothing.
     * @return string Summary ('' = the file exists, left as it is).
     */
    private function copyIfMissing(string $seedPath, string $relative, bool $dryRun): string
    {
        $target = storage_path(self::TARGET . '/' . $relative);
        if (File::exists($target)) {
            return '';
        }
        if (!$dryRun) {
            $this->writeFile($target, File::get($seedPath));
        }

        return 'created';
    }

    /**
     * @description Decodes a JSON object file.
     * @param string $path Absolute path.
     * @return array<string, mixed>|null Decoded object, null when it is not a valid JSON object.
     */
    private function readJson(string $path): ?array
    {
        $data = json_decode((string) File::get($path), true);

        return is_array($data) && ($data === [] || !array_is_list($data)) ? $data : null;
    }

    /**
     * @description Encodes the texts the way the admin saves them (TranslationController::save()).
     * @param array<string, mixed> $data Texts.
     * @return string
     */
    private function encode(array $data): string
    {
        return (string) json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    /**
     * @description Writes a file atomically (temporary file + rename in the same folder), so the
     *   API never reads a half-written translation file.
     * @param string $path Absolute path.
     * @param string $content Content.
     * @return void
     */
    private function writeFile(string $path, string $content): void
    {
        File::ensureDirectoryExists(dirname($path), 0755);
        $temporary = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
        File::put($temporary, $content);
        File::move($temporary, $path);
    }
}
