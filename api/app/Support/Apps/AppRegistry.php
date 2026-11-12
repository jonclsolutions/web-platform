<?php
/**
 * @file AppRegistry.php
 * @path app/Support/Apps/AppRegistry.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Read access of the core to the applications registered in config/apps.php
 * (manifests, AppManifest). A listed class that does not exist or is no manifest is skipped, so
 * deleting an application's folder never breaks the core; classes a manifest names are checked
 * the same way.
 * @usage AppRegistry::apps(), AppRegistry::app('web'), AppRegistry::retentionSources(), …
 * @note The manifests are built once per configuration (memoized by the class list), so the
 *   registry is cheap even on hot paths (ModelChanges runs on every model event); a test that
 *   changes `apps.apps` gets the new list at once.
 * @dependencies AppManifest, config/apps.php
 */

namespace App\Support\Apps;

use App\Services\Agenda\AgendaSource;
use App\Services\Retention\RetentionSource;
use Database\Seeders\ModuleBaseDataSeeder;

final class AppRegistry
{
    /** @var array<string, array<string, AppManifest>> Manifests per configured class list. */
    private static array $memo = [];

    /**
     * @description Registered applications in configured order.
     * @return array<string, AppManifest> id => manifest
     */
    public static function apps(): array
    {
        $classes = array_values(array_filter((array) config('apps.apps', []), 'is_string'));
        $key = implode('|', $classes);

        return self::$memo[$key] ??= self::build($classes);
    }

    /**
     * @description One application.
     * @param string $id Application id (e.g. 'web').
     * @return AppManifest|null Null when not registered (e.g. removed).
     */
    public static function app(string $id): ?AppManifest
    {
        return self::apps()[$id] ?? null;
    }

    /**
     * @description Base data seeders of all applications.
     * @return array<int, class-string<ModuleBaseDataSeeder>>
     */
    public static function baseDataSeeders(): array
    {
        return self::classes(fn (AppManifest $app) => $app->baseDataSeeders(), ModuleBaseDataSeeder::class);
    }

    /**
     * @description Retention sources of all applications.
     * @return array<int, RetentionSource>
     */
    public static function retentionSources(): array
    {
        return array_map(fn (string $class) => app($class), self::classes(fn (AppManifest $app) => $app->retentionSources(), RetentionSource::class));
    }

    /**
     * @description Calendar sources of all applications with the application they belong to.
     * @return array<int, array{0: AppManifest, 1: AgendaSource}>
     */
    public static function agendaSources(): array
    {
        $sources = [];
        foreach (self::apps() as $app) {
            foreach ($app->agendaSources() as $class) {
                if (self::valid($class, AgendaSource::class)) {
                    $sources[] = [$app, app($class)];
                }
            }
        }

        return $sources;
    }

    /**
     * @description Upload profiles of all applications (first one wins on a name clash).
     * @return array<string, array{extensions: list<string>, max_files: int, max_file_kb: int, max_total_bytes: int|null}>
     */
    public static function uploadProfiles(): array
    {
        $profiles = [];
        foreach (self::apps() as $app) {
            $profiles += $app->uploadProfiles();
        }

        return $profiles;
    }

    /**
     * @description Upload folders (private disk) of all applications.
     * @return array<int, string>
     */
    public static function uploadFolders(): array
    {
        $folders = [];
        foreach (self::apps() as $app) {
            array_push($folders, ...$app->uploadFolders());
        }

        return array_values(array_unique($folders));
    }

    /**
     * @description Morph aliases of all applications.
     * @return array<string, class-string>
     */
    public static function morphMap(): array
    {
        $map = [];
        foreach (self::apps() as $app) {
            $map += $app->morphMap();
        }

        return $map;
    }

    /**
     * @description Application whose model a morph alias / class belongs to.
     * @param string $type Stored `attachable_type` (alias, or a class name of older rows).
     * @return AppManifest|null
     */
    public static function ownerOfMorph(string $type): ?AppManifest
    {
        foreach (self::apps() as $app) {
            $map = $app->morphMap();
            if (isset($map[$type]) || in_array($type, $map, true)) {
                return $app;
            }
        }

        return null;
    }

    /**
     * @description Audit log model of an application.
     * @param string $id Application id.
     * @return class-string|null Null when the application is not registered.
     */
    public static function logModel(string $id): ?string
    {
        return self::app($id)?->logModel();
    }

    /**
     * @description Audit log models of all applications.
     * @return array<int, class-string>
     */
    public static function logModels(): array
    {
        return array_values(array_map(fn (AppManifest $app) => $app->logModel(), self::apps()));
    }

    /**
     * @description Permission that edits the translations of an application.
     * @param string $id Application id (= translation module).
     * @return string|null
     */
    public static function translationPermission(string $id): ?string
    {
        return self::app($id)?->translationPermission();
    }

    /**
     * @description Permissions of every application that may edit its translations.
     * @return array<int, string>
     */
    public static function translationPermissions(): array
    {
        return array_values(array_filter(array_map(fn (AppManifest $app) => $app->translationPermission(), self::apps())));
    }

    /**
     * @description Instantiates the valid manifests.
     * @param array<int, string> $classes Configured classes.
     * @return array<string, AppManifest>
     */
    private static function build(array $classes): array
    {
        $apps = [];
        foreach ($classes as $class) {
            if (self::valid($class, AppManifest::class)) {
                $app = app($class);
                $apps[$app->id()] ??= $app;
            }
        }

        return $apps;
    }

    /**
     * @description Existing classes of the given kind collected from every manifest.
     * @param callable(AppManifest): array $pick Class list of one manifest.
     * @param class-string $kind Required parent class / interface.
     * @return array<int, class-string>
     */
    private static function classes(callable $pick, string $kind): array
    {
        $out = [];
        foreach (self::apps() as $app) {
            foreach ($pick($app) as $class) {
                if (self::valid($class, $kind)) {
                    $out[] = $class;
                }
            }
        }

        return $out;
    }

    /**
     * @description Whether the value names an existing class of the kind.
     * @param mixed $class Value of a list.
     * @param class-string $kind Required parent class / interface.
     * @return bool
     */
    private static function valid(mixed $class, string $kind): bool
    {
        return is_string($class) && class_exists($class) && is_subclass_of($class, $kind);
    }
}
