<?php

/**
 * @file PublicUrl.php
 * @path app/Support/Seo/PublicUrl.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Absolute address of a public page in a language (links in e-mails, the sitemap):
 * the frontend URL (FRONTEND_URL) + the language prefix + the path - `https://example.com/en/projects/…`.
 * @usage `PublicUrl::to('/projects/' . $token, $account->language)`.
 * @dependencies PublicLanguage, config('app.frontend_url').
 * @note Without a language the address has no prefix; the frontend then shows the page in the
 *   visitor's language (stored choice / browser) and writes the prefix into the address.
 */

namespace App\Support\Seo;

final class PublicUrl
{
    /**
     * @description Absolute address of a public page.
     * @param string $path Path without a language (`/tos`, `/projects/abc`).
     * @param string|null $language Translation code of the recipient (`cz`, `en`), null = none.
     * @return string e.g. `https://example.com/cs/tos`.
     */
    public static function to(string $path, ?string $language): string
    {
        $path = '/' . ltrim($path, '/');
        $base = rtrim((string) config('app.frontend_url', ''), '/');

        return $base . ($language ? PublicLanguage::path($path, $language) : $path);
    }
}
