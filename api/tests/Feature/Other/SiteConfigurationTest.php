<?php

/**
 * @file SiteConfigurationTest.php
 * @path api/tests/Feature/Other/SiteConfigurationTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the site configuration (SiteConfigurationController,
 *   PageTitleController): company details with translated tagline / copyright and logo,
 *   social links with icons, page titles (admin + public), the public configuration.
 * @dependencies
 * - Tests\TestCase; Storage fake (public disk).
 */

namespace Tests\Feature\Other;

use App\Models\Legal\PageTitle;
use App\Models\Legal\SiteSetting;
use App\Support\Mail\CompanyContactInfo;
use App\Models\Legal\SocialLink;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * @description /api/legal/config/*, /api/public/legal/{config,page-titles}.
 */
class SiteConfigurationTest extends TestCase
{
    /** @var string[] All configuration permissions. */
    private const ALL = ['core-legal-config-view', 'core-legal-config-create', 'core-legal-config-update', 'core-legal-config-delete'];

    /**
     * @description Fake public disk (logos, icons).
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    /**
     * @description A valid company details body.
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function company(array $overrides = []): array
    {
        return array_merge([
            'company_name' => 'Acme s.r.o.', 'ico' => '12345678', 'dic' => 'CZ12345678', 'contact_email' => 'info@acme.cz',
            'contact_phone' => '+420 111 222 333', 'address' => 'Praha 1', 'brand_tagline' => 'Base', 'copyright_text' => '© Acme',
            'footer_text' => 'Footer', 'google_analytics_id' => 'G-ABC12345',
        ], $overrides);
    }

    /**
     * @description Creates a page title row (rows are defined by SQL in production).
     * @param string $area web / shop / admin.
     * @param string $key Page key.
     * @param int $sort Sort order.
     * @param array<string, string>|null $titles title_i18n.
     * @return PageTitle
     */
    private function pageTitle(string $area, string $key, int $sort, ?array $titles = null): PageTitle
    {
        $row = new PageTitle();
        $row->forceFill(['area' => $area, 'page_key' => $key, 'route_path' => "/{$key}", 'sort_order' => $sort, 'title_i18n' => $titles])->save();

        return $row;
    }

    /**
     * @description The first save on an empty table creates the row; translated fields come as
     *   arrays or JSON strings, the base columns follow the cz text; only validated fields are
     *   stored (logo_path cannot be injected); changed keys are logged; the list needs permission.
     * @input Empty table: PUT with brand_tagline_i18n array {cz, en}, copyright_text_i18n JSON string,
     *        logo_path '../x'; then PUT same values (no change); GET config.
     * @output 200 brand_tagline 'Ahoj', copyright '© CZ', logo_path null; log lists the keys;
     *   second log "no field changes"; GET settings + ordered social links; 403 without permission.
     */
    public function test_update_settings(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/legal/config')->assertStatus(403);

        $this->signIn($this->userWith(self::ALL));
        $body = $this->company([
            'brand_tagline_i18n' => ['cz' => 'Ahoj', 'en' => 'Hello'], 'copyright_text_i18n' => json_encode(['cz' => '© CZ']),
            'google_analytics_id' => 'G-ABC12345', 'logo_path' => '../.env',
        ]);

        $this->putJson('/api/legal/config/settings', $body)->assertOk()
            ->assertJsonPath('data.brand_tagline', 'Ahoj')->assertJsonPath('data.brand_tagline_i18n.en', 'Hello')
            ->assertJsonPath('data.copyright_text', '© CZ')->assertJsonPath('data.google_analytics_id', 'G-ABC12345')->assertJsonPath('data.logo_path', null);
        $this->assertSame(1, SiteSetting::count());
        $this->assertCoreLog('update', 'Updated company details: ');
        $this->putJson('/api/legal/config/settings', $body)->assertOk();
        $this->assertCoreLog('update', 'no field changes detected');

        SocialLink::create(['name' => 'X', 'url' => 'https://x.com', 'icon_path' => '', 'position' => 2]);
        SocialLink::create(['name' => 'FB', 'url' => 'https://fb.com', 'icon_path' => '', 'position' => 1]);
        $this->getJson('/api/legal/config')->assertOk()->assertJsonPath('data.settings.company_name', 'Acme s.r.o.')->assertJsonPath('data.social_links.*.name', ['FB', 'X']);
    }

    /**
     * @description Translations that are not sent (or not decodable) keep the stored ones;
     *   a new logo replaces the old file; validation incl. column lengths and GA format.
     * @input Stored tagline i18n {cz Stary}; PUT with logo; PUT with new logo + tagline i18n 'not json';
     *        PUT invalid values.
     * @output tagline i18n kept, brand_tagline 'Stary'; first logo deleted, second stored; 422 fields.
     */
    public function test_update_settings_keeps_translations_and_replaces_logo(): void
    {
        $this->signIn($this->userWith(['core-legal-config-update']));
        SiteSetting::create($this->company(['brand_tagline_i18n' => ['cz' => 'Stary']]));

        $first = $this->put('/api/legal/config/settings', $this->company(['logo_file' => $this->fakeImage('logo.png')]), ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.brand_tagline', 'Stary')->json('data.logo_path');
        Storage::disk('public')->assertExists($first);

        $second = $this->put('/api/legal/config/settings', $this->company(['logo_file' => $this->fakeImage('new.png'), 'brand_tagline_i18n' => 'not json']), ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.brand_tagline_i18n.cz', 'Stary')->json('data.logo_path');
        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertExists($second);

        $this->putJson('/api/legal/config/settings', $this->company(['ico' => '', 'contact_email' => 'x', 'contact_phone' => str_repeat('1', 21), 'footer_text' => str_repeat('a', 256), 'google_analytics_id' => 'UA-1']))
            ->assertStatus(422)->assertJsonValidationErrors(['ico', 'contact_email', 'contact_phone', 'footer_text', 'google_analytics_id']);
    }

    /**
     * @description Optional company details (hidden_fields): a switched-off field is not validated
     *   and keeps its stored value, a switched-on one is required (i18n: a text in any language);
     *   hidden_fields comes as an array or a JSON string (multipart), unknown keys are refused,
     *   not sending it keeps the stored choice; the public config and the mail contact info get
     *   switched-off fields as null.
     * @input Stored full row; PUT with dic/phone/GA/tagline switched off and empty / invalid values;
     *        PUT without hidden_fields and without dic; PUT hidden_fields JSON string; invalid keys;
     *        switched-on empty fields; GET public config; CompanyContactInfo::get().
     * @output 200, dic/phone/GA/tagline values kept, hidden_fields stored; 200 with the stored choice;
     *   422 hidden_fields; 422 dic, address, brand_tagline; public dic/phone/GA/tagline(+i18n) null,
     *   no hidden_fields key; contactPhone null.
     */
    public function test_optional_fields(): void
    {
        $this->signIn($this->userWith(['core-legal-config-view', 'core-legal-config-update']));
        SiteSetting::create($this->company(['brand_tagline_i18n' => ['cz' => 'Ahoj']]));
        $hidden = ['dic', 'contact_phone', 'google_analytics_id', 'brand_tagline'];

        $this->putJson('/api/legal/config/settings', $this->company([
            'hidden_fields' => $hidden, 'dic' => '', 'contact_phone' => str_repeat('9', 40), 'google_analytics_id' => 'UA-1',
            'brand_tagline_i18n' => ['cz' => ''],
        ]))->assertOk()->assertJsonPath('data.hidden_fields', $hidden);
        $row = SiteSetting::first();
        $this->assertSame(['CZ12345678', '+420 111 222 333', 'G-ABC12345', ['cz' => 'Ahoj']], [$row->dic, $row->contact_phone, $row->google_analytics_id, $row->brand_tagline_i18n]);

        // Not sent = stored choice stays (dic still switched off, so an empty dic is fine).
        $this->putJson('/api/legal/config/settings', array_merge($this->company(), ['dic' => null]))->assertOk()->assertJsonPath('data.hidden_fields', $hidden);
        $this->putJson('/api/legal/config/settings', $this->company(['hidden_fields' => json_encode(['dic'])]))->assertOk()->assertJsonPath('data.hidden_fields', ['dic']);

        $this->putJson('/api/legal/config/settings', $this->company(['hidden_fields' => ['company_name']]))->assertStatus(422)->assertJsonValidationErrors(['hidden_fields']);
        $this->putJson('/api/legal/config/settings', $this->company(['hidden_fields' => 'not json']))->assertStatus(422)->assertJsonValidationErrors(['hidden_fields']);
        $this->putJson('/api/legal/config/settings', $this->company(['hidden_fields' => [], 'dic' => '', 'address' => '']))->assertStatus(422)->assertJsonValidationErrors(['dic', 'address']);
        $this->putJson('/api/legal/config/settings', $this->company(['hidden_fields' => [], 'brand_tagline' => '', 'brand_tagline_i18n' => ['cz' => ' ', 'en' => '']]))
            ->assertStatus(422)->assertJsonValidationErrors(['brand_tagline']);

        SiteSetting::first()->update(['hidden_fields' => $hidden]);
        $public = $this->getJson('/api/public/legal/config')->assertOk()->json('data.settings');
        foreach (['dic', 'contact_phone', 'google_analytics_id', 'brand_tagline', 'brand_tagline_i18n'] as $column) {
            $this->assertNull($public[$column], $column);
        }
        $this->assertSame(['12345678', 'Praha 1'], [$public['ico'], $public['address']]);
        $this->assertArrayNotHasKey('hidden_fields', $public);
        $this->assertNull(CompanyContactInfo::get()['contactPhone']);
        $this->getJson('/api/legal/config')->assertJsonPath('data.settings.dic', 'CZ12345678');
    }

    /**
     * @description Public configuration: tagline / copyright in the requested language, else cz,
     *   else the base column; social links ordered; empty configuration.
     * @input No row: GET; row with tagline i18n {cz, en}, copyright without i18n: ?lang=en, ?lang=de.
     * @output settings null; en 'Hello'; de 'Ahoj'; copyright base column.
     */
    public function test_public_config(): void
    {
        $this->getJson('/api/public/legal/config')->assertOk()->assertJsonPath('data.settings', null)->assertJsonPath('data.social_links', []);

        SiteSetting::create($this->company(['brand_tagline_i18n' => ['cz' => 'Ahoj', 'en' => 'Hello']]));
        $this->getJson('/api/public/legal/config?lang=en')->assertJsonPath('data.settings.brand_tagline', 'Hello')->assertJsonPath('data.settings.copyright_text', '© Acme');
        $this->getJson('/api/public/legal/config?lang=de')->assertJsonPath('data.settings.brand_tagline', 'Ahoj');
    }

    /**
     * @description Social links: create (with / without icon), edit (icon replaced, position kept
     *   when not sent), delete (icon removed), validation (https URL, column lengths), 404s.
     * @input POST with icon; POST without; PUT (multipart POST route) with a new icon; PUT JSON;
     *        DELETE; invalid bodies; /999.
     * @output 201 icon stored / ''; old icon deleted; position kept; 204 + file gone; 422; 404.
     */
    public function test_social_links(): void
    {
        $this->signIn($this->userWith(self::ALL));

        $link = $this->post('/api/legal/config/social', ['name' => 'Facebook', 'url' => 'https://fb.com/acme', 'position' => 3, 'icon_file' => $this->fakeImage('fb.png')], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.name', 'Facebook')->json('data');
        Storage::disk('public')->assertExists($link['icon_path']);
        $this->assertCoreLog('create', 'Added social network: Facebook');
        $this->postJson('/api/legal/config/social', ['name' => 'X', 'url' => 'https://x.com'])->assertCreated()->assertJsonPath('data.icon_path', '')->assertJsonPath('data.position', 0);

        $updated = $this->post("/api/legal/config/social/{$link['id']}", ['name' => 'FB', 'url' => 'https://fb.com', 'icon_file' => $this->fakeImage('fb2.png')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.position', 3)->json('data.icon_path');
        Storage::disk('public')->assertMissing($link['icon_path']);
        Storage::disk('public')->assertExists($updated);
        $this->putJson("/api/legal/config/social/{$link['id']}", ['name' => 'FB', 'url' => 'https://fb.com', 'position' => 1])->assertOk()->assertJsonPath('data.icon_path', $updated)->assertJsonPath('data.position', 1);
        $this->assertCoreLog('update', 'Updated social network: FB');

        $this->postJson('/api/legal/config/social', ['name' => str_repeat('n', 51), 'url' => 'javascript:alert(1)'])->assertStatus(422)->assertJsonValidationErrors(['name', 'url']);
        $this->postJson('/api/legal/config/social', ['name' => 'Long', 'url' => 'https://x.com/' . str_repeat('a', 250)])->assertStatus(422)->assertJsonValidationErrors(['url']);
        $this->putJson('/api/legal/config/social/999', ['name' => 'X', 'url' => 'https://x.com'])->assertStatus(404);

        $this->deleteJson("/api/legal/config/social/{$link['id']}")->assertNoContent();
        Storage::disk('public')->assertMissing($updated);
        $this->assertCoreLog('delete', 'Deleted social network: FB');
        $plain = SocialLink::where('name', 'X')->sole();
        $this->deleteJson("/api/legal/config/social/{$plain->id}")->assertNoContent();
        $this->deleteJson('/api/legal/config/social/999')->assertStatus(404);
    }

    /**
     * @description Page titles: admin list ordered web → shop → admin → sort order; bulk update
     *   merges the sent languages, strips HTML, collapses whitespace (max 120 chars), ignores
     *   invalid language keys and logs only changed rows; stale ids refused; validation; the
     *   public map leaves out empty translations.
     * @input admin.users (0), shop.cart (1), web.home (2) {cz Domů, en Home}, web.about (1).
     * @output Order [about, home, cart, users]; home {cz '<b>Úvod</b>  x' → 'Úvod x', en kept, de without <i>};
     *   1 log; 422 for id 999 / bad body; public {web.home: {cz, en, de}, shop.cart: {}}.
     */
    public function test_page_titles(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/legal/config/page-titles')->assertStatus(403);

        $this->signIn($this->userWith(['core-legal-config-view', 'core-legal-config-update']));
        $users = $this->pageTitle('admin', 'users', 0);
        $cart = $this->pageTitle('shop', 'cart', 1, ['cz' => '', 'en' => null]);
        $home = $this->pageTitle('web', 'home', 2, ['cz' => 'Domů', 'en' => 'Home']);
        $about = $this->pageTitle('web', 'about', 1);

        $this->getJson('/api/legal/config/page-titles')->assertOk()->assertJsonPath('data.*.id', [$about->id, $home->id, $cart->id, $users->id]);

        $this->putJson('/api/legal/config/page-titles', ['titles' => [
            ['id' => $home->id, 'title_i18n' => ['CZ' => "<b>Úvod</b>\n  x", 'de' => '<i>' . str_repeat('d', 110) . '</i>', 'bad key!' => 'x']],
            ['id' => $users->id, 'title_i18n' => []],
        ]])->assertOk()->assertJsonCount(4, 'data');

        $titles = $home->fresh()->title_i18n;
        $this->assertSame(['Úvod x', 'Home', str_repeat('d', 110)], [$titles['cz'], $titles['en'], $titles['de']]);
        $this->assertArrayNotHasKey('bad key!', $titles);
        $this->assertCoreLog('update', 'Updated page title: web.home');
        $this->assertSame(1, \App\Models\Core\CoreLog::where('description', 'like', 'Updated page title%')->count());

        $this->putJson('/api/legal/config/page-titles', ['titles' => [['id' => 999, 'title_i18n' => []]]])->assertStatus(422)
            ->assertJson(['message' => 'Some pages do not exist anymore. Reload the page.']);
        $this->putJson('/api/legal/config/page-titles', ['titles' => [['id' => $home->id, 'title_i18n' => 'x']]])->assertStatus(422);
        $this->putJson('/api/legal/config/page-titles', [])->assertStatus(422)->assertJsonValidationErrors(['titles']);

        $this->app['auth']->forgetGuards();
        $public = $this->getJson('/api/public/legal/page-titles')->assertOk()->json('data');
        $this->assertSame(['cz' => 'Úvod x', 'en' => 'Home', 'de' => str_repeat('d', 110)], $public['web.home']);
        $this->assertSame([], $public['shop.cart']);
        $this->assertSame([], $public['web.about']);
    }
}
