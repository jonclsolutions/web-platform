<?php

/**
 * @file ShopLogTest.php
 * @path api/tests/Apps/Shop/Feature/ShopLogTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the shop audit log (ShopLogController): list with filters
 *   and search, detail, own entries written by the admin frontend.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Shop\Support\ShopFixtures.
 */

namespace Tests\Apps\Shop\Feature;

use App\Apps\Shop\Models\ShopLog;
use Tests\Apps\Shop\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/logs.
 */
class ShopLogTest extends TestCase
{
    use ShopFixtures;

    /**
     * @description Inserts a shop log row (created_at is not mass assignable).
     * @param array<string, mixed> $attributes Column overrides.
     * @return ShopLog
     */
    private function log(array $attributes = []): ShopLog
    {
        return ShopLog::forceCreate(array_merge([
            'event_type' => 'update', 'module' => 'ShopProduct', 'description' => 'Changed', 'origin' => '127.0.0.1',
            'user_plain' => 'system', 'user_id_plain' => '0',
        ], $attributes));
    }

    /**
     * @description List: permission, newest first, column filters, global search, export.
     * @input Row A (yesterday, create / ShopOrder / eve@x.cz / 10.1.1.1 / 'Order added') and row B (today).
     * @output 403 without shop-view-logs; B first; each filter and the search return only A;
     *   no_pagination returns both.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/shop/logs')->assertStatus(403);

        $this->signIn($this->userWith(['shop-view-logs']));
        $a = $this->log(['created_at' => now()->subDay(), 'event_type' => 'create', 'module' => 'ShopOrder', 'user_plain' => 'eve@x.cz', 'origin' => '10.1.1.1', 'description' => 'Order added']);
        $b = $this->log(['created_at' => now()]);

        $this->getJson('/api/shop/logs?per_page=1')->assertOk()->assertJson(['meta' => ['total' => 2, 'last_page' => 2]])->assertJsonPath('data.0.id', $b->id);
        foreach (["id={$a->id}", 'event_type=create', 'module=ShopOrder', 'user_plain=eve@', 'origin=10.1', 'search=Order%20add'] as $filter) {
            $this->getJson("/api/shop/logs?{$filter}")->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $a->id);
        }
        $this->getJson('/api/shop/logs?no_pagination=true&sort_by=id&sort_direction=asc')->assertJsonPath('data.*.id', [$a->id, $b->id]);
    }

    /**
     * @description The detail names the actor's e-mail, or "Unknown user" without an account (English, finding #29).
     * @input Row of an existing account with context, row without account; GET /999.
     * @output user.user_email = e-mail / 'Unknown user', context_data decoded; 404.
     */
    public function test_show(): void
    {
        $actor = $this->signIn($this->userWith(['shop-view-logs']));
        $own = $this->log(['user_id' => $actor->id, 'context_data' => ['k' => 'v']]);
        $anonymous = $this->log();

        $this->getJson("/api/shop/logs/{$own->id}")->assertOk()->assertJsonPath('data.user.user_email', $actor->user_email)->assertJsonPath('data.context_data.k', 'v');
        $this->getJson("/api/shop/logs/{$anonymous->id}")->assertJsonPath('data.user.user_email', 'Unknown user');
        $this->getJson('/api/shop/logs/999')->assertStatus(404);
    }

    /**
     * @description The browser cannot write the e-shop log; an export of e-shop data is logged by
     *   the server into the e-shop log.
     * @input POST shop/logs; GET shop/logs?export=csv with shop-view-logs.
     * @output 405; shop log row export_csv "Exported 0 records (CSV) from api/shop/logs".
     */
    public function test_browser_cannot_write_and_exports_are_logged_by_the_server(): void
    {
        $this->signIn($this->userWith(['shop-view-logs']));

        $this->postJson('/api/shop/logs', ['event_type' => 'export_csv', 'module' => 'shop/orders', 'description' => 'Exported'])->assertStatus(405);
        $this->getJson('/api/shop/logs?export=csv&no_pagination=true')->assertOk();

        $this->assertSame(['export_csv'], ShopLog::pluck('event_type')->all());
        $this->assertSame('Exported 0 records (CSV) from api/shop/logs', ShopLog::sole()->description);
    }
}
