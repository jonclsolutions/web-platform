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
 * @note forget() removes a deleted language from such columns (nothing of a language that no
 * longer exists stays on the server).
 * @dependencies Illuminate\Database\Eloquent\Model (forget)
 */

namespace App\Support\I18n;

use Illuminate\Database\Eloquent\Model;

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

    /**
     * @description Removes the texts of a deleted language from the per-language columns of one
     *   record and saves it when something changed.
     * @param Model $record Record with `*_i18n` array columns (cast to array).
     * @param string[] $columns Its columns stored per language.
     * @param string $code Language code of the deleted language.
     * @return bool Whether the record changed.
     */
    public static function forget(Model $record, array $columns, string $code): bool
    {
        $code = strtolower($code);
        $dirty = false;
        foreach ($columns as $column) {
            $texts = $record->{$column};
            if (is_array($texts) && array_key_exists($code, $texts)) {
                unset($texts[$code]);
                $record->{$column} = $texts;
                $dirty = true;
            }
        }
        if ($dirty) {
            $record->save();
        }

        return $dirty;
    }
}
