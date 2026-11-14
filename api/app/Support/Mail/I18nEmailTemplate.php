<?php

/**
 * @file I18nEmailTemplate.php
 * @path app/Support/Mail/I18nEmailTemplate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared fallback of the confirmation e-mail templates editable per language in the
 * admin (`*_email_*_i18n` columns of the settings of an application): the text of the record's language, otherwise the
 * Czech text (fallback language), otherwise the built-in default - never an empty text. Extended by
 * the template classes of the applications (inquiries, orders, e-shop orders).
 * @dependencies none
 */

namespace App\Support\Mail;

abstract class I18nEmailTemplate
{
    /**
     * @description First non-empty value of `$i18n[$lang]`, `$i18n['cz']`, `$default` (subject /
     * title / intro / outro - flat i18n arrays keyed by the language).
     * @param array<string, string|null> $i18n Texts per language.
     * @param string $lang Language of the record.
     * @param string $default Built-in text.
     * @return string
     */
    protected static function resolve(array $i18n, string $lang, string $default): string
    {
        $candidate = $i18n[$lang] ?? $i18n['cz'] ?? null;
        return ($candidate !== null && trim($candidate) !== '') ? $candidate : $default;
    }

    /**
     * @description Same fallback as `resolve()` for the nested `*_labels_i18n[language][key]` -
     * `$forLang` / `$forCz` are the sub-objects of the language and of 'cz'.
     * @param array<string, string|null> $forLang Labels of the language.
     * @param array<string, string|null> $forCz Labels of 'cz'.
     * @param string $key Label key.
     * @param string $default Built-in text.
     * @return string
     */
    protected static function resolveLabel(array $forLang, array $forCz, string $key, string $default): string
    {
        $candidate = $forLang[$key] ?? $forCz[$key] ?? null;
        return ($candidate !== null && trim($candidate) !== '') ? $candidate : $default;
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
