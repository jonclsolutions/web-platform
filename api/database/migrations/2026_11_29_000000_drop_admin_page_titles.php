<?php
/**
 * @file 2026_11_29_000000_drop_admin_page_titles.php
 * @path api/database/migrations/2026_11_29_000000_drop_admin_page_titles.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The administration has no editable browser titles any more: its tab title is a
 *   text of the admin UI (assets/i18n/admin `shared.page_title_*` + the company name), in the
 *   languages the admin UI has. Removes the rows of the area `admin` from `legal_page_titles`
 *   (the editor in core/settings and its endpoints are gone).
 * @note down() brings back the default row of the former seed (data/page_titles.php) - the titles
 *   edited before are not restored.
 * @dependencies none (query builder only)
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Deletes the page titles of the administration.
     * @return void
     */
    public function up(): void
    {
        if (!Schema::hasTable('legal_page_titles')) {
            return;
        }
        DB::table('legal_page_titles')->where('area', 'admin')->delete();
    }

    /**
     * @description Restores the default row of the administration (when it is missing).
     * @return void
     */
    public function down(): void
    {
        if (!Schema::hasTable('legal_page_titles')
            || DB::table('legal_page_titles')->where('area', 'admin')->where('page_key', 'panel')->exists()) {
            return;
        }
        DB::table('legal_page_titles')->insert([
            'area'       => 'admin',
            'page_key'   => 'panel',
            'route_path' => '/admin',
            'title_i18n' => json_encode(['cz' => 'Administrace | Company name', 'en' => 'Administration | Company name']),
            'sort_order' => 10,
        ]);
    }
};
