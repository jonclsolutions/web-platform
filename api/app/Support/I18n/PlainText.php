<?php

/**
 * @file PlainText.php
 * @path app/Support/I18n/PlainText.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Texts of the translations are plain text: a line break is a new line ("\n"), a new
 * paragraph an empty line ("\n\n"); the website writes them as text, never as HTML. This turns the
 * HTML of older texts into that form - `<br>` → new line, a paragraph `<p>…</p>` → its text with an
 * empty line between paragraphs - and removes any other tag, so no markup can get to a page
 * through a text edited in the admin or an uploaded JSON.
 * @usage PlainText::tree($data) before saving translations (TranslationController::save);
 *   PlainText::fromHtml() when saving the content of a legal document (DocumentSection) and the
 *   descriptions of a product (ShopProduct); the migration 2026_11_28_000000_plain_text_content
 *   of the stored texts.
 * @note Only tags are removed (`<` followed by a letter or `/` and a letter, up to `>`); a lone
 *   "<" or "a < b" in a text stays as it is. Entities are not decoded (`&amp;` stays) - the page
 *   escapes the text itself.
 * @dependencies none
 */

namespace App\Support\I18n;

final class PlainText
{
    /**
     * @description One text without HTML.
     * @param string $text Text (possibly with `<br>`, `<p>`, other tags).
     * @return string Plain text with "\n" line breaks.
     */
    public static function fromHtml(string $text): string
    {
        if (!str_contains($text, '<')) {
            return $text;
        }
        $text = preg_replace('#<br\s*/?>#i', "\n", $text);
        $text = preg_replace('#</p>\s*<p(?:\s[^<>]*)?>#i', "\n\n", $text);
        $text = preg_replace('#</?[a-zA-Z][^<>]*>#', '', $text);

        return trim($text, "\n");
    }

    /**
     * @description Every text of a translation tree without HTML (keys and non-text values stay).
     * @param array<array-key, mixed> $data Translations (nested groups / lists).
     * @return array<array-key, mixed>
     */
    public static function tree(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = self::tree($value);
            } elseif (is_string($value)) {
                $data[$key] = self::fromHtml($value);
            }
        }

        return $data;
    }
}
