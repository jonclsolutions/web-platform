<?php
/**
 * @file 2026_11_20_000003_drop_maintenance_contact_text.php
 * @path api/database/migrations/2026_11_20_000003_drop_maintenance_contact_text.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The maintenance page shows the contacts without a heading. Removes the text
 *   `web_maintenance.contact` / `shop_maintenance.contact` from the translation files of every
 *   language (storage/app/public/translations/{web,shop}/{lang}.json) where an earlier version
 *   added it, so no unused text stays in the files.
 * @note During the unit tests the translation files are never read or changed.
 * @note down() does nothing - the text is not written back.
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /** @description Translation section of the maintenance page per module. */
    private const SECTIONS = ['web' => 'web_maintenance', 'shop' => 'shop_maintenance'];

    /**
     * @description Removes the unused text from every language file of the web and the e-shop.
     * @return void
     */
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        foreach (self::SECTIONS as $module => $section) {
            foreach (glob(storage_path("app/public/translations/{$module}") . '/*.json') ?: [] as $path) {
                $data = json_decode((string) file_get_contents($path), true);
                if (!is_array($data) || !is_array($data[$section] ?? null) || !array_key_exists('contact', $data[$section])) {
                    continue;
                }
                unset($data[$section]['contact']);
                // Same format as the admin writes the files (TranslationController).
                file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        }
    }

    /**
     * @description Nothing to undo.
     * @return void
     */
    public function down(): void
    {
    }
};
