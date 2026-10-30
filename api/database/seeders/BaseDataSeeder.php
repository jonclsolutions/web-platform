<?php
/**
 * @file BaseDataSeeder.php
 * @path api/database/seeders/BaseDataSeeder.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-30
 * @description The data EVERY installation needs before the first login (local and production):
 *   - the permission keys (data/permissions.php),
 *   - the role `sysadmin` with all permissions - it cannot be renamed, edited or deleted in the
 *     admin (CoreRole::isProtected()) and always requires 2FA (User::FORCED_2FA_ROLE_NAMES),
 *   - the browser tab titles of the pages (data/page_titles.php),
 *   - the legal document types gdpr / tos / cookies (data/document_types.php),
 *   - the default rows of the web and e-shop settings (data/*_site_settings.php).
 *   No account is created here: locally DevelopmentSeeder adds the test sysadmin, on the server
 *   `php artisan security:create-sysadmin` asks for the first one.
 * @note Idempotent and never destructive: only missing permissions / titles / types / rows are
 *   added; edited texts, descriptions and settings stay. A new permission key added to
 *   data/permissions.php is given to the sysadmin role on the next run.
 *   Company details (legal_site_settings) are entered in the admin - not seeded.
 * @dependencies
 * - CorePermission, CoreRole, PageTitle, DocumentType, WebSiteSetting, ShopSiteSetting.
 */

namespace Database\Seeders;

use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use App\Models\Legal\DocumentType;
use App\Models\Shop\ShopSiteSetting;
use App\Models\Web\WebSiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class BaseDataSeeder extends Seeder
{
    /**
     * @description Adds the missing base data.
     * @return void
     */
    public function run(): void
    {
        DB::transaction(function () {
            $this->seedPermissions();
            $this->seedSysadminRole();
            $this->seedPageTitles();
            $this->seedDocumentTypes();
            $this->seedSiteSettings();
        });
    }

    /**
     * @description Adds the permission keys that do not exist yet (descriptions of existing keys stay).
     * @return void
     */
    private function seedPermissions(): void
    {
        $existing = CorePermission::pluck('permission_key')->flip();
        foreach ($this->data('permissions') as $permission) {
            if (!$existing->has($permission['permission_key'])) {
                CorePermission::create($permission);
            }
        }
    }

    /**
     * @description Creates the sysadmin role (if missing) and gives it every permission.
     * @return void
     */
    private function seedSysadminRole(): void
    {
        $role = CoreRole::withTrashed()->where('role_name', 'sysadmin')->first()
            ?? CoreRole::create(['role_name' => 'sysadmin', 'description' => 'System administrator - full access (protected role).', 'forces_2fa' => true]);
        if ($role->trashed()) {
            $role->restore();
        }
        $role->permissions()->syncWithoutDetaching(CorePermission::pluck('id')->all());
    }

    /**
     * @description Adds the missing page title rows (edited titles stay).
     * @return void
     */
    private function seedPageTitles(): void
    {
        foreach ($this->data('page_titles') as $title) {
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
     * @description Adds the missing legal document types.
     * @return void
     */
    private function seedDocumentTypes(): void
    {
        foreach ($this->data('document_types') as $type) {
            DocumentType::firstOrCreate(['slug' => $type['slug']], ['title' => $type['title']]);
        }
    }

    /**
     * @description Creates the singleton rows of the web and e-shop settings when missing.
     * @return void
     */
    private function seedSiteSettings(): void
    {
        if (!WebSiteSetting::query()->exists()) {
            WebSiteSetting::create($this->data('web_site_settings'));
        }
        if (!ShopSiteSetting::query()->exists()) {
            ShopSiteSetting::create($this->data('shop_site_settings'));
        }
    }

    /**
     * @description Loads one data file of database/seeders/data.
     * @param string $name File name without .php.
     * @return array<mixed>
     */
    private function data(string $name): array
    {
        return require __DIR__ . "/data/{$name}.php";
    }
}
