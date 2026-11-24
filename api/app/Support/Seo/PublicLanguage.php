<?php

/**
 * @file PublicLanguage.php
 * @path app/Support/Seo/PublicLanguage.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Languages of the public pages in their URLs (`/cs/services`, `/en/shop/…`) - the
 * same rules as the frontend (erp/src/app/shared/utils/language-url.ts, language-preference.ts):
 * Czech is `cz` in the translations and `cs` in a URL / hreflang; the language of a visitor is the
 * first language of the browser (Accept-Language, by weight) the area offers, otherwise English,
 * otherwise the first offered language.
 * @usage `PublicLanguage::urlCode('cz')` → 'cs'; `PublicLanguage::pick(['cz', 'en'], 'cs-CZ,cs;q=0.9')`
 *   → 'cz'; `PublicLanguage::path('/services', 'cz')` → '/cs/services'.
 * @dependencies none
 */

namespace App\Support\Seo;

final class PublicLanguage
{
    /** @description Language of a visitor whose browser prefers none of the offered languages. */
    public const DEFAULT = 'en';

    /** @description Translation code → code in a URL / hreflang where they differ. */
    private const URL_CODE_OF = ['cz' => 'cs'];

    /** @description Browser / URL code → translation code where they differ. */
    private const CODE_OF = ['cs' => 'cz'];

    /**
     * @description Code of a language in a URL and in hreflang.
     * @param string $code Translation code (`cz`, `en`, `pt-br`).
     * @return string Lower-case URL code (`cs`, `en`, `pt-br`).
     */
    public static function urlCode(string $code): string
    {
        $lower = strtolower($code);

        return self::URL_CODE_OF[$lower] ?? $lower;
    }

    /**
     * @description Translation code of a browser language tag (primary subtag; `cs` → `cz`).
     * @param string $tag BCP 47 tag (`cs-CZ`, `en`, `de_AT`).
     * @return string Translation code ('' for an empty tag).
     */
    public static function codeOfTag(string $tag): string
    {
        $primary = strtolower(preg_split('/[-_]/', trim($tag))[0] ?? '');

        return self::CODE_OF[$primary] ?? $primary;
    }

    /**
     * @description Browser languages of an Accept-Language header, best first (q-values; equal
     *   weights keep their order; `*` and q=0 are left out).
     * @param string|null $header Accept-Language header.
     * @return array<int, string> Tags, e.g. ['cs-CZ', 'cs', 'en'].
     */
    public static function acceptedTags(?string $header): array
    {
        $tags = [];
        foreach (explode(',', (string) $header) as $index => $part) {
            $pieces = array_map('trim', explode(';', $part));
            $tag = $pieces[0] ?? '';
            if ($tag === '' || $tag === '*' || strlen($tag) > 35) {
                continue;
            }
            $quality = 1.0;
            foreach (array_slice($pieces, 1) as $parameter) {
                if (preg_match('/^q=([0-9.]+)$/i', $parameter, $match)) {
                    $quality = (float) $match[1];
                }
            }
            if ($quality > 0) {
                $tags[] = ['tag' => $tag, 'q' => $quality, 'i' => $index];
            }
        }
        usort($tags, fn (array $a, array $b) => [$b['q'], $a['i']] <=> [$a['q'], $b['i']]);

        return array_column($tags, 'tag');
    }

    /**
     * @description Language of a visitor: the first browser language offered, else English, else
     *   the first offered language (English when nothing is offered).
     * @param array<int, string> $available Translation codes of the active languages.
     * @param string|null $acceptLanguage Accept-Language header.
     * @return string A translation code (spelling of $available).
     */
    public static function pick(array $available, ?string $acceptLanguage): string
    {
        $offered = array_map('strtolower', $available);
        foreach (self::acceptedTags($acceptLanguage) as $tag) {
            $index = array_search(self::codeOfTag($tag), $offered, true);
            if ($index !== false) {
                return $available[$index];
            }
        }
        $english = array_search(self::DEFAULT, $offered, true);

        return $english !== false ? $available[$english] : ($available[0] ?? self::DEFAULT);
    }

    /**
     * @description Language of the `x-default` alternate (visitors of no listed language):
     *   English when offered, otherwise the first offered language.
     * @param array<int, string> $available Translation codes of the active languages.
     * @return string|null Translation code, null without languages.
     */
    public static function fallback(array $available): ?string
    {
        if ($available === []) {
            return null;
        }

        return self::pick($available, null);
    }

    /**
     * @description A public path with its language prefix.
     * @param string $path Path without a language (`/`, `/services`, `/shop/products/x`).
     * @param string $code Translation code.
     * @return string `/cs`, `/cs/services` (the root without a trailing slash, like the frontend).
     */
    public static function path(string $path, string $code): string
    {
        $path = '/' . ltrim($path, '/');

        return '/' . self::urlCode($code) . ($path === '/' ? '' : $path);
    }
}
