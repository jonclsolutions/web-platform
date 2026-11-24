<?php

/**
 * @file PublicSeoController.php
 * @path app/Http/Controllers/Api/PublicSeoController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description What search engines and the bare domain need from the server, outside the SPA:
 *   - `GET /`            → 302 to `/<language>` of the visitor (Accept-Language among the
 *                          languages of the application serving the root; no header = English);
 *   - `GET /robots.txt`  → crawling rules + the address of the sitemap;
 *   - `GET /sitemap.xml` → every public page of the available applications in every active
 *                          language, with hreflang alternates and x-default.
 *   The proxy (deploy/docker/Caddyfile) sends exactly these three paths here; routes/seo.php,
 *   without the `api` prefix and without the session middleware (no cookie).
 * @dependencies AppRegistry (applications: servesSiteRoot, sitemapPaths, availability),
 *   TranslationController::activeLanguageCodes(), PublicLanguage, config('app.frontend_url').
 * @note The root redirect is temporary (302) and varies by Accept-Language: it depends on the
 *   visitor. A concrete address is never redirected by language - only the frontend shows a
 *   one-time offer of the visitor's language. Location is relative (`/en`), so the redirect also
 *   works on the internal door of the proxy (healthcheck, smoke test) before DNS points here.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Apps\AppManifest;
use App\Support\Apps\AppRegistry;
use App\Support\Seo\PublicLanguage;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PublicSeoController extends Controller
{
    /** @description Paths search engines should not crawl (private links, sign-in, utility pages). */
    private const DISALLOWED = ['/admin', '/auth/', '/*/projects/', '/*/maintenance', '/*/shop/cart', '/*/shop/checkout'];

    /**
     * @description The bare domain: the home page in the visitor's language. The query string is
     *   kept (campaign parameters such as utm_source reach the page).
     * @param Request $request Request (Accept-Language).
     * @return Response 302 to `/<language>[?query]` (or `/admin` when no application serves the root).
     */
    public function root(Request $request): Response
    {
        $app = $this->rootApp();
        if ($app === null) {
            return $this->redirect('/admin');
        }
        $language = PublicLanguage::pick(TranslationController::activeLanguageCodes($app->id()), $request->header('Accept-Language'));
        $query = $request->getQueryString();

        return $this->redirect(PublicLanguage::path('/', $language) . ($query ? '?' . $query : ''))
            ->header('Vary', 'Accept-Language');
    }

    /**
     * @description Crawling rules: everything except the private / utility pages; the sitemap.
     * @return Response text/plain.
     * @note The API (`/api/…`) stays allowed - search engines render the pages with its data.
     */
    public function robots(): Response
    {
        $lines = ['User-agent: *'];
        foreach (self::DISALLOWED as $path) {
            $lines[] = 'Disallow: ' . $path;
        }
        $lines[] = '';
        $lines[] = 'Sitemap: ' . $this->base() . '/sitemap.xml';

        return response(implode("\n", $lines) . "\n", 200, [
            'Content-Type'  => 'text/plain; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    /**
     * @description Sitemap: one `<url>` per page and language; each lists the page in every
     *   language of its application (hreflang) and the x-default (English or the first language).
     * @return Response application/xml.
     */
    public function sitemap(): Response
    {
        $base = $this->base();
        $xml = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];

        foreach (AppRegistry::apps() as $app) {
            if ($app->availability()?->active === false) {
                continue;
            }
            $paths = $app->sitemapPaths();
            $languages = $paths === [] ? [] : TranslationController::activeLanguageCodes($app->id());
            $fallback = PublicLanguage::fallback($languages);
            foreach ($paths as $path) {
                $alternates = [];
                foreach ($languages as $language) {
                    $alternates[] = $this->alternate(PublicLanguage::urlCode($language), $base . PublicLanguage::path($path, $language));
                }
                if ($fallback !== null) {
                    $alternates[] = $this->alternate('x-default', $base . PublicLanguage::path($path, $fallback));
                }
                foreach ($languages as $language) {
                    $xml[] = '  <url>';
                    $xml[] = '    <loc>' . $this->escape($base . PublicLanguage::path($path, $language)) . '</loc>';
                    array_push($xml, ...$alternates);
                    $xml[] = '  </url>';
                }
            }
        }
        $xml[] = '</urlset>';

        return response(implode("\n", $xml) . "\n", 200, [
            'Content-Type'  => 'application/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    /**
     * @description The application whose home page is the root of the site.
     * @return AppManifest|null
     */
    private function rootApp(): ?AppManifest
    {
        foreach (AppRegistry::apps() as $app) {
            if ($app->servesSiteRoot()) {
                return $app;
            }
        }

        return null;
    }

    /**
     * @description A temporary redirect to a path of this site, never cached by shared caches.
     * @param string $path Target path.
     * @return Response 302 with a relative Location.
     */
    private function redirect(string $path): Response
    {
        return response('', 302, ['Location' => $path, 'Cache-Control' => 'private, no-cache']);
    }

    /**
     * @description Address of the public site (FRONTEND_URL) without the trailing slash.
     * @return string e.g. `https://example.com`.
     */
    private function base(): string
    {
        return rtrim((string) config('app.frontend_url', ''), '/');
    }

    /**
     * @description One hreflang alternate of a sitemap entry.
     * @param string $hreflang `cs`, `en`, `x-default`.
     * @param string $href Absolute address.
     * @return string The `<xhtml:link>` line.
     */
    private function alternate(string $hreflang, string $href): string
    {
        return '    <xhtml:link rel="alternate" hreflang="' . $this->escape($hreflang) . '" href="' . $this->escape($href) . '"/>';
    }

    /**
     * @description XML escaping of a value.
     * @param string $value Text.
     * @return string Escaped text.
     */
    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
