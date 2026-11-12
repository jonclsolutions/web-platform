<?php
/**
 * @file ModuleBaseDataSeeder.php
 * @path api/database/seeders/ModuleBaseDataSeeder.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Base of the base data seeder of one module (web, e-shop, …). A module seeder lives
 *   in the module's own folder (database/seeders/<Module>/ with its data/ and assets/) and is
 *   listed in the module's manifest (AppManifest::baseDataSeeders(), config/apps.php); BaseDataSeeder runs the registered ones after
 *   the core data and then gives the sysadmin role every permission. A removed module (folder
 *   deleted, class gone) is skipped - the core is seeded without it.
 * @note The helpers only ADD what is missing (idempotent, never destructive): permissions by key,
 *   page titles by area + page key, files on the public disk by path.
 * @dependencies CorePermission, legal_page_titles table, public disk.
 */

namespace Database\Seeders;

use App\Models\Core\CorePermission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

abstract class ModuleBaseDataSeeder extends Seeder
{
    /** Built-in language flag (core asset) copied for every translation module. */
    protected const FLAG_ASSET = __DIR__ . '/assets/czech-republic-default.png';

    /**
     * @description Folder of the module seeder (with data/ and assets/).
     * @return string Absolute path.
     */
    abstract protected static function moduleDir(): string;

    /**
     * @description Adds the missing base data of the module.
     * @return void
     */
    abstract public function run(): void;

    /**
     * @description Permission keys of the module (data/permissions.php of the module folder).
     * @return array<int, array{permission_key: string, description: string, module: string}>
     */
    public static function permissions(): array
    {
        return static::data('permissions');
    }

    /**
     * @description Loads one data file of the module (data/<name>.php).
     * @param string $name File name without .php.
     * @return array<mixed>
     */
    protected static function data(string $name): array
    {
        return require static::moduleDir() . "/data/{$name}.php";
    }

    /**
     * @description Adds the permission keys that do not exist yet (descriptions of existing keys stay).
     * @param array<int, array<string, string>> $permissions Rows of a permissions data file.
     * @return void
     */
    public static function addPermissions(array $permissions): void
    {
        $existing = CorePermission::pluck('permission_key')->flip();
        foreach ($permissions as $permission) {
            if (!$existing->has($permission['permission_key'])) {
                CorePermission::create($permission);
            }
        }
    }

    /**
     * @description Adds the missing page title rows (edited titles stay).
     * @param array<int, array<string, mixed>> $titles Rows of a page_titles data file.
     * @return void
     */
    public static function addPageTitles(array $titles): void
    {
        foreach ($titles as $title) {
            $exists = DB::table('legal_page_titles')->where('area', $title['area'])->where('page_key', $title['page_key'])->exists();
            if (!$exists) {
                DB::table('legal_page_titles')->insert([
                    'area'       => $title['area'],
                    'page_key'   => $title['page_key'],
                    'route_path' => $title['route_path'],
                    'title_i18n' => json_encode($title['title_i18n'], JSON_UNESCAPED_UNICODE),
                    'sort_order' => $title['sort_order'],
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * @description Copies files to the public disk when missing (storage is not in git - a new
     *   checkout or server has none of them); existing / uploaded files stay.
     * @param array<string, string> $files Target path on the public disk => absolute source path.
     * @return void
     */
    public static function copyToPublicDisk(array $files): void
    {
        $disk = Storage::disk('public');
        foreach ($files as $target => $source) {
            if (!$disk->exists($target)) {
                $disk->put($target, (string) file_get_contents($source));
            }
        }
    }
}
