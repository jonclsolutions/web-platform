<?php

/**
 * @file I18nEmailTemplate.php
 * @path app/Support/Mail/I18nEmailTemplate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared fallback of the confirmation e-mail templates editable per language in the
 * admin (`<PREFIX>_*_i18n` columns of the settings of an application): the text of the record's
 * language, otherwise the Czech text (Czech = the default language, it must be filled in
 * completely), otherwise the built-in Czech default (DEFAULTS - only for a text the admin could
 * not fill in yet, e.g. a field added by an update) - never an empty text and never another
 * language than the customer's or Czech. Extended by the template classes of the applications
 * (inquiries, orders, e-shop orders), which define PREFIX and DEFAULTS.
 * @note A template is saved only with every Czech text filled in (missingDefaults() → 422 in
 *   the controllers); the admin lists the texts missing per language (missingByLanguage() - the
 *   `missing` of the template API; countsByLanguage() - the attention kinds behind the dots of the
 *   menu tree and of the Actions menu); a language
 *   is switched on only with its e-mail complete (missingIn() in AppManifest::contentMissing()).
 * @dependencies MissingTranslations::PRIMARY (the default language)
 */

namespace App\Support\Mail;

use App\Support\I18n\MissingTranslations;

abstract class I18nEmailTemplate
{
    /** @description Column prefix of the template, e.g. 'raw_request_email' (set by the subclass). */
    public const PREFIX = '';

    /**
     * @description Built-in Czech texts by key (set by the subclass): the flat texts (FLAT) and
     *   the labels of `<PREFIX>_labels_i18n`. Every key is a text of the template.
     */
    public const DEFAULTS = [];

    /** @description Keys of DEFAULTS stored as flat columns `<PREFIX>_<key>_i18n` - the rest are labels. */
    public const FLAT = ['subject', 'title', 'intro', 'outro'];

    /** @description Message of the refused save (Czech texts missing). */
    public const MISSING_MESSAGE = 'The Czech texts of the e-mail must be filled in completely - Czech is the default language.';

    /**
     * @description First non-empty value of `$i18n[$lang]`, `$i18n['cz']`, `$default` (subject /
     * title / intro / outro - flat i18n arrays keyed by the language). An empty text of the
     * language falls back to Czech too (not only a missing one).
     * @param array<string, string|null> $i18n Texts per language.
     * @param string $lang Language of the record.
     * @param string $default Built-in Czech text.
     * @return string
     */
    protected static function resolve(array $i18n, string $lang, string $default): string
    {
        foreach ([$lang, MissingTranslations::PRIMARY] as $code) {
            $candidate = $i18n[$code] ?? null;
            if (is_string($candidate) && trim($candidate) !== '') {
                return $candidate;
            }
        }

        return $default;
    }

    /**
     * @description Same fallback as `resolve()` for the nested `*_labels_i18n[language][key]` -
     * `$forLang` / `$forCz` are the sub-objects of the language and of 'cz'.
     * @param array<string, string|null> $forLang Labels of the language.
     * @param array<string, string|null> $forCz Labels of 'cz'.
     * @param string $key Label key.
     * @param string $default Built-in Czech text.
     * @return string
     */
    protected static function resolveLabel(array $forLang, array $forCz, string $key, string $default): string
    {
        foreach ([$forLang, $forCz] as $labels) {
            $candidate = $labels[$key] ?? null;
            if (is_string($candidate) && trim($candidate) !== '') {
                return $candidate;
            }
        }

        return $default;
    }

    /**
     * @description Keys of DEFAULTS whose text is empty in a language of the stored template.
     * @param object $settings Settings row with the `<PREFIX>_*_i18n` attributes (model or object).
     * @param string $lang Language code.
     * @return string[] Missing keys in the order of DEFAULTS.
     */
    public static function missingIn(object $settings, string $lang): array
    {
        $labels = static::textMap($settings->{static::PREFIX . '_labels_i18n'} ?? null);
        $forLang = static::textMap($labels[$lang] ?? null);
        $missing = [];
        foreach (array_keys(static::DEFAULTS) as $key) {
            $text = in_array($key, self::FLAT, true)
                ? (static::textMap($settings->{static::PREFIX . "_{$key}_i18n"} ?? null)[$lang] ?? null)
                : ($forLang[$key] ?? null);
            if (!is_string($text) || trim($text) === '') {
                $missing[] = $key;
            }
        }

        return $missing;
    }

    /**
     * @description Czech texts missing in the template - a template is saved only without them.
     * @param object $settings Settings row (after the request was applied, before the save).
     * @return string[]
     */
    public static function missingDefaults(object $settings): array
    {
        return static::missingIn($settings, MissingTranslations::PRIMARY);
    }

    /**
     * @description Missing texts of the given languages (Czech always included) - only languages
     *   with something missing are listed.
     * @param object|null $settings Settings row (null = nothing stored yet: everything missing).
     * @param string[] $languages Language codes (the active languages of the application).
     * @return array<string, string[]> Language → missing keys.
     */
    public static function missingByLanguage(?object $settings, array $languages): array
    {
        $settings ??= new \stdClass();
        $result = [];
        foreach (array_unique(array_merge([MissingTranslations::PRIMARY], array_map('strtolower', $languages))) as $lang) {
            $missing = static::missingIn($settings, $lang);
            if ($missing !== []) {
                $result[$lang] = $missing;
            }
        }

        return $result;
    }

    /**
     * @description Number of missing texts per given language (the attention kinds of the menu:
     *   the active languages + Czech for the orange dot, the switched off ones for the grey one).
     * @param object|null $settings Settings row (null = nothing stored yet).
     * @param string[] $languages Language codes.
     * @return array<string, int> Language → missing texts, only languages missing something.
     */
    public static function countsByLanguage(?object $settings, array $languages): array
    {
        $settings ??= new \stdClass();
        $counts = [];
        foreach (array_unique(array_map('strtolower', $languages)) as $lang) {
            $count = count(static::missingIn($settings, $lang));
            if ($count > 0) {
                $counts[$lang] = $count;
            }
        }

        return $counts;
    }

    /**
     * @description Fills the empty Czech texts of a template with DEFAULTS (migrations of an
     *   existing installation; texts of other languages and filled texts stay).
     * @param object $settings Settings row - changed in place.
     * @return bool Something was filled in.
     */
    public static function completeDefaults(object $settings): bool
    {
        $primary = MissingTranslations::PRIMARY;
        $missing = static::missingDefaults($settings);
        if ($missing === []) {
            return false;
        }
        $labelsColumn = static::PREFIX . '_labels_i18n';
        $labels = static::textMap($settings->{$labelsColumn} ?? null);
        $czLabels = static::textMap($labels[$primary] ?? null);
        foreach ($missing as $key) {
            if (in_array($key, self::FLAT, true)) {
                $column = static::PREFIX . "_{$key}_i18n";
                $texts = static::textMap($settings->{$column} ?? null);
                $texts[$primary] = static::DEFAULTS[$key];
                $settings->{$column} = $texts;
            } else {
                $czLabels[$key] = static::DEFAULTS[$key];
            }
        }
        if (array_diff($missing, self::FLAT) !== []) {
            $labels[$primary] = $czLabels;
            $settings->{$labelsColumn} = $labels;
        }

        return true;
    }

    /**
     * @description A stored text map as an array ([] for anything else - null, a string, a JSON
     *   string of an object read without the cast is decoded).
     * @param mixed $value Stored value.
     * @return array<string, mixed>
     */
    protected static function textMap(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        return is_array($value) ? $value : [];
    }

    /**
     * @description `lang` attribute of the e-mail's `<html>` (BCP 47): the application calls
     * Czech 'cz', the standard code is 'cs'.
     * @param string $lang Language of the record.
     * @return string
     */
    public static function htmlLang(string $lang): string
    {
        return $lang === 'cz' ? 'cs' : $lang;
    }
}
