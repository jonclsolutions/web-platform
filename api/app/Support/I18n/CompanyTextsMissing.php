<?php

/**
 * @file CompanyTextsMissing.php
 * @path app/Support/I18n/CompanyTextsMissing.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Texts of the company profile (core/settings, tab "Značka") missing in a language:
 *   the tagline is kept per language (SiteSetting::I18N_FIELDS); switched on, it must have a text
 *   in every language visitors
 *   may choose - otherwise the public pages show 'Cannot load text' in its place (no text of
 *   another language). Counted into the completeness of a language of every module (the website,
 *   the e-shop and the portal show them - LanguageCompleteness) and into the orange / grey
 *   notification of the company profile (CoreNotificationSource).
 * @note A switched-off field is not counted (the public pages do not show it). No company details
 *   row = nothing is shown = nothing missing.
 * @dependencies SiteSetting, TranslationController (languages of all modules)
 */

namespace App\Support\I18n;

use App\Http\Controllers\Api\TranslationController;
use App\Models\Legal\SiteSetting;

final class CompanyTextsMissing
{
    /**
     * @description Switched-on texts without a text in one language.
     * @param string $code Language code (switched on or off).
     * @param SiteSetting|null $settings Company details (null = the stored row).
     * @return int Missing texts (0 or 1 - the tagline).
     */
    public static function forLanguage(string $code, ?SiteSetting $settings = null): int
    {
        $settings ??= SiteSetting::query()->first();
        if (!$settings) {
            return 0;
        }
        $code = strtolower($code);

        $missing = 0;
        foreach (SiteSetting::I18N_FIELDS as $field => $column) {
            if ($settings->isFieldHidden($field)) {
                continue;
            }
            $texts = is_array($settings->{$column}) ? $settings->{$column} : [];
            if (trim((string) ($texts[$code] ?? '')) === '') {
                $missing++;
            }
        }

        return $missing;
    }

    /**
     * @description Missing texts per language - only the languages that miss something.
     * @param string[]|null $codes Languages to check; null = those switched on in any module (Czech always).
     * @return array<string, int> Language code => missing texts, e.g. ['de' => 2].
     */
    public static function byLanguage(?array $codes = null): array
    {
        $settings = SiteSetting::query()->first();
        if (!$settings) {
            return [];
        }

        $missing = [];
        foreach ($codes ?? TranslationController::activeLanguageCodesOfAll() as $code) {
            $count = self::forLanguage($code, $settings);
            if ($count > 0) {
                $missing[strtolower($code)] = $count;
            }
        }

        return $missing;
    }
}
