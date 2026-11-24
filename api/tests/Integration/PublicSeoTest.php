<?php

/**
 * @file PublicSeoTest.php
 * @path api/tests/Integration/PublicSeoTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the routes for search engines (PublicSeoController, routes/seo.php):
 *   the bare domain redirects to the visitor's language (Accept-Language, English for robots,
 *   no cookie), robots.txt (private pages disallowed, API allowed, sitemap address), and the
 *   sitemap - web and e-shop pages in every active language with hreflang + x-default, active
 *   jobs and products only, nothing of an application in maintenance.
 * @dependencies Tests\TestCase; a temporary storage folder with translations/languages.json;
 *   WebJob, ShopCategory, ShopProduct, WebSiteSetting, ShopSiteSetting.
 */

namespace Tests\Integration;

use App\Apps\Shop\Models\ShopCategory;
use App\Apps\Shop\Models\ShopProduct;
use App\Apps\Shop\Models\ShopSiteSetting;
use App\Apps\Web\Models\WebJob;
use App\Apps\Web\Models\WebSiteSetting;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class PublicSeoTest extends TestCase
{
    /** @var string Temporary storage folder (languages.json is a real file). */
    private string $storage;

    /**
     * @description Temporary storage with languages: web cz + en (active), de (inactive); shop cz + en.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->storage = sys_get_temp_dir() . '/jsw-seo-' . uniqid();
        File::makeDirectory($this->storage . '/app/public/translations', 0755, true);
        $this->app->useStoragePath($this->storage);
        $languages = [];
        foreach (['web' => ['cz' => true, 'en' => true, 'de' => false], 'shop' => ['cz' => true, 'en' => true]] as $module => $codes) {
            foreach ($codes as $code => $active) {
                $languages[] = ['code' => $code, 'module' => $module, 'name' => $code, 'active' => $active];
            }
        }
        File::put($this->storage . '/app/public/translations/languages.json', json_encode($languages));
        config(['app.frontend_url' => 'https://example.com/']);
    }

    /**
     * @description Removes the temporary storage folder.
     * @return void
     */
    protected function tearDown(): void
    {
        File::deleteDirectory($this->storage);
        parent::tearDown();
    }

    /**
     * @description The bare domain: a Czech browser → /cs, an English one / a robot → /en, German
     *   (inactive) → English; temporary, varies by language, relative Location, no cookie.
     * @input GET / with Accept-Language 'cs-CZ,cs;q=0.9,en;q=0.8'; 'en-US'; none; 'de-DE';
     *   GET /?utm_source=news&utm_medium=email in Czech.
     * @output 302 /cs (Vary Accept-Language, no Set-Cookie); /en; /en; /en; the query kept:
     *   /cs?utm_medium=email&utm_source=news (normalized order).
     */
    public function test_root_redirects_to_the_language_of_the_visitor(): void
    {
        $czech = $this->get('/', ['Accept-Language' => 'cs-CZ,cs;q=0.9,en;q=0.8']);
        $czech->assertStatus(302);
        $this->assertSame('/cs', $czech->headers->get('Location'));
        $this->assertStringContainsString('Accept-Language', (string) $czech->headers->get('Vary'));
        $this->assertSame([], $czech->headers->getCookies());

        $this->assertSame('/en', $this->get('/', ['Accept-Language' => 'en-US'])->headers->get('Location'));
        $this->assertSame('/en', $this->get('/')->headers->get('Location'));
        $this->assertSame('/en', $this->get('/', ['Accept-Language' => 'de-DE'])->headers->get('Location'));
        $this->assertSame('/cs?utm_medium=email&utm_source=news',
            $this->get('/?utm_source=news&utm_medium=email', ['Accept-Language' => 'cs'])->headers->get('Location'));
    }

    /**
     * @description robots.txt: admin, sign-in, portal, maintenance, cart and checkout disallowed;
     *   the API is not (search engines render the pages with it); the sitemap address.
     * @input GET /robots.txt.
     * @output 200 text/plain with the Disallow lines, no 'Disallow: /api', Sitemap https://example.com/sitemap.xml.
     */
    public function test_robots(): void
    {
        $response = $this->get('/robots.txt')->assertOk();
        $this->assertStringStartsWith('text/plain', (string) $response->headers->get('Content-Type'));
        $text = $response->getContent();
        foreach (['User-agent: *', 'Disallow: /admin', 'Disallow: /auth/', 'Disallow: /*/projects/', 'Disallow: /*/shop/checkout',
            'Sitemap: https://example.com/sitemap.xml'] as $line) {
            $this->assertStringContainsString($line, $text);
        }
        $this->assertStringNotContainsString('Disallow: /api', $text);
    }

    /**
     * @description Sitemap: every web page in cs and en (not the inactive de), with hreflang
     *   alternates and x-default (en); active jobs and products only; the root without a slash.
     * @input jobs dev (active), old (inactive); products mug (active), hidden (inactive); both apps on.
     * @output loc /cs, /en, /cs/services, /en/jobs/dev, /cs/shop/products/mug; hreflang cs / en /
     *   x-default → /en/faq; no /de/, /jobs/old, hidden, cart, checkout, projects.
     */
    public function test_sitemap_lists_the_public_pages_in_every_language(): void
    {
        WebSiteSetting::create(['is_web_active' => true]);
        ShopSiteSetting::create(['is_shop_active' => true]);
        WebJob::create(['slug' => 'dev', 'title_i18n' => ['cz' => 'Vývojář'], 'is_active' => true, 'sort_order' => 1]);
        WebJob::create(['slug' => 'old', 'title_i18n' => ['cz' => 'Staré'], 'is_active' => false, 'sort_order' => 2]);
        // A product without a category is never active (ShopProduct::booted).
        $category = ShopCategory::create(['name' => 'Cups', 'slug' => 'cups', 'is_active' => true]);
        ShopProduct::create(['name' => 'Mug', 'slug' => 'mug', 'category_id' => $category->id, 'stock_quantity' => 1, 'is_active' => true]);
        ShopProduct::create(['name' => 'Hidden', 'slug' => 'hidden', 'category_id' => $category->id, 'stock_quantity' => 1, 'is_active' => false]);

        $response = $this->get('/sitemap.xml')->assertOk();
        $this->assertStringStartsWith('application/xml', (string) $response->headers->get('Content-Type'));
        $xml = simplexml_load_string($response->getContent());
        $this->assertNotFalse($xml);
        $xml->registerXPathNamespace('s', 'http://www.sitemaps.org/schemas/sitemap/0.9');
        $xml->registerXPathNamespace('x', 'http://www.w3.org/1999/xhtml');
        $locs = array_map('strval', $xml->xpath('//s:url/s:loc'));

        foreach (['https://example.com/cs', 'https://example.com/en', 'https://example.com/cs/services', 'https://example.com/en/jobs/dev',
            'https://example.com/cs/shop/catalog', 'https://example.com/cs/shop/products/mug'] as $expected) {
            $this->assertContains($expected, $locs);
        }
        foreach ($locs as $loc) {
            $this->assertStringNotContainsString('/de/', $loc);
            $this->assertDoesNotMatchRegularExpression('#/jobs/old|hidden|/cart|/checkout|/projects#', $loc);
        }

        $faq = $xml->xpath("//s:url[s:loc='https://example.com/cs/faq']/x:link");
        $alternates = [];
        foreach ($faq as $link) {
            $alternates[(string) $link['hreflang']] = (string) $link['href'];
        }
        $this->assertSame(['cs' => 'https://example.com/cs/faq', 'en' => 'https://example.com/en/faq',
            'x-default' => 'https://example.com/en/faq'], $alternates);
    }

    /**
     * @description An application in maintenance has no pages in the sitemap.
     * @input shop switched off; web on.
     * @output web pages listed; no /shop/ address.
     */
    public function test_sitemap_skips_an_application_in_maintenance(): void
    {
        WebSiteSetting::create(['is_web_active' => true]);
        ShopSiteSetting::create(['is_shop_active' => false]);

        $content = $this->get('/sitemap.xml')->assertOk()->getContent();
        $this->assertStringContainsString('<loc>https://example.com/cs/faq</loc>', $content);
        $this->assertStringNotContainsString('/shop/', $content);
    }
}
