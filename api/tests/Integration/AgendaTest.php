<?php

/**
 * @file AgendaTest.php
 * @path api/tests/Integration/AgendaTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the admin calendar agenda (CoreAgendaController): the dated
 *   events of a range (coupon start / end, project deadline, lead follow-up, order-form link
 *   expiry, activation link expiry), the reminders of open work with their counts, every source
 *   only with its view permission and the tab permission of its module, range validation and no
 *   personal details in the answer.
 * @dependencies
 * - Tests\TestCase (InteractsWithAccounts), Tests\Apps\Shop\Support\ShopFixtures; the clock frozen at
 *   2026-11-11 10:00.
 */

namespace Tests\Integration;

use App\Models\AccountActivationToken;
use App\Models\Core\CoreSecurityEvent;
use App\Apps\Shop\Models\ShopCoupon;
use App\Apps\Web\Models\WebJobApplication;
use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\SalesLead;
use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Apps\Web\Models\WebRawRequestCommission;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\Apps\Shop\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description GET /api/core/agenda.
 */
class AgendaTest extends TestCase
{
    use ShopFixtures;

    /** @description Range of the month view of November 2026. */
    private const RANGE = '/api/core/agenda?from=2026-10-26&to=2026-12-06';

    /**
     * @description Freezes the clock and creates one item of every source.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-11 10:00:00');

        ShopCoupon::forceCreate(['code' => 'XMAS', 'discount_type' => 'percent', 'discount_value' => 10, 'applies_to' => 'all', 'is_active' => true,
            'valid_from' => '2026-11-20 00:00:00', 'valid_until' => '2026-11-30 23:59:59']);
        ShopCoupon::forceCreate(['code' => 'OFF', 'discount_type' => 'percent', 'discount_value' => 10, 'applies_to' => 'all', 'is_active' => false,
            'valid_until' => '2026-11-15 00:00:00']);
        $order = SalesOrder::forceCreate(['client_name' => 'Acme']);
        SalesOrder::forceCreate(['client_name' => 'Beta']);
        $this->project('Portal', '2026-11-05', 'development', $order->id);
        $this->project('Done', '2026-11-18', 'finished');
        $this->project('Later', '2027-01-10', 'new');
        SalesLead::forceCreate(['salesman_name' => 'S', 'subject_name' => 'Lead A', 'source_channel' => 'web', 'status' => 'negotiating', 'last_contact_date' => '2026-11-01']);
        SalesLead::forceCreate(['salesman_name' => 'S', 'subject_name' => 'Lead Old', 'source_channel' => 'web', 'status' => 'new', 'last_contact_date' => '2026-10-01']);
        SalesLead::forceCreate(['salesman_name' => 'S', 'subject_name' => 'Lead Won', 'source_channel' => 'web', 'status' => 'closed_won', 'last_contact_date' => '2026-11-01']);
        $link = SalesLead::forceCreate(['salesman_name' => 'S', 'subject_name' => 'Lead Link', 'source_channel' => 'web', 'status' => 'offer_sent', 'last_contact_date' => '2026-11-10']);
        $link->forceFill(['public_token' => Str::random(40), 'public_token_expires_at' => '2026-11-25 12:00:00'])->save();
        foreach (['new', 'new', 'new', 'interview'] as $index => $state) {
            WebJobApplication::forceCreate(['first_name' => 'A', 'last_name' => "B{$index}", 'email' => "a{$index}@x.cz", 'position_name' => 'Dev', 'state' => $state]);
        }
        WebRawRequestCommission::forceCreate(['thema' => 'other', 'contact_email' => 'c@x.cz', 'order_description' => 'x', 'status' => 'new']);
        $this->product(['name' => 'Mug', 'stock_quantity' => 2, 'stock_warning_level' => 5]);
        $this->product(['name' => 'Plate', 'stock_quantity' => 50, 'stock_warning_level' => 5]);
        $this->order(null, ['status' => 'pending']);
        $this->order(null, ['status' => 'delivered']);
        CoreSecurityEvent::forceCreate(['fingerprint' => str_repeat('a', 64), 'event_type' => 'x', 'first_seen_at' => now(), 'last_seen_at' => now(), 'status' => 'new']);
        $pending = $this->user(['user_email' => 'new.admin@x.cz', 'activated_at' => null]);
        AccountActivationToken::forceCreate(['user_id' => $pending->id, 'token_hash' => hash('sha256', 'a'), 'expires_at' => '2026-11-13 08:00:00']);
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
     * @description Creates a project with a deadline.
     * @param string $name Name.
     * @param string $deadline estimated_completion_to.
     * @param string $status Status.
     * @param int|null $orderId Order of the project.
     * @return Project
     */
    private function project(string $name, string $deadline, string $status, ?int $orderId = null): Project
    {
        return Project::forceCreate(['name' => $name, 'access_token' => Str::random(40),
            'estimated_completion_to' => $deadline, 'status' => $status, 'order_id' => $orderId]);
    }

    /**
     * @description The sysadmin sees every source: the events of the range in date order and the
     *   reminders with counts and the oldest date.
     * @input Month view range of November 2026.
     * @output today 2026-11-11; events project Portal (11-05, overdue = danger, deep link),
     *   activation (11-13), lead follow-up Lead A (11-15), coupon start (11-20), Lead Link
     *   follow-up (11-24) + form expiry (11-25), coupon end (11-30); no inactive coupon, finished
     *   or later project, closed lead; modules personal, web, shop, project-portal, core;
     *   reminders job applicants 3, inquiries 1, e-shop orders 1, low stock 1, leads without
     *   contact 1 (Lead Old), order without project 1 (Beta), security events 1.
     */
    public function test_sysadmin_gets_all_events_and_reminders(): void
    {
        $this->signIn($this->sysadmin());
        $data = $this->getJson(self::RANGE)->assertOk()->json('data');

        $this->assertSame('2026-11-11', $data['today']);
        $this->assertSame(['personal', 'web', 'shop', 'project-portal', 'core'], $data['modules']);
        $this->assertSame([
            ['project_deadline', '2026-11-05', 'Portal', 'danger'],
            ['activation_expiry', '2026-11-13', 'new.admin@x.cz', 'warning'],
            ['lead_follow_up', '2026-11-15', 'Lead A', 'info'],
            ['coupon_start', '2026-11-20', 'XMAS', 'info'],
            ['lead_follow_up', '2026-11-24', 'Lead Link', 'info'],
            ['lead_form_expiry', '2026-11-25', 'Lead Link', 'warning'],
            ['coupon_end', '2026-11-30', 'XMAS', 'warning'],
        ], array_map(fn ($e) => [$e['type'], $e['date'], $e['subject'], $e['severity']], $data['events']));
        $this->assertMatchesRegularExpression('#^/admin/project-portal/projects/\d+$#', $data['events'][0]['link']);
        $this->assertSame('/admin/project-portal/sales-leads', $data['events'][2]['link']);
        $this->assertSame('/admin/shop/coupons', $data['events'][6]['link']);

        $reminders = array_column($data['reminders'], 'count', 'type');
        $this->assertSame([
            'job_applications_new' => 3, 'inquiries_new' => 1, 'shop_orders_open' => 1, 'products_low_stock' => 1,
            'leads_without_contact' => 1, 'orders_without_project' => 1, 'security_events_new' => 1,
        ], $reminders);
        $this->assertSame('2026-11-11', $data['reminders'][0]['since']);
        $this->assertNull(collect($data['reminders'])->firstWhere('type', 'products_low_stock')['since']);
        $this->assertSame('/admin/web/job-applications', $data['reminders'][0]['link']);
    }

    /**
     * @description Only the sources of the user's view permissions (with the tab permission of
     *   the module); nothing personal of the sources is returned (no e-mails of applicants /
     *   inquiries); `modules` lists the visible modules.
     * @input Account with view-eshop + shop-coupons-view + view-web + web-job-applications-view;
     *   account without permissions.
     * @output Events coupon start / end only; reminder job applicants only (no inquiries);
     *   modules personal, web, shop; no 'a0@x.cz' / 'c@x.cz' in the answer; the account without
     *   permissions gets 200 with nothing and only the personal module.
     */
    public function test_sources_follow_the_permissions(): void
    {
        $this->signIn($this->userWith(['view-eshop', 'shop-coupons-view', 'view-web', 'web-job-applications-view']));
        $response = $this->getJson(self::RANGE)->assertOk();
        $this->assertSame(['coupon_start', 'coupon_end'], array_column($response->json('data.events'), 'type'));
        $this->assertSame(['job_applications_new'], array_column($response->json('data.reminders'), 'type'));
        $this->assertSame(['personal', 'web', 'shop'], $response->json('data.modules'));
        $this->assertStringNotContainsString('a0@x.cz', $response->getContent());
        $this->assertStringNotContainsString('c@x.cz', $response->getContent());

        $this->signIn($this->user());
        $this->getJson(self::RANGE)->assertOk()->assertJsonPath('data.events', [])->assertJsonPath('data.reminders', [])
            ->assertJsonPath('data.modules', ['personal']);
    }

    /**
     * @description Without the tab permission of a module (the module is hidden in the admin
     *   menu) none of its sources is returned, even with the page permissions.
     * @input Account with all page view permissions of web, e-shop, project portal and core, but
     *   only the tab permission view-web.
     * @output Only web reminders (no project deadline, no lead); modules personal, web.
     */
    public function test_module_without_tab_permission_is_hidden(): void
    {
        $this->signIn($this->userWith(['view-web', 'web-projects-view', 'project-portal-sales-leads-view', 'web-job-applications-view', 'web-user-requests-view',
            'shop-coupons-view', 'shop-orders-view', 'shop-products-view', 'core-administrators-view', 'core-security-view']));
        $data = $this->getJson(self::RANGE)->assertOk()->json('data');
        $this->assertSame([], $data['events']);
        $this->assertSame(['web'], array_values(array_unique(array_column($data['reminders'], 'module'))));
        $this->assertSame(['personal', 'web'], $data['modules']);
    }

    /**
     * @description Signed in only; the range is required, ordered and at most 62 days.
     * @input Guest; missing range; to before from; 3 months.
     * @output 401; 422 from / to; 422 to; 422.
     */
    public function test_range_validation(): void
    {
        $this->getJson(self::RANGE)->assertUnauthorized();

        $this->signIn($this->user());
        $this->getJson('/api/core/agenda')->assertStatus(422)->assertJsonValidationErrors(['from', 'to']);
        $this->getJson('/api/core/agenda?from=2026-11-10&to=2026-11-01')->assertStatus(422)->assertJsonValidationErrors(['to']);
        $this->getJson('/api/core/agenda?from=2026-01-01&to=2026-04-01')->assertStatus(422);
    }
}
