<?php

/**
 * @file Changelog.php
 * @path app/Support/Changelog/Changelog.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The changelog of the platform - ONE file, api/resources/changelog/changelog.json,
 * written together with every change and shipped in the image of every release:
 *   { "unreleased": [change, …], "releases": [{ "version", "date", "changes": [change, …] }, …] }
 *   change = { "type": security|added|changed|fixed|removed, "area": core|<application id>,
 *              "part": admin|public, "text": "…", "ref": "#57" (optional) }
 * Releases are newest first. `deploy/release.sh <tag>` moves `unreleased` under the new version
 * (changelog:release) before the tag; the release workflow refuses a tag without its section
 * (changelog:check --release).
 * Read by: the admin (GET core/releases - every admin, the areas of the user's applications),
 * optionally the public part of an application (GET public/releases/{app} when its manifest
 * enables publicChangelog()), the GitHub Release notes (changelog:notes).
 * @note English only - the readers are administrators, the texts are short and technical.
 * @dependencies AppRegistry (valid areas = core + the registered applications).
 */

namespace App\Support\Changelog;

use App\Support\Apps\AppManifest;
use App\Support\Apps\AppRegistry;
use JsonException;
use RuntimeException;

class Changelog
{
    /** @description Area of the core (administration, sign-in, legal pages …). */
    public const CORE = 'core';

    /** @description Allowed types of a change, in the order of the notes. */
    public const TYPES = ['security', 'added', 'changed', 'fixed', 'removed'];

    /** @description Allowed parts of an area. */
    public const PARTS = ['admin', 'public'];

    /** @description Format of a release version (= the git tag). */
    public const VERSION_PATTERN = '/^v[0-9A-Za-z][0-9A-Za-z._-]{0,62}$/';

    /**
     * @param string|null $path File of the changelog (default api/resources/changelog/changelog.json).
     */
    public function __construct(private ?string $path = null)
    {
        $this->path ??= resource_path('changelog/changelog.json');
    }

    /**
     * @description The file as an array (unvalidated).
     * @return array{unreleased: array<int, mixed>, releases: array<int, mixed>}
     * @throws RuntimeException When the file is missing or not JSON.
     */
    public function read(): array
    {
        if (!is_file($this->path)) {
            throw new RuntimeException("Changelog {$this->path} does not exist.");
        }
        try {
            $data = json_decode((string) file_get_contents($this->path), true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException('Changelog is not valid JSON: ' . $e->getMessage());
        }

        return [
            'unreleased' => is_array($data['unreleased'] ?? null) ? $data['unreleased'] : [],
            'releases'   => is_array($data['releases'] ?? null) ? $data['releases'] : [],
        ];
    }

    /**
     * @description Problems of the file (empty = valid): every change complete and known, versions
     *   valid and unique, dates Y-m-d, releases newest first and not empty.
     * @return list<string>
     */
    public function problems(): array
    {
        try {
            $data = $this->read();
        } catch (RuntimeException $e) {
            return [$e->getMessage()];
        }
        $areas = $this->areas();
        $problems = [];
        $check = function (mixed $change, string $where) use ($areas, &$problems): void {
            $change = is_array($change) ? $change : [];
            foreach (['type' => self::TYPES, 'area' => $areas, 'part' => self::PARTS] as $field => $allowed) {
                if (!in_array($change[$field] ?? null, $allowed, true)) {
                    $problems[] = "{$where}: {$field} must be one of " . implode(', ', $allowed);
                }
            }
            $text = $change['text'] ?? null;
            if (!is_string($text) || trim($text) === '' || mb_strlen($text) > 300) {
                $problems[] = "{$where}: text must be 1-300 characters";
            }
            if (isset($change['ref']) && !preg_match('/^#\d{1,6}$/', (string) $change['ref'])) {
                $problems[] = "{$where}: ref must look like #57";
            }
        };

        foreach ($data['unreleased'] as $i => $change) {
            $check($change, "unreleased[{$i}]");
        }
        $seen = [];
        $previousDate = null;
        foreach ($data['releases'] as $i => $release) {
            $release = is_array($release) ? $release : [];
            $version = (string) ($release['version'] ?? '');
            $where = "releases[{$i}] {$version}";
            if (!preg_match(self::VERSION_PATTERN, $version)) {
                $problems[] = "{$where}: version must look like v2026.11.2";
            }
            if (isset($seen[$version])) {
                $problems[] = "{$where}: version listed twice";
            }
            $seen[$version] = true;
            $date = (string) ($release['date'] ?? '');
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                $problems[] = "{$where}: date must be YYYY-MM-DD";
            } elseif ($previousDate !== null && $date > $previousDate) {
                $problems[] = "{$where}: releases must be newest first";
            }
            $previousDate = $date !== '' ? $date : $previousDate;
            $changes = $release['changes'] ?? null;
            if (!is_array($changes) || $changes === []) {
                $problems[] = "{$where}: no changes";
                continue;
            }
            foreach ($changes as $j => $change) {
                $check($change, "{$where} changes[{$j}]");
            }
        }

        return $problems;
    }

    /**
     * @description Moves `unreleased` under a new version at the top of `releases` and writes the
     *   file (pretty JSON, 4 spaces, unescaped unicode and slashes, final newline).
     * @param string $version New version (the tag).
     * @param string $date Date of the release (Y-m-d).
     * @param string|null $note Optional change added first (type added, area core, part admin) -
     *   e.g. "First release of example.com" of provision.sh, when nothing else is unreleased.
     * @return int Number of moved changes.
     * @throws RuntimeException Invalid version or file, version released already, nothing to release.
     */
    public function release(string $version, string $date, ?string $note = null): int
    {
        if (!preg_match(self::VERSION_PATTERN, $version)) {
            throw new RuntimeException("Version {$version} must look like v2026.11.2.");
        }
        if ($problems = $this->problems()) {
            throw new RuntimeException("The changelog is not valid:\n- " . implode("\n- ", $problems));
        }
        $data = $this->read();
        if ($note !== null && trim($note) !== '') {
            $data['unreleased'][] = ['type' => 'added', 'area' => self::CORE, 'part' => 'admin', 'text' => mb_substr(trim($note), 0, 300)];
        }
        if (in_array($version, array_column($data['releases'], 'version'), true)) {
            throw new RuntimeException("{$version} is released already.");
        }
        if ($data['unreleased'] === []) {
            throw new RuntimeException('Nothing to release - add the changes to "unreleased" first.');
        }
        array_unshift($data['releases'], ['version' => $version, 'date' => $date, 'changes' => $data['unreleased']]);
        $count = count($data['unreleased']);
        $data['unreleased'] = [];
        file_put_contents($this->path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");

        return $count;
    }

    /**
     * @description Releases up to (and including) the running version, newest first, with only the
     *   changes of the given areas / part (security first). A running version missing in the file
     *   (development, `dev`) shows every release. Releases without a matching change are left out;
     *   `unreleased` is never shown.
     * @param list<string> $areas Areas to keep.
     * @param string|null $part Only this part (admin / public), null = both.
     * @param string|null $current Running version (config app.version).
     * @return list<array{version: string, date: string, changes: list<array<string, string>>}>
     */
    public function releasesFor(array $areas, ?string $part = null, ?string $current = null): array
    {
        $releases = $this->read()['releases'];
        $versions = array_column($releases, 'version');
        $index = $current !== null ? array_search($current, $versions, true) : false;

        $result = [];
        foreach (array_slice($releases, $index === false ? 0 : $index) as $release) {
            $changes = array_values(array_filter(
                $release['changes'] ?? [],
                fn ($c) => in_array($c['area'] ?? null, $areas, true) && ($part === null || ($c['part'] ?? null) === $part)
            ));
            if ($changes === []) {
                continue;
            }
            usort($changes, fn ($a, $b) => array_search($a['type'], self::TYPES, true) <=> array_search($b['type'], self::TYPES, true));
            $result[] = [
                'version' => (string) $release['version'],
                'date'    => (string) $release['date'],
                'changes' => array_map(fn ($c) => array_filter([
                    'type' => $c['type'], 'area' => $c['area'], 'part' => $c['part'], 'text' => $c['text'], 'ref' => $c['ref'] ?? null,
                ], fn ($v) => $v !== null), $changes),
            ];
        }

        return $result;
    }

    /**
     * @description Markdown notes of one release (GitHub Release), grouped by type.
     * @param string $version Released version.
     * @return string|null Markdown, null when the version has no section.
     */
    public function notes(string $version): ?string
    {
        $release = $this->releasesFor($this->areas(), null, $version)[0] ?? null;
        if ($release === null || $release['version'] !== $version) {
            return null;
        }
        $lines = [];
        foreach (self::TYPES as $type) {
            $items = array_filter($release['changes'], fn ($c) => $c['type'] === $type);
            if ($items === []) {
                continue;
            }
            $lines[] = '### ' . ucfirst($type);
            foreach ($items as $c) {
                $lines[] = "- **{$c['area']} / {$c['part']}**: {$c['text']}" . (isset($c['ref']) ? " ({$c['ref']})" : '');
            }
            $lines[] = '';
        }

        return trim(implode("\n", $lines)) . "\n";
    }

    /**
     * @description Valid areas: the core and the registered applications.
     * @return list<string>
     */
    public function areas(): array
    {
        return [self::CORE, ...array_map(fn (AppManifest $app) => $app->id(), AppRegistry::apps())];
    }
}
