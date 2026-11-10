<?php
/**
 * @file KnowledgeBase.php
 * @path app/Support/KnowledgeBase/KnowledgeBase.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The internal manual of the administration (Knowledge Base) - content kept in JSON
 * files OUTSIDE the public folder (resources/knowledge-base), delivered only to signed-in users and
 * only the parts each one may see:
 *   - structure.json - language neutral: pages (id, menu group, order, `permission`) and the
 *     permissions of single sections (`sections`: section key => permission), plus `devNote`
 *     (developer note, never sent);
 *   - {lang}.json (cz.json, en.json, ...) - texts of the pages: navLabel, header, sections
 *     (optional `key`, `heading`, `blocks`).
 * Access follows the existing permissions: a page needs the permission of the admin page it
 * describes, a section (e.g. editing / deleting accounts) the permission of that action. A
 * permission is one key or several separated by `|` (any of them), `sysadmin` = only the
 * sysadmin role, null = every signed-in user. The sysadmin sees everything.
 * @note Editing the manual = editing the JSON files (git diff, review, deploy) - the content is
 *   part of the released product, not user data. A page missing in a language falls back to
 *   English, then Czech.
 * @dependencies App\Models\User (roles, effective permissions)
 */

namespace App\Support\KnowledgeBase;

use App\Models\User;
use RuntimeException;

class KnowledgeBase
{
    /** @description Folder of the JSON files. */
    public const DIRECTORY = 'knowledge-base';

    /** @description Role that sees every page and section. */
    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /** @description Fallback languages of a page missing in the requested language. */
    private const FALLBACK_LANGUAGES = ['en', 'cz'];

    /** @var array<string, array<string, mixed>> Decoded files of this request. */
    private array $files = [];

    private readonly bool $isSysadmin;

    /** @var array<int, string> Effective permissions of the user. */
    private readonly array $permissions;

    /**
     * @param User $user Signed-in user the content is filtered for.
     */
    public function __construct(User $user)
    {
        $this->isSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
        $this->permissions = $user->permissions ?? [];
    }

    /**
     * @description Menu of the pages the user may open.
     * @param string $lang Requested language code.
     * @return array<int, array{id: string, group: string, order: int, label: string}>
     */
    public function menu(string $lang): array
    {
        $menu = [];
        foreach ($this->structure()['pages'] as $page) {
            $texts = $this->texts($page['id'], $lang);
            if ($texts === null || !$this->allows($page['permission'] ?? null)) {
                continue;
            }
            $menu[] = [
                'id'    => $page['id'],
                'group' => $page['group'],
                'order' => (int) $page['order'],
                'label' => (string) ($texts['navLabel'] ?? $page['id']),
            ];
        }

        return $menu;
    }

    /**
     * @description One page with only the sections the user may see.
     * @param string $id Page id.
     * @param string $lang Requested language code.
     * @return array<string, mixed>|null The page; null when it does not exist or is not allowed.
     */
    public function page(string $id, string $lang): ?array
    {
        $page = collect($this->structure()['pages'])->firstWhere('id', $id);
        if ($page === null || !$this->allows($page['permission'] ?? null)) {
            return null;
        }
        $texts = $this->texts($id, $lang);
        if ($texts === null) {
            return null;
        }

        $sectionPermissions = $page['sections'] ?? [];
        $sections = array_values(array_filter(
            $texts['sections'] ?? [],
            fn (array $section) => $this->allows($sectionPermissions[$section['key'] ?? ''] ?? null)
        ));

        return [
            'id'       => $id,
            'group'    => $page['group'],
            'order'    => (int) $page['order'],
            'navLabel' => (string) ($texts['navLabel'] ?? $id),
            'header'   => (string) ($texts['header'] ?? ''),
            'sections' => $sections,
        ];
    }

    /**
     * @description Whether the user satisfies a permission expression (see the file header).
     * @param string|null $permission Null = everybody.
     * @return bool
     */
    private function allows(?string $permission): bool
    {
        if ($permission === null || $permission === '' || $this->isSysadmin) {
            return true;
        }
        $keys = array_diff(explode('|', $permission), [self::SYSADMIN_ROLE_NAME]);

        return array_intersect($keys, $this->permissions) !== [];
    }

    /**
     * @description Texts of a page: the requested language, else the fallback languages.
     * @param string $id Page id.
     * @param string $lang Language code.
     * @return array<string, mixed>|null
     */
    private function texts(string $id, string $lang): ?array
    {
        foreach (array_unique([$lang, ...self::FALLBACK_LANGUAGES]) as $code) {
            $pages = $this->language($code)['pages'] ?? [];
            if (isset($pages[$id])) {
                return $pages[$id];
            }
        }

        return null;
    }

    /** @return array{pages: array<int, array<string, mixed>>} */
    private function structure(): array
    {
        return $this->read('structure') ?? throw new RuntimeException('knowledge-base/structure.json is missing.');
    }

    /**
     * @description Texts of a language - an unknown or invalid code is an empty set.
     * @param string $code Language code (letters only).
     * @return array<string, mixed>
     */
    private function language(string $code): array
    {
        return preg_match('/^[a-z]{2,5}$/', $code) === 1 ? ($this->read($code) ?? []) : [];
    }

    /**
     * @description Decodes one JSON file of the folder (cached for the request).
     * @param string $name File name without `.json` (validated by the callers).
     * @return array<string, mixed>|null Null when the file does not exist.
     */
    private function read(string $name): ?array
    {
        if (!array_key_exists($name, $this->files)) {
            $path = resource_path(self::DIRECTORY . "/{$name}.json");
            $this->files[$name] = is_file($path)
                ? json_decode((string) file_get_contents($path), true, 64, JSON_THROW_ON_ERROR)
                : null;
        }

        return $this->files[$name];
    }
}
