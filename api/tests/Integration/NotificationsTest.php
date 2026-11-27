<?php

/**
 * @file NotificationsTest.php
 * @path api/tests/Integration/NotificationsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the admin notifications (CoreNotificationController): unread
 *   counts per kind for the signed-in admin - the first look starts now (old records are not
 *   counted), records after the last look are unread, every kind only with its view permission and
 *   the tab permission of its module, "seen" resets a kind (only the user's own and only visible
 *   kinds), every admin has their own marks, validation, no record details in the answer.
 * @dependencies
 * - Tests\TestCase (InteractsWithAccounts), Tests\Apps\Shop\Support\ShopFixtures; the clock frozen at
 *   2026-11-11 10:00 and moved forward by the tests.
 */

namespace Tests\Integration;

use App\Apps\ProjectPortal\Models\SalesLead;
use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Apps\Web\Models\WebFaqCategory;
use App\Apps\Web\Models\WebFaqItem;
use App\Apps\Web\Models\WebJob;
use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebJobSection;
use App\Apps\Web\Models\WebKbSection;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Apps\Web\Models\WebReference;
use App\Apps\Web\Models\WebReferenceFeature;
use App\Apps\Web\Models\WebSiteSetting;
use App\Apps\Web\Support\RawRequestEmailTemplate;
use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use App\Apps\ProjectPortal\Support\SalesOrderEmailTemplate;
use App\Apps\Shop\Models\ShopSiteSetting;
use App\Apps\Shop\Support\ShopOrderEmailTemplate;
use App\Console\Commands\SyncTranslationsCommand;
use App\Models\Core\CoreNotificationMark;
use App\Models\Core\CoreSecurityEvent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\Apps\Shop\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description GET /api/core/notifications, POST /api/core/notifications/seen.
 */
class NotificationsTest extends TestCase
{
    use ShopFixtures;

    /** @description Every kind of the sysadmin, in menu order (applications, then the core). */
    private const ALL_KINDS = ['web_inquiries', 'web_job_applications', 'web_texts_missing', 'web_page_titles_missing', 'web_faq_missing', 'web_jobs_missing', 'web_references_missing', 'web_kb_missing', 'web_inquiry_email_missing', 'shop_orders', 'shop_low_stock', 'shop_texts_missing', 'shop_page_titles_missing', 'shop_order_email_missing', 'portal_orders', 'portal_leads_overdue', 'portal_order_email_missing', 'core_security_events'];

    /**
     * @description Freezes the clock.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-11 10:00:00');
    }

    /**
     * @description Unfreezes the clock.
     * @return void
     */
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * @description Counts of the answer by kind.
     * @param string $url Endpoint.
     * @param array<string, mixed>|null $body POST body (null = GET).
     * @return array<string, int>
     */
    private function counts(string $url = '/api/core/notifications', ?array $body = null): array
    {
        $response = $body === null ? $this->getJson($url) : $this->postJson($url, $body);

        return collect($response->assertOk()->json('data.kinds'))->pluck('count', 'kind')->all();
    }

    /**
     * @description Creates one inquiry.
     * @return WebRawRequestCommission
     */
    private function inquiry(): WebRawRequestCommission
    {
        return WebRawRequestCommission::forceCreate(['thema' => 'other', 'contact_email' => Str::random(6) . '@x.cz', 'order_description' => 'x', 'status' => 'new']);
    }

    /**
     * @description The sysadmin sees every kind. The first look starts now - records that were
     *   already there are not counted; what comes after is: new inquiries, job applications,
     *   orders of both applications and security events (not a repeated occurrence of a known
     *   one), low-stock products that changed, leads that became overdue (not those overdue
     *   before, nor closed ones). The answer has only numbers and links.
     * @input own storage: the base texts of the repository, Czech only (web, e-shop); complete
     *   Czech e-mails; old records; GET; +5 min: new records, stock of a low product changed;
     *   +2 days: GET.
     * @output first GET all 0 and 7 marks stored (the texts kinds are attention kinds - no mark); then inquiries 1, job applications 2, shop
     *   orders 1, low stock 1, portal orders 1, overdue leads 1, security events 1; links of the
     *   admin pages; no e-mail in the answer.
     */
    public function test_records_after_the_first_look_are_unread(): void
    {
        $storage = sys_get_temp_dir() . '/rpsw-notifications-' . uniqid();
        File::copyDirectory(SyncTranslationsCommand::defaultSeed(), $storage . '/app/public/translations');
        File::put($storage . '/app/public/translations/languages.json', json_encode([
            ['code' => 'cz', 'module' => 'web', 'active' => true, 'isBuiltIn' => true],
            ['code' => 'cz', 'module' => 'shop', 'active' => true, 'isBuiltIn' => true],
        ]));
        $this->app->useStoragePath($storage);
        $this->beforeApplicationDestroyed(fn () => File::deleteDirectory($storage));
        foreach ([[new WebSiteSetting(['is_web_active' => true]), RawRequestEmailTemplate::class], [new ProjectPortalSetting(), SalesOrderEmailTemplate::class],
            [new ShopSiteSetting(['is_shop_active' => true]), ShopOrderEmailTemplate::class]] as [$settings, $template]) {
            $template::completeDefaults($settings);
            $settings->save();
        }
        $this->inquiry();
        $mug = $this->product(['name' => 'Mug', 'stock_quantity' => 2, 'stock_warning_level' => 5]);
        $this->product(['name' => 'Cup', 'stock_quantity' => 1, 'stock_warning_level' => 5]);
        $known = CoreSecurityEvent::forceCreate(['fingerprint' => str_repeat('a', 64), 'event_type' => 'x', 'first_seen_at' => now(), 'last_seen_at' => now(), 'status' => 'new']);
        SalesLead::forceCreate(['salesman_name' => 'S', 'subject_name' => 'Soon', 'source_channel' => 'web', 'status' => 'negotiating', 'last_contact_date' => '2026-10-29']);
        SalesLead::forceCreate(['salesman_name' => 'S', 'subject_name' => 'Old', 'source_channel' => 'web', 'status' => 'new', 'last_contact_date' => '2026-10-01']);
        SalesLead::forceCreate(['salesman_name' => 'S', 'subject_name' => 'Won', 'source_channel' => 'web', 'status' => 'closed_won', 'last_contact_date' => '2026-10-29']);
        $admin = $this->signIn($this->sysadmin());

        $this->assertSame(array_fill_keys(self::ALL_KINDS, 0), $this->counts());
        $this->assertSame(7, CoreNotificationMark::where('user_id', $admin->id)->count());

        Carbon::setTestNow('2026-11-11 10:05:00');
        $this->inquiry();
        foreach ([1, 2] as $index) {
            WebJobApplication::forceCreate(['first_name' => 'A', 'last_name' => "B{$index}", 'email' => "a{$index}@x.cz", 'position_name' => 'Dev', 'state' => 'new']);
        }
        $this->order(null, ['status' => 'pending']);
        SalesOrder::forceCreate(['client_name' => 'Acme']);
        $mug->update(['stock_quantity' => 1]);
        $known->forceFill(['occurrences' => 5, 'last_seen_at' => now()])->save();
        CoreSecurityEvent::forceCreate(['fingerprint' => str_repeat('b', 64), 'event_type' => 'y', 'first_seen_at' => now(), 'last_seen_at' => now(), 'status' => 'new']);

        Carbon::setTestNow('2026-11-13 09:00:00');
        $response = $this->getJson('/api/core/notifications')->assertOk();
        $this->assertSame([
            'web_inquiries' => 1, 'web_job_applications' => 2, 'web_texts_missing' => 0, 'web_page_titles_missing' => 0, 'web_faq_missing' => 0,
            'web_jobs_missing' => 0, 'web_references_missing' => 0, 'web_kb_missing' => 0, 'web_inquiry_email_missing' => 0, 'shop_orders' => 1,
            'shop_low_stock' => 1, 'shop_texts_missing' => 0, 'shop_page_titles_missing' => 0, 'shop_order_email_missing' => 0,
            'portal_orders' => 1, 'portal_leads_overdue' => 1, 'portal_order_email_missing' => 0, 'core_security_events' => 1,
        ], collect($response->json('data.kinds'))->pluck('count', 'kind')->all());
        $this->assertSame(['kind' => 'web_inquiries', 'module' => 'web', 'link' => '/admin/web/user-request', 'count' => 1], $response->json('data.kinds.0'));
        $this->assertSame('/admin/project-portal/sales-leads', collect($response->json('data.kinds'))->firstWhere('kind', 'portal_leads_overdue')['link']);
        $this->assertStringNotContainsString('@x.cz', $response->getContent());
    }

    /**
     * @description Texts missing in the active languages are an attention kind of the text editor
     *   page: the count is the current state (empty Czech value + empty or missing key of another
     *   active language; inactive languages not counted), "seen" does not clear it and stores no
     *   mark, it drops when the texts are filled; only admins who may edit the texts get it.
     * @input Temporary storage: web cz {a, g.b, g.c: ''}, de (active) {a, g.b: ''}, sk inactive;
     *   shop cz complete. Editor (view + update) and viewer (view only).
     * @output web_texts_missing 3 with attention and the split per language (cz 1, de 2), the
     *   switched off sk only as `preparing` (sk 3 - no file); shop_texts_missing 0 without a split;
     *   after seen still 3, no mark; after de filled 1 (cz 1); viewer has no texts kind. Page
     *   titles (web home {cz, de ''}, about {cz}; switched off sk not counted, preparing 2):
     *   web_page_titles_missing 2 split de 2 (attention); shop 0.
     */
    public function test_missing_texts_are_an_attention_kind(): void
    {
        $storage = sys_get_temp_dir() . '/rpsw-notification-texts-' . uniqid();
        $dir = $storage . '/app/public/translations';
        File::makeDirectory($dir . '/web', 0755, true);
        File::makeDirectory($dir . '/shop', 0755, true);
        File::put($dir . '/languages.json', json_encode([
            ['code' => 'cz', 'module' => 'web', 'active' => true, 'isBuiltIn' => true],
            ['code' => 'de', 'module' => 'web', 'active' => true, 'isBuiltIn' => false],
            ['code' => 'sk', 'module' => 'web', 'active' => false, 'isBuiltIn' => false],
            ['code' => 'cz', 'module' => 'shop', 'active' => true, 'isBuiltIn' => true],
        ]));
        File::put($dir . '/web/cz.json', json_encode(['a' => 'A', 'g' => ['b' => 'B', 'c' => '']]));
        File::put($dir . '/web/de.json', json_encode(['a' => 'A de', 'g' => ['b' => ' ']]));
        File::put($dir . '/shop/cz.json', json_encode(['checkout' => ['title' => 'Pokladna']]));
        $this->app->useStoragePath($storage);
        foreach (['home' => ['cz' => 'Domů', 'de' => ' ', 'sk' => ''], 'about' => ['cz' => 'O nás']] as $key => $titles) {
            (new \App\Models\Legal\PageTitle())->forceFill(['area' => 'web', 'page_key' => $key, 'route_path' => '/', 'sort_order' => 1, 'title_i18n' => $titles])->save();
        }

        try {
            $editor = $this->signIn($this->userWith(['view-web', 'web-edit-website-view', 'web-edit-website-update', 'view-eshop', 'shop-edit-eshop-view', 'shop-edit-eshop-update']));
            $kinds = collect($this->getJson('/api/core/notifications')->assertOk()->json('data.kinds'))->keyBy('kind');
            $this->assertSame(['kind' => 'web_texts_missing', 'module' => 'web', 'link' => '/admin/web/edit-website', 'count' => 3, 'attention' => true,
                'languages' => ['cz' => 1, 'de' => 2], 'preparing' => ['sk' => 3]], $kinds['web_texts_missing']);
            $this->assertSame(0, $kinds['shop_texts_missing']['count']);
            $this->assertArrayNotHasKey('languages', $kinds['shop_texts_missing']);
            $this->assertSame(['kind' => 'web_page_titles_missing', 'module' => 'web', 'link' => '/admin/web/edit-website', 'count' => 2,
                'attention' => true, 'languages' => ['de' => 2], 'preparing' => ['sk' => 2]], $kinds['web_page_titles_missing']);
            $this->assertSame(0, $kinds['shop_page_titles_missing']['count']);

            $this->assertSame(3, $this->counts('/api/core/notifications/seen', ['kinds' => ['web_texts_missing']])['web_texts_missing']);
            $this->assertFalse(CoreNotificationMark::where('user_id', $editor->id)->where('kind', 'web_texts_missing')->exists());

            File::put($dir . '/web/de.json', json_encode(['a' => 'A de', 'g' => ['b' => 'B de', 'c' => 'C de']]));
            $this->assertSame(1, $this->counts()['web_texts_missing']);
            $this->assertSame(['cz' => 1], collect($this->getJson('/api/core/notifications')->json('data.kinds'))->keyBy('kind')['web_texts_missing']['languages']);

            $this->signIn($this->userWith(['view-web', 'web-edit-website-view']));
            $this->assertArrayNotHasKey('web_texts_missing', $this->counts());
        } finally {
            File::deleteDirectory($storage);
        }
    }

    /**
     * @description The confirmation e-mails lacking texts are attention kinds of their pages: the
     *   inquiry e-mail (Inquiries), the e-shop order e-mails (Orders) - Czech and the active
     *   languages counted (orange), the switched off ones only as `preparing` (grey); only for the
     *   admins who may edit the e-mail.
     * @input Own storage: web cz + en active, sk off; shop cz; Czech inquiry e-mail complete, e-shop
     *   e-mail empty; editor of the inquiries and the orders; then a viewer of the inquiries.
     * @output web_inquiry_email_missing 12 {en: 12} preparing {sk: 12}, link /admin/web/user-request;
     *   shop_order_email_missing 34 {cz: 34}, link /admin/shop/orders; the viewer gets neither.
     */
    public function test_confirmation_emails_lacking_texts_are_attention_kinds(): void
    {
        $storage = sys_get_temp_dir() . '/rpsw-notification-emails-' . uniqid();
        File::makeDirectory($storage . '/app/public/translations', 0755, true);
        File::put($storage . '/app/public/translations/languages.json', json_encode([
            ['code' => 'cz', 'module' => 'web', 'active' => true, 'isBuiltIn' => true],
            ['code' => 'en', 'module' => 'web', 'active' => true],
            ['code' => 'sk', 'module' => 'web', 'active' => false],
            ['code' => 'cz', 'module' => 'shop', 'active' => true, 'isBuiltIn' => true],
        ]));
        $this->app->useStoragePath($storage);
        $this->beforeApplicationDestroyed(fn () => File::deleteDirectory($storage));
        $web = new WebSiteSetting(['is_web_active' => true]);
        RawRequestEmailTemplate::completeDefaults($web);
        $web->save();
        $emailKeys = count(RawRequestEmailTemplate::DEFAULTS);

        $this->signIn($this->userWith(['view-web', 'web-user-requests-view', 'web-user-requests-update', 'view-eshop', 'shop-orders-view', 'shop-orders-update']));
        $kinds = collect($this->getJson('/api/core/notifications')->assertOk()->json('data.kinds'))->keyBy('kind');
        $this->assertSame(['kind' => 'web_inquiry_email_missing', 'module' => 'web', 'link' => '/admin/web/user-request', 'count' => $emailKeys,
            'attention' => true, 'languages' => ['en' => $emailKeys], 'preparing' => ['sk' => $emailKeys]], $kinds['web_inquiry_email_missing']);
        $shopKeys = count(ShopOrderEmailTemplate::DEFAULTS);
        $this->assertSame(['kind' => 'shop_order_email_missing', 'module' => 'shop', 'link' => '/admin/shop/orders', 'count' => $shopKeys,
            'attention' => true, 'languages' => ['cz' => $shopKeys]], $kinds['shop_order_email_missing']);

        $this->signIn($this->userWith(['view-web', 'web-user-requests-view']));
        $this->assertArrayNotHasKey('web_inquiry_email_missing', $this->counts());
    }

    /**
     * @description Content of the website in the database missing a text in an active language
     *   (attention kinds per tab of Texty webu): a text written in some language but empty in an
     *   active one counts its record; optional texts nobody wrote, inactive records and inactive
     *   languages do not count; sub-records count while their parent is active.
     * @input Languages cz + de active, sk inactive. FAQ: item cz+de (complete), item cz only,
     *   category cz only. Jobs: active job cz only, inactive job cz only, section of the active
     *   job cz+de. References: active one with a feature cz only. KB: inactive block cz only.
     * @output faq 2, jobs 1, references 1, knowledge base 0; after the FAQ item and category
     *   get German texts: faq 0.
     */
    public function test_missing_web_content_is_an_attention_kind(): void
    {
        $storage = sys_get_temp_dir() . '/rpsw-notification-content-' . uniqid();
        File::makeDirectory($storage . '/app/public/translations', 0755, true);
        File::put($storage . '/app/public/translations/languages.json', json_encode([
            ['code' => 'cz', 'module' => 'web', 'active' => true, 'isBuiltIn' => true],
            ['code' => 'de', 'module' => 'web', 'active' => true, 'isBuiltIn' => false],
            ['code' => 'sk', 'module' => 'web', 'active' => false, 'isBuiltIn' => false],
        ]));
        $this->app->useStoragePath($storage);

        try {
            $category = WebFaqCategory::create(['name_i18n' => ['cz' => 'Obecné'], 'sort_order' => 1]);
            WebFaqItem::create(['category_id' => $category->id, 'question_i18n' => ['cz' => 'Q', 'de' => 'F'], 'answer_i18n' => ['cz' => 'A', 'de' => 'A'], 'sort_order' => 1]);
            $half = WebFaqItem::create(['category_id' => $category->id, 'question_i18n' => ['cz' => 'Q2'], 'answer_i18n' => ['cz' => 'A2', 'sk' => 'A2'], 'sort_order' => 2]);
            $job = WebJob::create(['slug' => 'dev', 'title_i18n' => ['cz' => 'Vývojář'], 'is_active' => true, 'sort_order' => 1]);
            WebJob::create(['slug' => 'old', 'title_i18n' => ['cz' => 'Staré'], 'is_active' => false, 'sort_order' => 2]);
            WebJobSection::create(['job_id' => $job->id, 'heading_i18n' => [], 'body_i18n' => ['cz' => 'Text', 'de' => 'Text'], 'sort_order' => 1]);
            $reference = WebReference::create(['name_i18n' => ['cz' => 'Projekt', 'de' => 'Projekt'], 'is_active' => true, 'sort_order' => 1]);
            WebReferenceFeature::create(['reference_id' => $reference->id, 'text_i18n' => ['cz' => 'Rychlé'], 'sort_order' => 1]);
            WebKbSection::create(['is_intro' => false, 'heading_i18n' => ['cz' => 'Blok'], 'text_i18n' => ['cz' => 'Text'], 'is_active' => false, 'sort_order' => 1]);

            $this->signIn($this->userWith(['view-web', 'web-edit-website-view', 'web-edit-website-update']));
            $kinds = collect($this->getJson('/api/core/notifications')->assertOk()->json('data.kinds'))->keyBy('kind');
            $this->assertSame([2, 1, 1, 0], [$kinds['web_faq_missing']['count'], $kinds['web_jobs_missing']['count'], $kinds['web_references_missing']['count'], $kinds['web_kb_missing']['count']]);
            $this->assertTrue($kinds['web_faq_missing']['attention']);
            $this->assertSame('/admin/web/edit-website', $kinds['web_jobs_missing']['link']);

            $half->update(['question_i18n' => ['cz' => 'Q2', 'de' => 'F2'], 'answer_i18n' => ['cz' => 'A2', 'de' => 'A2']]);
            $category->update(['name_i18n' => ['cz' => 'Obecné', 'de' => 'Allgemein']]);
            $this->assertSame(0, $this->counts()['web_faq_missing']);
        } finally {
            File::deleteDirectory($storage);
        }
    }

    /**
     * @description A user sees only the kinds of the pages they may open (view permission + tab
     *   permission of the module); "seen" resets the kind of the user, ignores kinds the user may
     *   not see and does not touch the marks of other admins.
     * @input web user (inquiries only); colleague with the same rights; 2 new inquiries; seen of
     *   web_inquiries + shop_orders + unknown; 1 more inquiry; user without the web tab permission.
     * @output kinds [web_inquiries]; 2; after seen 0 and no shop_orders mark; then 1; colleague
     *   still 3; without the tab permission no kinds.
     */
    public function test_permissions_and_seen(): void
    {
        $user = $this->userWith(['view-web', 'web-user-requests-view']);
        $colleague = $this->userWith(['view-web', 'web-user-requests-view']);
        $this->signIn($colleague);
        $this->counts();
        $this->signIn($user);
        $this->assertSame(['web_inquiries' => 0], $this->counts());

        Carbon::setTestNow('2026-11-11 10:05:00');
        $this->inquiry();
        $this->inquiry();
        $this->assertSame(['web_inquiries' => 2], $this->counts());

        Carbon::setTestNow('2026-11-11 10:06:00');
        $this->assertSame(['web_inquiries' => 0], $this->counts('/api/core/notifications/seen', ['kinds' => ['web_inquiries', 'shop_orders', 'unknown_kind']]));
        $this->assertFalse(CoreNotificationMark::where('user_id', $user->id)->where('kind', 'shop_orders')->exists());

        Carbon::setTestNow('2026-11-11 10:07:00');
        $this->inquiry();
        $this->assertSame(['web_inquiries' => 1], $this->counts());
        $this->signIn($colleague);
        $this->assertSame(['web_inquiries' => 3], $this->counts());

        $this->signIn($this->userWith(['web-user-requests-view']));
        $this->assertSame([], $this->counts());
    }

    /**
     * @description Both endpoints need a signed-in user; "seen" needs 1 to 20 valid kind keys.
     * @input no user; seen without kinds, with an invalid key, with 21 keys.
     * @output 401 twice; 422 three times.
     */
    public function test_authentication_and_validation(): void
    {
        $this->getJson('/api/core/notifications')->assertUnauthorized();
        $this->postJson('/api/core/notifications/seen', ['kinds' => ['web_inquiries']])->assertUnauthorized();

        $this->signIn($this->user());
        $this->postJson('/api/core/notifications/seen', [])->assertStatus(422)->assertJsonValidationErrors(['kinds']);
        $this->postJson('/api/core/notifications/seen', ['kinds' => ['Bad-Kind']])->assertStatus(422)->assertJsonValidationErrors(['kinds.0']);
        $this->postJson('/api/core/notifications/seen', ['kinds' => array_map(fn ($i) => "kind_{$i}", range(1, 21))])->assertStatus(422);
    }
}
