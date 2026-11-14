<?php

/**
 * @file ApplicationBoundariesTest.php
 * @path api/tests/Unit/Core/ApplicationBoundariesTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Architecture check of the direction of the dependencies: the core (everything
 *   outside app/Apps) never names a class of an application - it reaches them only through the
 *   registry (config/apps.php, AppRegistry); an application - and its tests - never names a
 *   class of another application. Only code counts (class names in the PHP tokens), not
 *   comments or strings. Tests of the core together with the applications live in
 *   tests/Integration (not checked).
 * @dependencies Tests\TestCase; the PHP tokenizer (token_get_all).
 */

namespace Tests\Unit\Core;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Tests\TestCase;

/**
 * @description Class names used by the core and by every application.
 */
class ApplicationBoundariesTest extends TestCase
{
    /**
     * @description PHP files below a folder.
     * @param string $dir Absolute folder.
     * @return array<int, string>
     */
    private function phpFiles(string $dir): array
    {
        $files = [];
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS)) as $file) {
            if ($file->isFile() && str_ends_with($file->getFilename(), '.php')) {
                $files[] = $file->getPathname();
            }
        }

        return $files;
    }

    /**
     * @description Applications named in the code of a file (`App\Apps\<App>\…` or their tests
     *   `Tests\Apps\<App>\…`), comments and strings ignored.
     * @param string $file Absolute path.
     * @return array<int, string> Application folder names.
     */
    private function applicationsNamedIn(string $file): array
    {
        $apps = [];
        foreach (token_get_all((string) file_get_contents($file)) as $token) {
            if (is_array($token) && in_array($token[0], [T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED], true)
                && preg_match('/^\\\\?(?:App|Tests)\\\\Apps\\\\(\w+)\\\\/', $token[1], $match)) {
                $apps[] = $match[1];
            }
        }

        return array_values(array_unique($apps));
    }

    /**
     * @description The core names no application: app/ outside app/Apps, bootstrap/, routes/,
     *   database/ and config/ (except the registry config/apps.php).
     * @input Every PHP file of those folders.
     * @output No `App\Apps\…` class name.
     */
    public function test_core_names_no_application(): void
    {
        $appsDir = app_path('Apps') . DIRECTORY_SEPARATOR;
        $files = [];
        foreach ([app_path(), base_path('bootstrap'), base_path('routes'), database_path(), config_path()] as $dir) {
            $files = [...$files, ...$this->phpFiles($dir)];
        }

        $violations = [];
        foreach ($files as $file) {
            if (str_starts_with($file, $appsDir) || $file === config_path('apps.php') || str_contains($file, DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR)) {
                continue;
            }
            foreach ($this->applicationsNamedIn($file) as $app) {
                $violations[] = str_replace(base_path() . DIRECTORY_SEPARATOR, '', $file) . " → App\\Apps\\{$app}";
            }
        }

        $this->assertSame([], $violations, 'The core reaches an application only through the registry.');
    }

    /**
     * @description An application and its tests name no other application.
     * @input Every PHP file of every folder of app/Apps and tests/Apps.
     * @output Only class names of its own application.
     */
    public function test_applications_name_no_other_application(): void
    {
        $violations = [];
        foreach ([...glob(app_path('Apps') . '/*', GLOB_ONLYDIR), ...glob(base_path('tests/Apps') . '/*', GLOB_ONLYDIR)] as $dir) {
            $own = basename($dir);
            foreach ($this->phpFiles($dir) as $file) {
                foreach (array_diff($this->applicationsNamedIn($file), [$own]) as $other) {
                    $violations[] = str_replace(base_path() . DIRECTORY_SEPARATOR, '', $file) . " → App\\Apps\\{$other}";
                }
            }
        }

        $this->assertSame([], $violations, 'An application never depends on another one.');
    }
}
