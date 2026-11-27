<?php

/**
 * @file LanguageCompleteness.php
 * @path app/Support/I18n/LanguageCompleteness.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description What a language of a translation module still lacks: its texts (against Czech),
 *   the titles of the pages of the area and the content of the applications using the
 *   languages of the module (FAQ, positions…, the texts of the confirmation e-mails -
 *   AppManifest::contentMissing()) and the texts of the company profile shown on the public pages
 *   of every module (the tagline - CompanyTextsMissing). A language other
 *   than Czech may be switched on only when it lacks nothing (TranslationController::saveLanguages):
 *   a visitor never gets a half translated language - a text missing later (after an update of
 *   the application) shows 'Cannot load text' and the admin is told (orange dot).
 * @usage `LanguageCompleteness::missing('web', 'de')` → ['texts' => 12, 'page_titles' => 3, 'faq' => 1]
 * @dependencies MissingTranslations, MissingPageTitles, CompanyTextsMissing, AppRegistry
 */

namespace App\Support\I18n;

use App\Support\Apps\AppRegistry;

final class LanguageCompleteness
{
    /**
     * @description What a language lacks, per part.
     * @param string $module Translation module (= area of its pages).
     * @param string $code Language code.
     * @return array<string, int> Part (`texts`, `page_titles`, `company_texts`, parts of the content) => count;
     *   only the parts that lack something - [] when the language is complete.
     */
    public static function missing(string $module, string $code): array
    {
        $parts = [
            'texts'       => MissingTranslations::forLanguage($module, $code),
            'page_titles' => MissingPageTitles::forLanguage($module, $code),
            // the company profile texts are on the public pages of every module
            'company_texts' => CompanyTextsMissing::forLanguage($code),
        ];
        foreach (AppRegistry::apps() as $app) {
            if ($app->languageModule() !== $module) {
                continue;
            }
            foreach ($app->contentMissing($code) as $part => $count) {
                $parts[$part] = ($parts[$part] ?? 0) + (int) $count;
            }
        }

        return array_filter($parts, fn (int $count) => $count > 0);
    }
}
