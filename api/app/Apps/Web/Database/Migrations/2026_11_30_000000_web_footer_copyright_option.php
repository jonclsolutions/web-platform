<?php
/**
 * @file 2026_11_30_000000_web_footer_copyright_option.php
 * @path api/app/Apps/Web/Database/Migrations/2026_11_30_000000_web_footer_copyright_option.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Whether the footer of the public pages shows the copyright line (`footer.copyright_text`
 *   of the texts of the application) - new column `web_site_settings.show_footer_copyright`, on by default.
 *   The copyright text moved from the company profile (core) into the texts of the application;
 *   the switch is on the texts page of the application (2026-11).
 * @note down() drops the column.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds the switch (on).
     * @return void
     */
    public function up(): void
    {
        if (Schema::hasTable('web_site_settings') && !Schema::hasColumn('web_site_settings', 'show_footer_copyright')) {
            Schema::table('web_site_settings', function (Blueprint $table) {
                $table->boolean('show_footer_copyright')->default(true);
            });
        }
    }

    /**
     * @description Drops the switch.
     * @return void
     */
    public function down(): void
    {
        if (Schema::hasTable('web_site_settings') && Schema::hasColumn('web_site_settings', 'show_footer_copyright')) {
            Schema::table('web_site_settings', function (Blueprint $table) {
                $table->dropColumn('show_footer_copyright');
            });
        }
    }
};
