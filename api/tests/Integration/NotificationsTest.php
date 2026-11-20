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
use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Models\Core\CoreNotificationMark;
use App\Models\Core\CoreSecurityEvent;
use Illuminate\Support\Carbon;
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
    private const ALL_KINDS = ['web_inquiries', 'web_job_applications', 'shop_orders', 'shop_low_stock', 'portal_orders', 'portal_leads_overdue', 'core_security_events'];

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
     * @input old records; GET; +5 min: new records, stock of a low product changed; +2 days: GET.
     * @output first GET all 0 and 7 marks stored; then inquiries 1, job applications 2, shop
     *   orders 1, low stock 1, portal orders 1, overdue leads 1, security events 1; links of the
     *   admin pages; no e-mail in the answer.
     */
    public function test_records_after_the_first_look_are_unread(): void
    {
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
            'web_inquiries' => 1, 'web_job_applications' => 2, 'shop_orders' => 1, 'shop_low_stock' => 1,
            'portal_orders' => 1, 'portal_leads_overdue' => 1, 'core_security_events' => 1,
        ], collect($response->json('data.kinds'))->pluck('count', 'kind')->all());
        $this->assertSame(['kind' => 'web_inquiries', 'module' => 'web', 'link' => '/admin/web/user-request', 'count' => 1], $response->json('data.kinds.0'));
        $this->assertSame('/admin/project-portal/sales-leads', $response->json('data.kinds.5.link'));
        $this->assertStringNotContainsString('@x.cz', $response->getContent());
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
