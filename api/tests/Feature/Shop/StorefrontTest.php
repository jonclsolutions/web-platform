<?php

/**
 * @file StorefrontTest.php
 * @path api/tests/Feature/Shop/StorefrontTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the public storefront (ShopProductController public methods,
 *   ShopPublicController): product list / detail without internal data, stock check, shipping
 *   and payment methods without gateway config, coupon check with its rate limit.
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures; Storage fake (public disk).
 */

namespace Tests\Feature\Shop;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/public/*.
 */
class StorefrontTest extends TestCase
{
    use ShopFixtures;

    /**
     * @description Public list: only active products, search, category, price range, page size
     *   capped at 100; never the purchase price.
     * @input A (Lamp, cat X, 121), B (Chair, 242), C inactive; per_page 1000; per_page 1.
     * @output [B, A]; filters; per_page 100; no cost_price_eur anywhere.
     */
    public function test_product_list(): void
    {
        $x = $this->category(['name' => 'X']);
        $a = $this->product(['name' => 'Lamp', 'name_en' => 'Lamp EN', 'category_id' => $x->id]);
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $b = $this->product(['name' => 'Chair'], ['price_eur_with_vat' => 242]);
        $this->product(['name' => 'Hidden'])->update(['is_active' => false]);

        $ids = fn (string $q) => array_column($this->getJson("/api/shop/public/products?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$a->id], $ids('search=Lamp%20EN'));
        $this->assertSame([$a->id], $ids("category_id={$x->id}"));
        $this->assertSame([$b->id], $ids('price_from=200'));
        $this->assertSame([$a->id], $ids('price_to=200'));
        $this->assertSame([$a->id, $b->id], $ids('sort_by=name&sort_direction=desc'));

        $response = $this->getJson('/api/shop/public/products?per_page=1000')->assertOk()->assertJsonPath('per_page', 100);
        $this->assertArrayNotHasKey('cost_price_eur', $response->json('data.0.prices'));
        $this->assertSame(121.0, (float) $response->json('data.1.prices.price_eur_with_vat'));
        $this->getJson('/api/shop/public/products?per_page=1')->assertJson(['per_page' => 1, 'last_page' => 2]);
    }

    /**
     * @description Public detail by id or slug with images (sorted) and variants, without
     *   purchase prices; inactive / unknown products answer 404.
     * @input Product 'desk-lamp' with images (sort 2, 1) and a priced variant; inactive product.
     * @output Same product by id and slug; images ordered; no cost price in product / variant; 404s.
     */
    public function test_product_detail(): void
    {
        Storage::fake('public');
        $product = $this->product(['name' => 'Desk Lamp']);
        $this->image($product, 'b.jpg', ['sort_order' => 2]);
        $this->image($product, 'a.jpg', ['sort_order' => 1, 'is_primary' => true]);
        $this->variant($product, ['variant_name' => 'Black'], ['price_eur_with_vat' => 99, 'cost_price_eur' => 10]);
        $inactive = $this->product(['name' => 'Off']);
        $inactive->update(['is_active' => false]);

        $json = $this->getJson("/api/shop/public/products/{$product->id}")->assertOk()
            ->assertJsonPath('images.0.image_path', 'a.jpg')->assertJsonPath('variants.0.prices.price_eur_with_vat', 99)->json();
        $this->assertArrayNotHasKey('cost_price_eur', $json['prices']);
        $this->assertArrayNotHasKey('cost_price_eur', $json['variants'][0]['prices']);
        $this->assertStringEndsWith('/storage/products/a.jpg', $json['images'][0]['url']);
        $this->getJson('/api/shop/public/products/desk-lamp')->assertOk()->assertJsonPath('id', $product->id);
        $this->getJson("/api/shop/public/products/{$inactive->id}")->assertStatus(404)->assertJson(['message' => 'Product not found or not active.']);
        $this->getJson('/api/shop/public/products/nope')->assertStatus(404);
    }

    /**
     * @description Stock check answers only available yes / no, per variant of the product,
     *   cached for 2 minutes; unknown product / foreign variant count as 0; rate limited.
     * @input Product with variants V (1 pc) + Red (2 pcs) = 3 pcs; foreign variant W; unknown product; 15 + 1 calls.
     * @output quantity 3 true / 4 false; V 1 true / 2 false; W false; unknown false; cache key set; 429.
     */
    public function test_check_stock(): void
    {
        $product = $this->product();
        $other = $this->product();
        $v = $this->variant($product, ['stock_quantity' => 1]);
        $this->variant($product, ['variant_name' => 'Red', 'stock_quantity' => 2]);
        $w = $this->variant($other, ['stock_quantity' => 50]);
        Cache::flush();

        $check = fn (string $q) => $this->getJson("/api/shop/public/products/{$q}")->assertOk()->json('available');
        $this->assertTrue($check("{$product->id}/check-stock?quantity=3"));
        $this->assertFalse($check("{$product->id}/check-stock?quantity=4"));
        $this->assertTrue(Cache::has("product_stock_{$product->id}"));
        $this->assertTrue($check("{$product->id}/check-stock?quantity=1&variant_id={$v->id}"));
        $this->assertFalse($check("{$product->id}/check-stock?quantity=2&variant_id={$v->id}"));
        $this->assertFalse($check("{$product->id}/check-stock?quantity=1&variant_id={$w->id}"));
        $this->assertFalse($check('999/check-stock?quantity=1'));
        $this->getJson("/api/shop/public/products/{$product->id}/check-stock?quantity=1")->assertExactJson(['available' => true]);

        foreach (range(1, 8) as $i) {
            $this->getJson("/api/shop/public/products/{$product->id}/check-stock?quantity=1")->assertOk();
        }
        $this->getJson("/api/shop/public/products/{$product->id}/check-stock?quantity=1")->assertStatus(429);
    }

    /**
     * @description Shipping and payment methods: only active ones in sort order; the payment
     *   gateway config is never public (the admin still gets it).
     * @input Shipping PPL (sort 2), Packeta (sort 1), inactive DPD; payments bank (config key), card, inactive COD.
     * @output Shipping [Packeta, PPL]; payments [bank, card] without 'config'.
     */
    public function test_shipping_and_payment_methods(): void
    {
        $this->shippingMethod(['sort_order' => 2]);
        $this->shippingMethod(['code' => 'packeta', 'name' => 'Packeta', 'sort_order' => 1]);
        $this->shippingMethod(['code' => 'dpd', 'name' => 'DPD', 'is_active' => false]);
        $this->paymentMethod(['sort_order' => 0]);
        $this->paymentMethod(['code' => 'card', 'name' => 'Card', 'sort_order' => 1]);
        $this->paymentMethod(['code' => 'cod', 'name' => 'COD', 'is_active' => false]);

        $this->getJson('/api/shop/public/shipping-methods')->assertOk()->assertJsonPath('*.code', ['packeta', 'ppl']);
        $payments = $this->getJson('/api/shop/public/payment-methods')->assertOk()->assertJsonPath('*.code', ['bank_transfer', 'card'])->json();
        $this->assertArrayNotHasKey('config', $payments[0]);
        $this->assertStringNotContainsString('secret-key', json_encode($payments));
    }

    /**
     * @description Coupon check: unknown / inactive 404, not yet valid, expired, exhausted and
     *   minimum amount 422, valid 200; validation; own rate limit (20 / minute).
     * @input Codes OK, OFF, SOON, OLD, USED, MIN (min 100); order_amount 50; then 20 calls.
     * @output Messages per case; {is_valid true, coupon.code OK}; 422 fields; 21st call 429.
     */
    public function test_validate_coupon(): void
    {
        $this->coupon(['code' => 'OK']);
        $this->coupon(['code' => 'OFF', 'is_active' => false]);
        $this->coupon(['code' => 'SOON', 'valid_from' => now()->addDay()]);
        $this->coupon(['code' => 'OLD', 'valid_until' => now()->subDay()]);
        $this->coupon(['code' => 'USED', 'max_usage' => 2, 'usage_count' => 2]);
        $this->coupon(['code' => 'MIN', 'min_order_amount' => 100]);

        $check = fn (string $code) => $this->postJson('/api/shop/public/coupons/validate', ['code' => $code, 'order_amount' => 50]);
        $check('NOPE')->assertStatus(404)->assertJson(['message' => 'Coupon does not exist or is not active.']);
        $check('OFF')->assertStatus(404);
        $check('SOON')->assertStatus(422)->assertJson(['message' => 'Coupon is not valid yet.']);
        $check('OLD')->assertStatus(422)->assertJson(['message' => 'Coupon has expired.']);
        $check('USED')->assertStatus(422)->assertJson(['message' => 'Coupon usage limit has been reached.']);
        $check('MIN')->assertStatus(422)->assertJson(['message' => 'Minimum order amount is 100.00EUR.']);
        $check('OK')->assertOk()->assertJsonPath('is_valid', true)->assertJsonPath('coupon.code', 'OK');
        $this->postJson('/api/shop/public/coupons/validate', [])->assertStatus(422)->assertJsonValidationErrors(['code', 'order_amount']);

        foreach (range(1, 12) as $i) {
            $check('OK')->assertOk();
        }
        $check('OK')->assertStatus(429);
    }
}
