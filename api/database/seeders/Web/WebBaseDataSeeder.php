<?php
/**
 * @file WebBaseDataSeeder.php
 * @path api/database/seeders/Web/WebBaseDataSeeder.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Base data of the web module (registered in config/seeders.php, run by
 *   BaseDataSeeder): the web permission keys incl. the tab permission `view-web`
 *   (data/permissions.php), the browser tab titles of the web pages (data/page_titles.php), the
 *   default row of the web settings with the e-mail texts (data/web_site_settings.php) and the
 *   flag of the built-in language of the web translations.
 * @note Idempotent and never destructive - only missing keys / titles / the missing settings row /
 *   a missing flag are added.
 * @dependencies WebSiteSetting, ModuleBaseDataSeeder.
 */

namespace Database\Seeders\Web;

use App\Models\Web\WebSiteSetting;
use Database\Seeders\ModuleBaseDataSeeder;
use Illuminate\Support\Facades\DB;

class WebBaseDataSeeder extends ModuleBaseDataSeeder
{
    /** Flag of the built-in language of the web translations (public disk, see languages.json). */
    public const FLAG_PATH = 'translation_images/web/czech-republic-default.png';

    /** @description See ModuleBaseDataSeeder::moduleDir(). */
    protected static function moduleDir(): string
    {
        return __DIR__;
    }

    /** @description See ModuleBaseDataSeeder::run(). */
    public function run(): void
    {
        DB::transaction(function () {
            self::addPermissions(self::permissions());
            self::addPageTitles(self::data('page_titles'));
            if (!WebSiteSetting::query()->exists()) {
                WebSiteSetting::create(self::data('web_site_settings'));
            }
        });
        self::copyToPublicDisk([self::FLAG_PATH => self::FLAG_ASSET]);
    }
}
