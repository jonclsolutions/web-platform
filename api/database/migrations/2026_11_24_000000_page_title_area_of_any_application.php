<?php
/**
 * @file 2026_11_24_000000_page_title_area_of_any_application.php
 * @path api/database/migrations/2026_11_24_000000_page_title_area_of_any_application.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The area of a browser tab title (`legal_page_titles.area`) is `admin` or the id of
 *   any application with public pages (web, shop, project-portal, a new one), so the fixed list
 *   ENUM('web','shop','admin') becomes a plain string. Rows stay unchanged.
 * @note down() restores the ENUM; rows of other areas must be removed before.
 * @dependencies legal_page_titles
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * @description Changes the area column to VARCHAR(32) (MySQL / MariaDB; SQLite has no ENUM).
     * @return void
     */
    public function up(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE `legal_page_titles` MODIFY `area` VARCHAR(32) NOT NULL COMMENT 'admin = administration, else the id of the application (web, shop, project-portal …)'");
        }
    }

    /**
     * @description Restores ENUM('web','shop','admin').
     * @return void
     */
    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE `legal_page_titles` MODIFY `area` ENUM('web','shop','admin') NOT NULL COMMENT 'web = public website, shop = e-shop, admin = administration'");
        }
    }
};
