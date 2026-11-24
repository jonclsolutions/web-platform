<?php

/**
 * @file PublicLanguageTest.php
 * @path api/tests/Unit/Core/PublicLanguageTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the languages in the public URLs (PublicLanguage, PublicUrl): code
 *   mapping (Czech `cz` ↔ `cs`), Accept-Language by weight, the visitor's language with the
 *   English / first-language fallbacks, the x-default language and the paths / absolute links
 *   with the language prefix - the same rules as the frontend.
 * @dependencies Tests\TestCase (config of the frontend URL).
 */

namespace Tests\Unit\Core;

use App\Support\Seo\PublicLanguage;
use App\Support\Seo\PublicUrl;
use Tests\TestCase;

class PublicLanguageTest extends TestCase
{
    /**
     * @description Czech is `cs` in URLs and `cz` in the translations; other codes are the same.
     * @input urlCode cz / EN / pt-br; codeOfTag cs-CZ / en-GB / de_AT / ''.
     * @output cs, en, pt-br; cz, en, de, ''.
     */
    public function test_codes(): void
    {
        $this->assertSame(['cs', 'en', 'pt-br'], array_map([PublicLanguage::class, 'urlCode'], ['cz', 'EN', 'pt-br']));
        $this->assertSame(['cz', 'en', 'de', ''], array_map([PublicLanguage::class, 'codeOfTag'], ['cs-CZ', 'en-GB', 'de_AT', '']));
    }

    /**
     * @description Accept-Language: by weight, equal weights in their order, `*` and q=0 left out.
     * @input 'en;q=0.5, cs-CZ, de;q=0.8, fr;q=0, *;q=0.1, cs;q=0.8'; null.
     * @output ['cs-CZ', 'de', 'cs', 'en']; [].
     */
    public function test_accepted_tags(): void
    {
        $this->assertSame(['cs-CZ', 'de', 'cs', 'en'], PublicLanguage::acceptedTags('en;q=0.5, cs-CZ, de;q=0.8, fr;q=0, *;q=0.1, cs;q=0.8'));
        $this->assertSame([], PublicLanguage::acceptedTags(null));
    }

    /**
     * @description The visitor's language: first offered browser language, else English, else the
     *   first offered; x-default = English or the first language.
     * @input [cz, en] with 'de, cs-CZ;q=0.9'; [cz, en] with 'fr'; [cz, de] with 'fr'; [] with 'cs'; fallback.
     * @output cz; en; cz; en; fallback en / cz / null.
     */
    public function test_pick_and_fallback(): void
    {
        $this->assertSame('cz', PublicLanguage::pick(['cz', 'en'], 'de, cs-CZ;q=0.9'));
        $this->assertSame('en', PublicLanguage::pick(['cz', 'en'], 'fr'));
        $this->assertSame('cz', PublicLanguage::pick(['cz', 'de'], 'fr'));
        $this->assertSame('en', PublicLanguage::pick([], 'cs'));
        $this->assertSame('en', PublicLanguage::fallback(['cz', 'en']));
        $this->assertSame('cz', PublicLanguage::fallback(['cz', 'de']));
        $this->assertNull(PublicLanguage::fallback([]));
    }

    /**
     * @description Paths and absolute links with the language; the root without a trailing slash;
     *   no language = no prefix.
     * @input path('/', cz), path('services', en); PublicUrl::to('/tos', 'cz') / ('/projects/t', null)
     *   with FRONTEND_URL 'https://example.com/'.
     * @output '/cs', '/en/services'; 'https://example.com/cs/tos', 'https://example.com/projects/t'.
     */
    public function test_paths_and_links(): void
    {
        config(['app.frontend_url' => 'https://example.com/']);
        $this->assertSame('/cs', PublicLanguage::path('/', 'cz'));
        $this->assertSame('/en/services', PublicLanguage::path('services', 'en'));
        $this->assertSame('https://example.com/cs/tos', PublicUrl::to('/tos', 'cz'));
        $this->assertSame('https://example.com/projects/t', PublicUrl::to('/projects/t', null));
    }
}
