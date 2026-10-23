<?php

/**
 * @file SafeSortingTest.php
 * @path api/tests/Feature/Other/SafeSortingTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-23
 * @description Tests of the shared sorting of the index endpoints (AppliesSafeSorting, open
 *   finding #5): an unknown `sort_by` column or `sort_direction` no longer answers 500 but falls
 *   back to the default sorting; real columns (also table-qualified) and both directions work.
 * @dependencies
 * - Tests\TestCase, InteractsWithAccounts (sysadmin), ShopFixtures / WebFixtures (rows to sort).
 */

namespace Tests\Feature\Other;

use App\Traits\AppliesSafeSorting;
use Illuminate\Http\Request;
use Tests\Support\ShopFixtures;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description All index endpoints that sort by request parameters.
 */
class SafeSortingTest extends TestCase
{
    use ShopFixtures, WebFixtures;

    /** @var string[] Index endpoints sorted through AppliesSafeSorting. */
    private const ENDPOINTS = [
        'core/users', 'core/logs', 'core/security_events', 'core/external_links',
        'shop/categories', 'shop/coupons', 'shop/customers', 'shop/logs', 'shop/orders',
        'shop/payment_methods', 'shop/products', 'shop/shipping_methods', 'shop/suppliers',
        'shop/public/categories', 'shop/public/products',
        'web/job_applications', 'web/logs', 'web/news', 'web/project-threads', 'web/projects',
        'web/raw_request_commissions', 'web/sales_leads', 'web/sales_orders', 'web/support_tickets',
    ];

    /**
     * @description Every endpoint answers 200 for an unknown column, an SQL-looking value and an
     *   invalid direction (before: 500 from the database).
     * @input Sysadmin; each endpoint with sort_by=nope / sort_by="id; drop table users" and sort_direction=sideways.
     * @output 200 for every request.
     */
    public function test_invalid_sorting_falls_back_to_the_default(): void
    {
        $this->signIn($this->sysadmin());

        foreach (self::ENDPOINTS as $endpoint) {
            foreach (['sort_by=nope&sort_direction=sideways', 'sort_by=' . urlencode('id; drop table users') . '&sort_direction=asc', 'sort_by=id&sort_direction=DESC'] as $query) {
                $this->getJson("/api/{$endpoint}?{$query}")->assertOk();
            }
        }
    }

    /**
     * @description Valid sorting is applied: real column in both directions, table-qualified
     *   column, unknown column → default, extra allowed key passes through.
     * @input Coupons A / B; sort by code asc / desc / "shop_coupons.code"; resolveSorting with extra key.
     * @output Order [A, B] / [B, A] / [A, B]; default for 'nope'; 'role_name' allowed only as extra key.
     */
    public function test_valid_sorting_is_applied(): void
    {
        $this->signIn($this->sysadmin());
        $this->coupon(['code' => 'AAA']);
        $this->coupon(['code' => 'BBB']);
        $codes = fn (string $query) => array_column($this->getJson("/api/shop/coupons?{$query}")->assertOk()->json('data'), 'code');

        $this->assertSame(['AAA', 'BBB'], $codes('sort_by=code&sort_direction=asc'));
        $this->assertSame(['BBB', 'AAA'], $codes('sort_by=code&sort_direction=desc'));
        $this->assertSame(['AAA', 'BBB'], $codes('sort_by=shop_coupons.code&sort_direction=asc'));

        $sorter = new class {
            use AppliesSafeSorting;

            /** Exposes the protected resolver. */
            public function resolve(Request $request, array $extra = []): array
            {
                return $this->resolveSorting($request, 'users', 'id', 'desc', $extra);
            }
        };
        $this->assertSame(['id', 'desc'], $sorter->resolve(Request::create('/?sort_by=nope&sort_direction=up')));
        $this->assertSame(['full_name', 'asc'], $sorter->resolve(Request::create('/?sort_by=users.full_name&sort_direction=ASC')));
        $this->assertSame(['id', 'desc'], $sorter->resolve(Request::create('/?sort_by=role_name')));
        $this->assertSame(['role_name', 'desc'], $sorter->resolve(Request::create('/?sort_by=role_name'), ['role_name']));
    }
}
