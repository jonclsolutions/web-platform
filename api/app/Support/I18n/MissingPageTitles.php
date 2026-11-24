<?php

/**
 * @file MissingPageTitles.php
 * @path app/Support/I18n/MissingPageTitles.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page titles (browser tab, title in search results - legal_page_titles) missing in
 * the active languages of an area (web, shop …): every page of the area must have a non-empty
 * title in every active language; Czech too. Without it the visitor sees the title of another
 * language (Czech) - so the admin is told (orange dot of the text editor page, the count of its
 * "Názvy stránek" tab), the same way as missing texts (MissingTranslations).
 * @note Inactive languages are not counted - visitors cannot switch to them.
 * @dependencies PageTitle, TranslationController::activeLanguageCodes()
 */

namespace App\Support\I18n;

use App\Http\Controllers\Api\TranslationController;
use App\Models\Legal\PageTitle;

final class MissingPageTitles
{
    /**
     * @description Pages without a title per active language of an area - only the languages
     *   that miss something.
     * @param string $area Area of the pages (= translation module, e.g. 'web').
     * @return array<string, int> Language code => pages without a title, e.g. ['de' => 12].
     */
    public static function byLanguage(string $area): array
    {
        $titles = PageTitle::query()->where('area', $area)->pluck('title_i18n')
            ->map(fn ($value) => is_array($value) ? $value : []);
        if ($titles->isEmpty()) {
            return [];
        }

        $missing = [];
        foreach (TranslationController::activeLanguageCodes($area) as $code) {
            $code = strtolower($code);
            $count = $titles->filter(fn (array $title) => trim((string) ($title[$code] ?? '')) === '')->count();
            if ($count > 0) {
                $missing[$code] = $count;
            }
        }

        return $missing;
    }
}
