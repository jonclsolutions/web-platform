<?php
/**
 * @file 2026_11_20_000005_drop_maintenance_button_texts.php
 * @path api/database/migrations/2026_11_20_000005_drop_maintenance_button_texts.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The maintenance pages of the web and the e-shop have no button any more. Removes
 *   their unused texts from the translation files of every language
 *   (storage/app/public/translations/{web,shop}/{lang}.json): `web_maintenance.retry` ("Try
 *   again") and `shop_maintenance.back_home` ("Back to the website").
 * @note During the unit tests the translation files are never read or changed.
 * @note down() does nothing - the texts are not written back.
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /** @description Module => [translation section, removed key]. */
    private const TEXTS = [
        'web' => ['web_maintenance', 'retry'],
        'shop' => ['shop_maintenance', 'back_home'],
    ];

    /**
     * @description Removes the unused texts from every language file of the web and the e-shop.
     * @return void
     */
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        foreach (self::TEXTS as $module => [$section, $key]) {
            foreach (glob(storage_path("app/public/translations/{$module}") . '/*.json') ?: [] as $path) {
                $data = json_decode((string) file_get_contents($path), true);
                if (!is_array($data) || !is_array($data[$section] ?? null) || !array_key_exists($key, $data[$section])) {
                    continue;
                }
                unset($data[$section][$key]);
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
