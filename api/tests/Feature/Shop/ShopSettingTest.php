<?php

/**
 * @file ShopSettingTest.php
 * @path api/tests/Feature/Shop/ShopSettingTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the e-shop maintenance mode (ShopSiteSettingController +
 *   CheckShopActive middleware + public status): admin read / switch with password
 *   confirmation, public status / message, storefront and checkout closed while off.
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures.
 */

namespace Tests\Feature\Shop;

use App\Models\Shop\ShopLog;
use App\Models\Shop\ShopSiteSetting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/settings, /api/shop/public/{status,settings}, shop.active middleware.
 */
class ShopSettingTest extends TestCase
{
    use ShopFixtures;

    /**
     * @description Signs in an account that may switch the shop maintenance mode.
     * @return User
     */
    private function admin(): User
    {
        return $this->signIn($this->userWith(['shop-set-maintenance-mode']));
    }

    /**
     * @description The settings need shop-set-maintenance-mode; on first use the row is created active.
     * @input Account without permission: GET; admin: GET with an empty table, GET again.
     * @output 403; 200 {is_shop_active: true}; still one row.
     */
    public function test_show_creates_default_settings(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/shop/settings')->assertStatus(403);

        $this->admin();
        $this->getJson('/api/shop/settings')->assertOk()->assertJsonPath('data.is_shop_active', true);
        $this->getJson('/api/shop/settings')->assertOk();
        $this->assertSame(1, ShopSiteSetting::count());
    }

    /**
     * @description Switching needs the own password; a wrong one is refused and logged; the
     *   right one switches, drops the cached status and logs the change; a message-only change
     *   is not logged as a status change.
     * @input PUT wrong password; PUT {} ; PUT off + message; PUT on; PUT message only.
     * @output 403 + log; 422; 200 data.is_shop_active false, cache gone, log DISABLED; ENABLED;
     *   message saved, still 2 status logs.
     */
    public function test_update(): void
    {
        $this->admin();
        Cache::put('site_setting_active_shop', 'cached', 300);

        $this->putJson('/api/shop/settings', ['confirm_password' => 'wrong', 'is_shop_active' => false])
            ->assertStatus(403)->assertJson(['message' => 'Invalid confirmation password.']);
        $this->assertShopLog('unauthorized_maintenance_toggle_attempt');
        $this->putJson('/api/shop/settings', [])->assertStatus(422)->assertJsonValidationErrors(['confirm_password']);

        $this->putJson('/api/shop/settings', ['confirm_password' => $this->defaultPassword, 'is_shop_active' => false, 'maintenance_message' => 'Inventory'])
            ->assertOk()->assertJsonPath('data.is_shop_active', false)->assertJsonPath('data.maintenance_message', 'Inventory');
        $this->assertFalse(Cache::has('site_setting_active_shop'));
        $this->assertShopLog('maintenance_status_changed', 'DISABLED (Maintenance)');

        $this->putJson('/api/shop/settings', ['confirm_password' => $this->defaultPassword, 'is_shop_active' => true])->assertOk();
        $this->assertShopLog('maintenance_status_changed', 'ENABLED (Operational)');
        $this->putJson('/api/shop/settings', ['confirm_password' => $this->defaultPassword, 'maintenance_message' => 'Hi'])
            ->assertOk()->assertJsonPath('data.maintenance_message', 'Hi');
        $this->assertSame(2, ShopLog::where('event_type', 'maintenance_status_changed')->count());
        $this->assertSame(1, ShopSiteSetting::count());
    }

    /**
     * @description Public status and settings: active by default without a row, then the saved values.
     * @input No row: GET status / settings; row inactive with message: GET both.
     * @output {is_shop_active true} / {true, null}; {false} / {false, 'Inventory'}.
     */
    public function test_public_status_and_settings(): void
    {
        $this->getJson('/api/shop/public/status')->assertExactJson(['data' => ['is_shop_active' => true]]);
        $this->getJson('/api/shop/public/settings')->assertExactJson(['data' => ['is_shop_active' => true, 'maintenance_message' => null]]);

        ShopSiteSetting::create(['is_shop_active' => false, 'maintenance_message' => 'Inventory']);

        $this->getJson('/api/shop/public/status')->assertExactJson(['data' => ['is_shop_active' => false]]);
        $this->getJson('/api/shop/public/settings')->assertExactJson(['data' => ['is_shop_active' => false, 'maintenance_message' => 'Inventory']]);
    }

    /**
     * @description While the shop is off, the storefront and checkout answer 503 with the
     *   maintenance message (default text without one); status stays reachable.
     * @input No row (created active by the middleware); row switched off with / without message.
     * @output 200 products; 503 'Inventory' on products and checkout; 503 default text; status 200.
     */
    public function test_storefront_closed_during_maintenance(): void
    {
        $this->getJson('/api/shop/public/products')->assertOk();
        $this->assertTrue(ShopSiteSetting::findOrFail(1)->is_shop_active);

        ShopSiteSetting::whereKey(1)->update(['is_shop_active' => false, 'maintenance_message' => 'Inventory']);
        Cache::forget('site_setting_active_shop');

        $this->getJson('/api/shop/public/products')->assertStatus(503)->assertExactJson(['message' => 'Inventory']);
        $this->postJson('/api/shop/checkout/create-order', [])->assertStatus(503);
        $this->getJson('/api/shop/public/status')->assertOk();

        ShopSiteSetting::whereKey(1)->update(['maintenance_message' => null]);
        Cache::forget('site_setting_active_shop');
        $this->getJson('/api/shop/public/categories')->assertStatus(503)
            ->assertJsonPath('message', 'We apologize, but order acceptance and e-shop operations are currently suspended..');
    }
}
