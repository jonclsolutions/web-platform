<?php
/**
 * @file 2026_11_20_000001_drop_unused_knowledge_base_texts.php
 * @path api/app/Apps/Web/Database/Migrations/2026_11_20_000001_drop_unused_knowledge_base_texts.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Removes the last unused text of the knowledge base page from the translation files
 *   of the public website (storage/app/public/translations/web/{lang}.json): the "eyebrow" above
 *   the call to action (`knowledge-base.cta.eyebrow`) - the page never showed it. The texts that
 *   stay in the files are the ones the website uses: `knowledge-base.knowledge-base_footer` (footer
 *   and header link) and `knowledge-base.cta.text` / `.btn` (call to action); the content of the
 *   page is in the database (2026_11_20_000000_create_web_knowledge_base).
 * @note During the unit tests the translation files are never read or changed.
 * @note down() does nothing - the text is not written back.
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * @description Removes `knowledge-base.cta.eyebrow` from every translation file of the web.
     * @return void
     */
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        foreach (glob(storage_path('app/public/translations/web') . '/*.json') ?: [] as $path) {
            $data = json_decode((string) file_get_contents($path), true);
            if (!is_array($data) || !isset($data['knowledge-base']['cta']) || !is_array($data['knowledge-base']['cta'])
                || !array_key_exists('eyebrow', $data['knowledge-base']['cta'])) {
                continue;
            }
            unset($data['knowledge-base']['cta']['eyebrow']);
            // Same format as the admin writes the files (TranslationController).
            file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
    }

    /**
     * @description Nothing to undo (the text is not written back).
     * @return void
     */
    public function down(): void
    {
    }
};
