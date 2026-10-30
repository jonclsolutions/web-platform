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
 *   - the default rows of the web and e-shop settings (data/*_site_settings.php),
 *   - neutral placeholder company details (data/legal_site_settings.php) with a default logo -
 *     the public footer, contact page and FAQ render only when they exist,
 *   - English templates of the legal documents (data/document_sections.php) - privacy policy,
 *     terms of service, cookie policy - with placeholders to be replaced by the operator,
 *   - the default media the data refers to (storage/app/public is not in git): the logo and the
 *     flag of the built-in language (storage/app/public/translations/languages.json).
 *   No account is created here: locally DevelopmentSeeder adds the test sysadmin, on the server
 *   `php artisan security:create-sysadmin` asks for the first one.
 * @note Idempotent and never destructive: only missing permissions / titles / types / rows /
 *   files are added; edited texts, descriptions, settings and uploaded files stay. Legal sections
 *   are added only to a document type without any section. A new permission key added to
 *   data/permissions.php is given to the sysadmin role on the next run.
 * @refactor-note (2026-10-31) Company details, legal document templates and default media added
 *   (a fresh installation showed no logo, no flags, no footer, no FAQ and empty legal pages).
 * @dependencies
 * - CorePermission, CoreRole, PageTitle, DocumentType, WebSiteSetting, ShopSiteSetting.
 */

namespace Database\Seeders;

use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use App\Models\Legal\DocumentSection;
use App\Models\Legal\DocumentType;
use App\Models\Legal\SiteSetting;
use App\Models\Shop\ShopSiteSetting;
use App\Models\Web\WebSiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BaseDataSeeder extends Seeder
{
    /** Stored path of the default logo (public disk). */
    public const DEFAULT_LOGO_PATH = 'site-logos/default-logo.svg';

    /** Default flag of the built-in language per translation module (public disk) - see languages.json. */
    public const DEFAULT_FLAG_PATHS = [
        'translation_images/web/czech-republic-default.png',
        'translation_images/shop/czech-republic-default.png',
    ];

    /** Language of the legal document templates. */
    private const LEGAL_TEMPLATE_LANG = 'en';

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
            $this->seedCompanyDetails();
            $this->seedLegalDocuments();
        });
        $this->seedDefaultMedia();
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
     * @description Copies the default logo and the built-in language flags to the public disk when
     *   missing (storage is not in git - a new checkout or server has none of them).
     * @return void
     */
    private function seedDefaultMedia(): void
    {
        $disk = Storage::disk('public');
        $files = [self::DEFAULT_LOGO_PATH => 'default-logo.svg'];
        foreach (self::DEFAULT_FLAG_PATHS as $path) {
            $files[$path] = 'czech-republic-default.png';
        }
        foreach ($files as $target => $source) {
            if (!$disk->exists($target)) {
                $disk->put($target, (string) file_get_contents(__DIR__ . "/assets/{$source}"));
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
