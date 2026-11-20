<?php
/**
 * @file 2026_11_20_000004_maintenance_page_addresses.php
 * @path api/database/migrations/2026_11_20_000004_maintenance_page_addresses.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The maintenance pages moved into the address space of their application:
 *   web /web-maintenance → /maintenance, e-shop /shop-maintenance → /shop/maintenance (the project
 *   portal already has /projects/maintenance). Updates the informative address of their page
 *   titles (legal_page_titles.route_path, shown in the admin); the page keys stay.
 * @note Only rows that still carry the old address are changed (a missing row is skipped).
 * @dependencies legal_page_titles table.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @description area, page_key, old address, new address. */
    private const PAGES = [
        ['web', 'web-maintenance', '/web-maintenance', '/maintenance'],
        ['shop', 'shop-maintenance', '/shop-maintenance', '/shop/maintenance'],
    ];

    /**
     * @description Writes the new addresses.
     * @return void
     */
    public function up(): void
    {
        foreach (self::PAGES as [$area, $key, $old, $new]) {
            $this->move($area, $key, $old, $new);
        }
    }

    /**
     * @description Writes the old addresses back.
     * @return void
     */
    public function down(): void
    {
        foreach (self::PAGES as [$area, $key, $old, $new]) {
            $this->move($area, $key, $new, $old);
        }
    }

    /**
     * @description Changes the address of one page title if it still has the given one.
     * @param string $area Application area of the title.
     * @param string $key Page key.
     * @param string $from Current address.
     * @param string $to New address.
     * @return void
     */
    private function move(string $area, string $key, string $from, string $to): void
    {
        DB::table('legal_page_titles')
            ->where('area', $area)->where('page_key', $key)->where('route_path', $from)
            ->update(['route_path' => $to]);
    }
};
