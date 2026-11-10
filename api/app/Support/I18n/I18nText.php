<?php

/**
 * @file I18nText.php
 * @path app/Support/I18n/I18nText.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Clean-up of a text stored per language (`{ "cz": "...", "en": "..." }`, JSON
 * columns `*_i18n`) that the admin sends: only valid language codes, plain text (tags removed),
 * trimmed, limited in length; single-line texts get their whitespace collapsed, multi-line texts
 * keep their line breaks (the public page shows them as they are - never as HTML).
 * @note Empty values are left out: "no text in this language" is the absence of the key, so the
 * admin can count the missing translations and the public page can show its placeholder.
 * @dependencies none
 */

namespace App\Support\I18n;

final class I18nText
{
    /** @description Allowed language code (`cz`, `en`, `pt-br` ...), the same rule as the page titles. */
    public const LANG_PATTERN = '/^[a-z]{2,5}(?:[-_][a-z0-9]{2,8})?$/i';

    /** @description At most this many languages per text (protection against oversized payloads). */
    public const MAX_LANGUAGES = 20;

    /**
     * @description Cleans one text per language.
     * @param mixed $raw Value of the request (expected `{ lang: string }`; anything else = no text).
     * @param int $maxLength Maximum characters per language.
     * @param bool $multiline Keep line breaks (otherwise all whitespace becomes one space).
     * @param string[]|null $languages Allowed language codes (lower case); null = any valid code.
     *   Texts of other languages are dropped (e.g. of a language deleted meanwhile).
     * @return array<string, string> Language code (lower case) => text; empty texts left out.
     */
    public static function clean(mixed $raw, int $maxLength, bool $multiline = false, ?array $languages = null): array
    {
        if (!is_array($raw)) {
            return [];
        }

        $clean = [];
        foreach (array_slice($raw, 0, self::MAX_LANGUAGES, true) as $lang => $value) {
            if (!is_string($lang) || !preg_match(self::LANG_PATTERN, $lang) || !is_string($value)
                || ($languages !== null && !in_array(strtolower($lang), $languages, true))) {
                continue;
            }

            $text = strip_tags($value);
            if ($multiline) {
                $text = str_replace(["\r\n", "\r"], "\n", $text);
                $text = preg_replace('/[^\S\n]+/u', ' ', $text);
                $text = preg_replace('/ *\n */u', "\n", $text);
                $text = preg_replace('/\n{3,}/u', "\n\n", $text);
            } else {
                $text = preg_replace('/\s+/u', ' ', $text);
            }
            $text = trim(mb_substr(trim((string) $text), 0, $maxLength));

            if ($text !== '') {
                $clean[strtolower($lang)] = $text;
            }
        }

        return $clean;
    }

    /**
     * @description Validation rules of one `*_i18n` field of a request (shape and length; the
     *   content is cleaned by clean() afterwards).
     * @param string $field Field path, e.g. 'categories.*.name_i18n'.
     * @param int $maxLength Maximum characters per language.
     * @return array<string, array<int, string>>
     */
    public static function rules(string $field, int $maxLength): array
    {
        return [
            $field        => ['present', 'array', 'max:' . self::MAX_LANGUAGES],
            "{$field}.*"  => ['nullable', 'string', 'max:' . $maxLength],
        ];
    }
}
