<?php
/**
 * @file BaseDataSeeder.php
 * @path api/database/seeders/BaseDataSeeder.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The data EVERY installation needs before the first login (local and production).
 *   Core part (data/):
 *   - the core permission keys (data/permissions.php),
 *   - the browser tab title of the admin (data/page_titles.php),
 *   - the legal document types gdpr / tos / cookies (data/document_types.php),
 *   - neutral placeholder company details (data/legal_site_settings.php) with a default logo -
 *     the public footer, contact page and FAQ render only when they exist,
 *   - English templates of the legal documents (data/document_sections.php) - privacy policy,
 *     terms of service, cookie policy - with placeholders to be replaced by the operator,
 *   - the default logo on the public disk (storage/app/public is not in git).
 *   Then the base data of every module registered in config/seeders.php (`base_data` -
 *   Web\WebBaseDataSeeder, Shop\ShopBaseDataSeeder: their permissions, page titles, settings
 *   rows, e-shop methods, flags, icons); a module whose seeder class no longer exists is skipped.
 *   Last, the role `sysadmin` gets every permission of the core and the modules - it cannot be
 *   renamed, edited or deleted in the admin (CoreRole::isProtected()) and always requires 2FA
 *   (User::FORCED_2FA_ROLE_NAMES).
 *   No account is created here: locally DevelopmentSeeder adds the test sysadmin, on the server
 *   `php artisan security:create-sysadmin` asks for the first one.
 * @note Idempotent and never destructive: only missing permissions / titles / types / rows /
 *   files are added; edited texts, descriptions, settings and uploaded files stay. Legal sections
 *   are added only to a document type without any section. A new permission key added to a
 *   permissions data file is given to the sysadmin role on the next run.
 * @dependencies
 * - CorePermission, CoreRole, DocumentType, DocumentSection, SiteSetting, ModuleBaseDataSeeder,
 *   config/seeders.php.
 */

namespace Database\Seeders;

use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use App\Models\Legal\DocumentSection;
use App\Models\Legal\DocumentType;
use App\Models\Legal\SiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class BaseDataSeeder extends Seeder
{
    /** Stored path of the default logo (public disk). */
    public const DEFAULT_LOGO_PATH = 'site-logos/default-logo.svg';

    /** Language of the legal document templates. */
    private const LEGAL_TEMPLATE_LANG = 'en';

    /**
     * @description Adds the missing base data.
     * @return void
     */
    public function run(): void
    {
        DB::transaction(function () {
            ModuleBaseDataSeeder::addPermissions($this->data('permissions'));
            ModuleBaseDataSeeder::addPageTitles($this->data('page_titles'));
            $this->seedDocumentTypes();
            $this->seedCompanyDetails();
            $this->seedLegalDocuments();
        });
        ModuleBaseDataSeeder::copyToPublicDisk([self::DEFAULT_LOGO_PATH => __DIR__ . '/assets/default-logo.svg']);

        foreach (self::modules() as $module) {
            $this->call($module);
        }

        $this->seedSysadminRole();
    }

    /**
     * @description Base data seeders of the registered modules whose class exists (config/seeders.php).
     * @return array<int, class-string<ModuleBaseDataSeeder>>
     */
    public static function modules(): array
    {
        return array_values(array_filter(
            (array) config('seeders.base_data', []),
            fn ($class) => is_string($class) && class_exists($class) && is_subclass_of($class, ModuleBaseDataSeeder::class)
        ));
    }

    /**
     * @description Every permission row of the core and the registered modules (the full set the
     *   sysadmin role gets).
     * @return array<int, array{permission_key: string, description: string, module: string}>
     */
    public static function permissions(): array
    {
        $rows = require __DIR__ . '/data/permissions.php';
        foreach (self::modules() as $module) {
            array_push($rows, ...$module::permissions());
        }

        return $rows;
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
     * @description Creates the placeholder company details with the default logo when no row exists.
     * @return void
     */
    private function seedCompanyDetails(): void
    {
        if (!SiteSetting::query()->exists()) {
            SiteSetting::create($this->data('legal_site_settings') + ['logo_path' => self::DEFAULT_LOGO_PATH]);
        }
    }

    /**
     * @description Adds the English legal document templates to every document type without sections.
     * @return void
     */
    private function seedLegalDocuments(): void
    {
        foreach ($this->data('document_sections') as $slug => $sections) {
            $type = DocumentType::where('slug', $slug)->first();
            if (!$type || DocumentSection::where('document_type_id', $type->id)->exists()) {
                continue;
            }
            foreach (array_values($sections) as $index => [$heading, $content]) {
                DocumentSection::create([
                    'document_type_id' => $type->id,
                    'position'         => $index + 1,
                    'heading'          => $heading,
                    'content'          => $content,
                    'lang'             => self::LEGAL_TEMPLATE_LANG,
                ]);
            }
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
