<?php

/**
 * @file KnowledgeBaseTest.php
 * @path api/tests/Feature/Core/KnowledgeBaseTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the internal manual (Knowledge Base): the JSON files are
 *   consistent (every page in every language, known permission keys, valid blocks) and every
 *   user gets only the pages / sections of the permissions they hold; languages and fallback;
 *   every admin page links its own page of the manual (help button "?" of the page).
 * @dependencies
 * - Tests\TestCase (InteractsWithAccounts); resources/knowledge-base/*.json + the knowledge-base
 *   files of the registered applications (the real content);
 *   ../erp/src/app/admin/admin-routing.module.ts + the admin route file of every application
 *   (erp/src/app/apps/<app>/admin/<app>-admin.routes.ts)
 *   (the admin routes, `data.help`).
 */

namespace Tests\Feature\Core;

use App\Support\Apps\AppRegistry;
use App\Support\KnowledgeBase\KnowledgeBase;
use Tests\TestCase;

/**
 * @description /api/knowledge-base, /api/knowledge-base/pages/{id}.
 */
class KnowledgeBaseTest extends TestCase
{
    /** @var string[] Block types the frontend renders (KbArticleComponent). */
    private const BLOCK_TYPES = ['text', 'lead', 'alert', 'image', 'link', 'list', 'grid', 'flow', 'note'];

    /**
     * @description Decodes one file of the manual - the core file with the files of the
     *   registered applications (as KnowledgeBase merges them).
     * @param string $name File name without .json.
     * @return array<string, mixed>
     */
    private function file(string $name): array
    {
        $merged = KnowledgeBase::decode(resource_path(KnowledgeBase::DIRECTORY . "/{$name}.json"));
        foreach (AppRegistry::apps() as $app) {
            $extra = ($dir = $app->knowledgeBasePath()) ? KnowledgeBase::decode("{$dir}/{$name}.json") : null;
            if ($extra !== null) {
                $merged['pages'] = $name === 'structure' ? [...$merged['pages'], ...$extra['pages']] : $merged['pages'] + $extra['pages'];
            }
        }

        return $merged;
    }

    /**
     * @description The files fit together: unique page ids, every page with texts in every language,
     *   the section keys of structure.json exist in every language, permissions are seeded keys (or
     *   'sysadmin'), every text is a plain string and every block type is known.
     * @input structure.json, cz.json, en.json, BaseDataSeeder::permissions() (core + module data files).
     * @output No inconsistency.
     */
    public function test_content_files_are_consistent(): void
    {
        $structure = $this->file('structure')['pages'];
        $ids = array_column($structure, 'id');
        $this->assertSame($ids, array_unique($ids));
        $known = array_column(\Database\Seeders\BaseDataSeeder::permissions(), 'permission_key');

        $permissions = array_filter(array_merge(
            array_column($structure, 'permission'),
            ...array_map(fn ($p) => array_values($p['sections'] ?? []), $structure)
        ));
        foreach ($permissions as $expression) {
            foreach (explode('|', $expression) as $key) {
                $this->assertTrue($key === 'sysadmin' || in_array($key, $known, true), "Unknown permission '{$key}'.");
            }
        }

        foreach (['cz', 'en'] as $lang) {
            $pages = $this->file($lang)['pages'];
            $this->assertEqualsCanonicalizing($ids, array_keys($pages), "{$lang}.json pages");
            foreach ($structure as $page) {
                $texts = $pages[$page['id']];
                $this->assertIsString($texts['navLabel']);
                $this->assertIsString($texts['header']);
                $keys = array_column($texts['sections'], 'key');
                foreach (array_keys($page['sections'] ?? []) as $key) {
                    $this->assertContains($key, $keys, "{$lang}.json {$page['id']} section {$key}");
                }
                foreach ($texts['sections'] as $section) {
                    foreach ($section['blocks'] as $block) {
                        $this->assertContains($block['type'], self::BLOCK_TYPES);
                    }
                    array_walk_recursive($section, fn ($value) => $this->assertTrue(is_string($value) || is_bool($value), "{$lang}.json {$page['id']}: non-text value"));
                }
            }
        }
    }

    /**
     * @description Access follows the permissions: without any only the general pages; the page of
     *   an admin section with its view permission, its editing chapters only with the matching
     *   action; sysadmin-only chapters / pages for the sysadmin; the developer note is never sent;
     *   a hidden page answers like a missing one.
     * @input Guest; account without permissions; with core-administrators-view; + -update; sysadmin.
     * @output 401; menu = pages without permission; administrators 404; then visible without the
     *   create / update / delete / sysadmin chapters; -update adds chapter 06 and 09 only; sysadmin
     *   every section and edit-roles; no devNote anywhere.
     */
    public function test_pages_follow_the_permissions(): void
    {
        $this->getJson('/api/knowledge-base')->assertStatus(401);
        $structure = collect($this->file('structure')['pages']);
        $sectionKeys = fn ($response) => array_column($response->json('data.sections'), 'key');

        $this->signIn($this->userWith([]));
        $menu = $this->getJson('/api/knowledge-base')->assertOk()->json('data');
        $this->assertSame($structure->whereNull('permission')->pluck('id')->values()->all(), array_column($menu, 'id'));
        $this->getJson('/api/knowledge-base/pages/administrators')->assertNotFound();
        $this->getJson('/api/knowledge-base/pages/introductions')->assertOk()->assertJsonMissingPath('data.devNote');

        $this->signIn($this->userWith(['core-administrators-view']));
        $this->assertContains('administrators', array_column($this->getJson('/api/knowledge-base')->json('data'), 'id'));
        $this->assertNotContains('security-events', array_column($this->getJson('/api/knowledge-base')->json('data'), 'id'));
        $keys = $sectionKeys($this->getJson('/api/knowledge-base/pages/administrators')->assertOk());
        $this->assertContains('chapter-01', $keys);
        foreach (['chapter-04', 'chapter-06', 'chapter-09', 'chapter-10', 'chapter-15', 'chapter-16'] as $hidden) {
            $this->assertNotContains($hidden, $keys);
        }

        $this->signIn($this->userWith(['core-administrators-view', 'core-administrators-update']));
        $keys = $sectionKeys($this->getJson('/api/knowledge-base/pages/administrators'));
        $this->assertContains('chapter-06', $keys);
        $this->assertContains('chapter-09', $keys);
        $this->assertNotContains('chapter-10', $keys);
        $this->assertNotContains('chapter-04', $keys);
        $this->getJson('/api/knowledge-base/pages/edit-roles')->assertNotFound();

        $this->signIn($this->sysadmin());
        $this->assertCount($structure->count(), $this->getJson('/api/knowledge-base')->json('data'));
        $this->assertCount(count($this->file('cz')['pages']['administrators']['sections']), $this->getJson('/api/knowledge-base/pages/administrators')->json('data.sections'));
        $this->getJson('/api/knowledge-base/pages/edit-roles')->assertOk();
        $this->assertStringNotContainsString('devNote', $this->getJson('/api/knowledge-base/pages/administrators')->getContent());
    }

    /**
     * @description Languages: the requested one; an unknown one falls back to English; an invalid
     *   code is Czech; an unknown or malformed page id is 404.
     * @input sysadmin; lang en / xx / '../x'; page 'nope' and 'Bad_Id'.
     * @output en header 'User Account Management'; xx the same; invalid code the Czech header;
     *   404, 404.
     */
    public function test_languages_and_unknown_pages(): void
    {
        $this->signIn($this->sysadmin());
        $en = $this->file('en')['pages']['administrators']['header'];
        $cz = $this->file('cz')['pages']['administrators']['header'];

        $this->getJson('/api/knowledge-base/pages/administrators?lang=en')->assertJsonPath('data.header', $en);
        $this->getJson('/api/knowledge-base/pages/administrators?lang=xx')->assertJsonPath('data.header', $en);
        $this->getJson('/api/knowledge-base/pages/administrators?lang=../x')->assertJsonPath('data.header', $cz);
        $this->assertSame($this->file('en')['pages']['introductions']['navLabel'],
            collect($this->getJson('/api/knowledge-base?lang=en')->json('data'))->firstWhere('id', 'introductions')['label']);
        $this->getJson('/api/knowledge-base/pages/nope')->assertNotFound();
        $this->getJson('/api/knowledge-base/pages/Bad_Id')->assertNotFound();
    }

    /**
     * @description Every admin page (the core in admin-routing.module.ts, every application in
     *   apps/<app>/admin/*-admin.routes.ts) has its help topic (`data.help`) and it is a page of the
     *   manual for the same readers: the same permission as the route, null for a page without one,
     *   'sysadmin' for a sysadminGuard page.
     * @input The real admin routes of the core and the applications, the merged structure.json.
     * @output The 12 pages of the core and at least one page of every application whose admin
     *   route file exists, each with an existing manual page of its permission; no manual page
     *   used twice.
     */
    public function test_every_admin_page_links_its_manual_page(): void
    {
        $routing = base_path('../erp/src/app/admin/admin-routing.module.ts');
        if (!is_file($routing)) {
            $this->markTestSkipped('The admin frontend (erp) is not next to the API.');
        }

        $pages = collect($this->file('structure')['pages'])->keyBy('id');
        $checked = [];
        $check = function (string $module, string $line) use ($pages, &$checked): void {
            if (!preg_match("/\\{ path: '([a-z-]+)', (?:component: \\w+|loadComponent: )/", $line, $match)) {
                return;
            }
            $route = "{$module}/{$match[1]}";
            $this->assertMatchesRegularExpression("/help: '[a-z0-9-]+'/", $line, "{$route}: missing data.help");
            preg_match("/help: '([a-z0-9-]+)'/", $line, $help);
            preg_match("/permission: '([^']+)'/", $line, $permission);
            $expected = $permission[1] ?? (str_contains($line, 'sysadminGuard') ? 'sysadmin' : null);

            $this->assertTrue($pages->has($help[1]), "{$route}: no manual page '{$help[1]}'");
            $this->assertSame($expected, $pages[$help[1]]['permission'], "{$route}: other readers than the manual page '{$help[1]}'");
            $checked[$route] = $help[1];
        };

        $inCore = false;
        foreach (file($routing) as $line) {
            if (preg_match("/^\\s*path: '(\\w+)',/", $line, $match)) {
                $inCore = $match[1] === 'core';
                continue;
            }
            // The error pages (forbidden, 404) after the modules are no admin pages.
            if ($inCore && !str_contains($line, 'AdminErrorPageComponent')) {
                $check('core', $line);
            }
        }
        foreach (glob(base_path('../erp/src/app/apps/*/admin/*-admin.routes.ts')) as $file) {
            $app = basename(dirname($file, 2));
            foreach (file($file) as $line) {
                $check($app, $line);
            }
        }

        $perModule = array_count_values(array_map(fn (string $route) => strtok($route, '/'), array_keys($checked)));
        $this->assertSame(12, $perModule['core'] ?? 0, 'core pages');
        foreach (glob(base_path('../erp/src/app/apps/*/admin/*-admin.routes.ts')) as $file) {
            $app = basename(dirname($file, 2));
            $this->assertGreaterThan(0, $perModule[$app] ?? 0, "{$app} pages");
        }
        $this->assertSame(count($checked), count(array_unique($checked)));
    }
}
