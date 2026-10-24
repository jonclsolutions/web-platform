<?php

/**
 * @file CouponTest.php
 * @path api/tests/Feature/Shop/CouponTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the coupons administration (ShopCouponController): list,
 *   create / edit with validation, delete / restore and emptying the trash (coupons used by
 *   an order are kept).
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures.
 */

namespace Tests\Feature\Shop;

use App\Models\Shop\ShopCoupon;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/coupons.
 */
class CouponTest extends TestCase
{
    use ShopFixtures;

    /** @var string[] All coupon permissions. */
    private const ALL = ['shop-coupons-view', 'shop-coupons-create', 'shop-coupons-update', 'shop-coupons-delete'];

    /**
     * @description A valid coupon form body.
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge(['code' => 'WINTER', 'discount_type' => 'fixed', 'discount_value' => 5, 'applies_to' => 'all', 'is_active' => 'true'], $overrides);
    }

    /**
     * @description List: permission, newest first, search, filters, trash, pagination, export.
     * @input A (SAVE10 percent), B (FIX5 fixed, inactive, 'Spring'), C trashed.
     * @output Each filter returns the expected coupon.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/shop/coupons')->assertStatus(403);

        $this->signIn($this->userWith(['shop-coupons-view']));
        $a = $this->coupon();
        $b = $this->coupon(['code' => 'FIX5', 'discount_type' => 'fixed', 'is_active' => false, 'description' => 'Spring']);
        $this->coupon(['code' => 'GONE'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/shop/coupons?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$b->id], $ids('search=Spri'));
        $this->assertSame([$a->id], $ids('discount_type=percent'));
        $this->assertSame([$b->id], $ids('is_active=0'));
        $this->assertSame([], $ids('applies_to=products'));
        $this->assertSame(['GONE'], array_column($this->getJson('/api/shop/coupons?only_trashed=1')->json('data'), 'code'));
        $this->getJson('/api/shop/coupons?per_page=1')->assertJson(['meta' => ['total' => 2, 'last_page' => 2]]);
        $this->getJson('/api/shop/coupons?no_pagination=1')->assertOk()->assertJsonCount(2, 'data');
    }

    /**
     * @description Create and edit: validation (unique code, dates, type), boolean parsing of
     *   is_active, detail also of a trashed coupon, 404s, database errors.
     * @input POST valid ('false' active); POST same code; POST invalid; GET; PUT; PUT other's code;
     *        /999; failing UPDATE / INSERT.
     * @output 201 is_active false; 422 "This coupon code already exists."; 422 errors; 200; 200; 422;
     *   404; 500 / 500.
     */
    public function test_store_show_update(): void
    {
        $this->signIn($this->userWith(self::ALL));

        $id = $this->postJson('/api/shop/coupons', $this->payload(['is_active' => 'false', 'valid_from' => '2026-11-01', 'valid_until' => '2026-12-01']))
            ->assertCreated()->assertJsonPath('data.is_active', false)->assertJsonPath('data.valid_until', fn ($v) => str_starts_with($v, '2026-12-01'))->json('data.id');
        $this->assertShopLog('create', 'Created coupon: WINTER');
        $this->postJson('/api/shop/coupons', $this->payload())->assertStatus(422)->assertJsonPath('errors.code.0', 'This coupon code already exists.');
        $this->postJson('/api/shop/coupons', ['code' => 'AB', 'discount_type' => 'gift', 'valid_from' => '2026-12-01', 'valid_until' => '2026-11-01'])
            ->assertStatus(422)->assertJsonValidationErrors(['code', 'discount_type', 'discount_value', 'applies_to', 'is_active', 'valid_until']);

        $other = $this->coupon();
        ShopCoupon::find($id)->delete();
        $this->getJson("/api/shop/coupons/{$id}")->assertOk()->assertJsonPath('data.deleted_at', fn ($v) => $v !== null);
        $this->getJson('/api/shop/coupons/999')->assertStatus(404);
        $this->putJson("/api/shop/coupons/{$id}", $this->payload(['discount_value' => 7]))->assertOk()->assertJsonPath('data.discount_value', '7.00');
        $this->assertShopLog('update', 'Updated coupon: WINTER');
        $this->putJson("/api/shop/coupons/{$id}", $this->payload(['code' => 'SAVE10']))->assertStatus(422);
        $this->putJson('/api/shop/coupons/999', $this->payload(['code' => 'NEW1']))->assertStatus(404);

        $this->failOn('shop_coupons', 'UPDATE');
        $this->putJson("/api/shop/coupons/{$other->id}", $this->payload(['code' => 'SAVE10']))->assertStatus(500)->assertJson(['message' => 'Update failed.']);
        $this->failOn('shop_coupons', 'INSERT');
        $this->postJson('/api/shop/coupons', $this->payload(['code' => 'NEW2']))->assertStatus(500)->assertJson(['message' => 'Error creating coupon.']);
    }

    /**
     * @description Delete (soft / permanent), restore, emptying the trash keeps coupons that an
     *   order references; 404s; database error.
     * @input A, B, C (used by an order), D; actions in sequence; failing DELETE.
     * @output 204s; A restored; trash emptied except C (log "1 out of 2"); 404; 500.
     */
    public function test_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        [$a, $b, $c, $d] = [$this->coupon(['code' => 'AAA']), $this->coupon(['code' => 'BBB']), $this->coupon(['code' => 'CCC']), $this->coupon(['code' => 'DDD'])];
        $this->order(null, ['coupon_id' => $c->id]);

        $this->deleteJson("/api/shop/coupons/{$a->id}")->assertNoContent();
        $this->assertSoftDeleted($a);
        $this->deleteJson("/api/shop/coupons/{$b->id}?force_delete=1")->assertNoContent();
        $this->assertNull(ShopCoupon::withTrashed()->find($b->id));
        $this->deleteJson('/api/shop/coupons/999')->assertStatus(404);
        $this->postJson("/api/shop/coupons/{$a->id}/restore")->assertOk()->assertJsonPath('data.deleted_at', null);
        $this->assertShopLog('restore', "Restored coupon ID: {$a->id}");
        $this->postJson('/api/shop/coupons/999/restore')->assertStatus(404);

        $c->delete();
        $d->delete();
        $this->deleteJson('/api/shop/coupons/force-delete-all')->assertNoContent();
        $this->assertSame([$c->id], ShopCoupon::onlyTrashed()->pluck('id')->all());
        $this->assertShopLog('force_delete_all', 'Permanently deleted: 1 out of 2');

        $e = $this->coupon(['code' => 'EEE']);
        $e->delete();
        $this->failOn('shop_coupons', 'DELETE');
        $this->deleteJson('/api/shop/coupons/force-delete-all')->assertStatus(500)->assertJson(['message' => 'Error clearing coupon trash.']);
    }
}
