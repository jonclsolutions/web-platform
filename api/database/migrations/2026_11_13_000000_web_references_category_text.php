<?php
/**
 * @file 2026_11_13_000000_web_references_category_text.php
 * @path api/database/migrations/2026_11_13_000000_web_references_category_text.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The category ("Oblast") of a reference becomes free text per language
 *   (`category_i18n`, e.g. "Audit") instead of one of four fixed codes (web / desktop / mobile /
 *   ai). A stored code becomes the text of its former label in every language
 *   (storage/app/public/translations/web/{lang}.json, `projects.legend_{code}`; the Czech labels
 *   when a file has none).
 * @note During the unit tests the translation files are never read (the Czech labels are used).
 * @note down() goes back to the codes: a text equal to a former Czech label gets its code, any
 *   other text becomes 'web'.
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @description Former Czech labels of the codes (translations `projects.legend_{code}`). */
    private const CZECH_LABELS = [
        'web'     => 'Webový vývoj',
        'desktop' => 'Desktopový vývoj',
        'mobile'  => 'Mobilní vývoj',
        'ai'      => 'AI & automatizace',
    ];

    /**
     * @description Adds category_i18n, fills it from the codes and drops the code column.
     * @return void
     */
    public function up(): void
    {
        Schema::table('web_references', function (Blueprint $table) {
            $table->json('category_i18n')->nullable()->after('id')->comment('Category per language (free text, e.g. Audit)');
        });

        $labels = $this->labels();
        foreach (DB::table('web_references')->select('id', 'category')->get() as $row) {
            $code = (string) $row->category;
            $texts = [];
            foreach ($labels as $lang => $byCode) {
                if (($byCode[$code] ?? '') !== '') {
                    $texts[$lang] = $byCode[$code];
                }
            }
            if (!$texts && $code !== '') {
                $texts['cz'] = $code;
            }
            DB::table('web_references')->where('id', $row->id)
                ->update(['category_i18n' => json_encode((object) $texts, JSON_UNESCAPED_UNICODE)]);
        }

        Schema::table('web_references', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }

    /**
     * @description Back to the codes (see @note).
     * @return void
     */
    public function down(): void
    {
        Schema::table('web_references', function (Blueprint $table) {
            $table->string('category', 20)->default('web')->after('id')->comment('web | desktop | mobile | ai');
        });

        foreach (DB::table('web_references')->select('id', 'category_i18n')->get() as $row) {
            $text = json_decode((string) $row->category_i18n, true)['cz'] ?? '';
            $code = array_search($text, self::CZECH_LABELS, true) ?: 'web';
            DB::table('web_references')->where('id', $row->id)->update(['category' => $code]);
        }

        Schema::table('web_references', function (Blueprint $table) {
            $table->dropColumn('category_i18n');
        });
    }

    /**
     * @description Labels of the codes per language from the translation files of the website;
     *   Czech always present (its file, otherwise CZECH_LABELS).
     * @return array<string, array<string, string>> Language code => code => label.
     */
    private function labels(): array
    {
        $labels = [];
        $files = app()->runningUnitTests() ? [] : (glob(storage_path('app/public/translations/web') . '/*.json') ?: []);
        foreach ($files as $path) {
            $lang = strtolower(basename($path, '.json'));
            $data = json_decode((string) file_get_contents($path), true);
            if (!preg_match('/^[a-z]{2,5}(?:[-_][a-z0-9]{2,8})?$/', $lang) || !is_array($data)) {
                continue;
            }
            foreach (array_keys(self::CZECH_LABELS) as $code) {
                $label = $data['projects']["legend_{$code}"] ?? null;
                if (is_string($label) && trim(strip_tags($label)) !== '') {
                    $labels[$lang][$code] = mb_substr(trim(strip_tags($label)), 0, 80);
                }
            }
        }
        $labels['cz'] = ($labels['cz'] ?? []) + self::CZECH_LABELS;

        return $labels;
    }
};
