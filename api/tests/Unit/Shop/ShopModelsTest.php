<?php

/**
 * @file ShopModelsTest.php
 * @path api/tests/Unit/Shop/ShopModelsTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the shop models: coupon validity rules, query scopes, relations
 *   and helpers not reached through the API, order number sequence, stock re-summing and the
 *   status labels.
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures; Storage fake (public disk).
 */

namespace Tests\Unit\Shop;

use App\Models\Shop\ShopCustomer;
use App\Models\Shop\ShopOrder;
use App\Models\Shop\ShopOrderItem;
use App\Models\Shop\ShopProduct;
use App\Models\Shop\ShopProductImage;
use App\Models\Shop\ShopProductPrice;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description App\Models\Shop\*.
 */
class ShopModelsTest extends TestCase
{
    use ShopFixtures;

    /**
     * @description A coupon is valid only when active, inside its dates, not used up and the
     *   order reaches the minimum.
     * @input Coupons: plain; inactive; future; expired; used up (2/2); unlimited (max 0); minimum 100.
     * @output true; false; false; false; false; true; false for 50 / true for 100.
     */
    public function test_coupon_is_valid(): void
    {
        $this->assertTrue($this->coupon(['code' => 'A'])->isValid());
        $this->assertFalse($this->coupon(['code' => 'B', 'is_active' => false])->isValid());
        $this->assertFalse($this->coupon(['code' => 'C', 'valid_from' => now()->addHour()])->isValid());
        $this->assertFalse($this->coupon(['code' => 'D', 'valid_until' => now()->subHour()])->isValid());
        $this->assertFalse($this->coupon(['code' => 'E', 'max_usage' => 2, 'usage_count' => 2])->isValid());
        $this->assertTrue($this->coupon(['code' => 'F', 'max_usage' => 0, 'usage_count' => 9, 'valid_from' => now()->subDay(), 'valid_until' => now()->addDay()])->isValid());
        $minimum = $this->coupon(['code' => 'G', 'min_order_amount' => 100]);
        $this->assertFalse($minimum->isValid(50));
        $this->assertTrue($minimum->isValid(100));
    }

    /**
     * @description Query scopes of customers, orders, products and images.
     * @input Active / inactive customer; orders pending+paid, canceled+pending, returned; featured /
     *        normal product; images: primary of the product, variant image.
     * @output Each scope returns the expected rows.
     */
    public function test_scopes(): void
    {
        $active = $this->customer();
        $this->customer(['email' => 'off@x.cz', 'is_active' => false]);
        $this->assertSame([$active->id], ShopCustomer::active()->pluck('id')->all());

        $paid = $this->order($active, ['payment_status' => 'paid']);
        $canceled = $this->order($active, ['status' => 'canceled']);
        $this->order($active, ['status' => 'returned', 'payment_status' => 'refunded']);
        $this->assertSame([$paid->id], ShopOrder::active()->pluck('id')->all());
        $this->assertSame([$paid->id], ShopOrder::paid()->pluck('id')->all());
        $this->assertSame([$canceled->id], ShopOrder::pending()->pluck('id')->all());

        $featured = $this->product(['is_featured' => true]);
        $this->product();
        $this->assertSame([$featured->id], ShopProduct::featured()->pluck('id')->all());

        Storage::fake('public');
        $variant = $this->variant($featured);
        $primary = $this->image($featured, 'p.jpg', ['is_primary' => true]);
        $variantImage = $this->image($featured, 'v.jpg', ['variant_id' => $variant->id, 'is_primary' => true]);
        $this->assertSame([$primary->id], ShopProductImage::primary()->pluck('id')->all());
        $this->assertSame([$primary->id], ShopProductImage::productImages()->pluck('id')->all());
        $this->assertSame([$variantImage->id], ShopProductImage::variantImages($variant->id)->pluck('id')->all());
    }

    /**
     * @description Relations and helpers: customer orders, supplier products, order item links
     *   and display name, product order items / primary image URL / ordered images, image owner
     *   + paths, price owner, variant owner.
     * @input Customer with an order of product P (variant V) by supplier S; P images (sort 2, 1 primary).
     * @output All relations resolve; display names; URL / path end with products/<file>; null URL without image.
     */
    public function test_relations_and_helpers(): void
    {
        Storage::fake('public');
        $supplier = $this->supplier();
        $product = $this->product(['name' => 'Lamp', 'supplier_id' => $supplier->id]);
        $variant = $this->variant($product, ['variant_name' => 'Black'], ['price_eur_with_vat' => 50]);
        $customer = $this->customer();
        $order = $this->order($customer, [], [[$product, 1, $variant], [$product, 2]]);
        [$withVariant, $plain] = ShopOrderItem::orderBy('id')->get()->all();
        $this->image($product, 'b.jpg', ['sort_order' => 2]);
        $primary = $this->image($product, 'a.jpg', ['sort_order' => 1, 'is_primary' => true, 'variant_id' => $variant->id]);

        $this->assertTrue($customer->orders->sole()->is($order));
        $this->assertTrue($supplier->products->sole()->is($product));
        $this->assertTrue($withVariant->order->is($order));
        $this->assertTrue($withVariant->product->is($product));
        $this->assertTrue($withVariant->variant->is($variant));
        $this->assertSame('Lamp - Black', $withVariant->getDisplayName());
        $this->assertSame('Lamp', $plain->getDisplayName());
        $this->assertSame(2, $product->orderItems()->count());
        $this->assertStringEndsWith('/storage/products/a.jpg', $product->getPrimaryImageUrl());
        $this->assertSame(['a.jpg', 'b.jpg'], $product->getOrderedImages()->pluck('image_path')->all());
        $this->assertTrue($primary->product->is($product));
        $this->assertTrue($primary->variant->is($variant));
        $this->assertStringEndsWith('app/public/products/a.jpg', $primary->getFullPath());
        $this->assertTrue($variant->prices->product->is($product));
        $this->assertTrue($variant->product->is($product));
        $this->assertTrue(ShopProductPrice::whereNull('variant_id')->sole()->product->is($product));
        $this->assertNull($this->product()->getPrimaryImageUrl());
    }

    /**
     * @description Order numbers are YYYYMM + 4-digit sequence per month (trashed orders count),
     *   a new month starts again at 0001.
     * @input Two orders in October 2026 (one trashed), then one in November.
     * @output 2026100001, 2026100002, next 2026100003; November 2026110001.
     */
    public function test_order_number_sequence(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 23));
        $first = $this->order();
        $second = $this->order();
        $second->delete();

        $this->assertSame(['2026100001', '2026100002'], [$first->order_number, $second->order_number]);
        $this->assertSame('2026100003', ShopOrder::generateOrderNumber());
        $this->travelTo(now()->setDate(2026, 11, 2));
        $this->assertSame('2026110001', ShopOrder::generateOrderNumber());
    }

    /**
     * @description Status labels (English, finding #29) fall back to the raw value; product
     *   stock follows its variants (saved / deleted); a product without category is inactive;
     *   restoring stock ignores items whose product / variant no longer exist.
     * @input Order statuses; variants 2 + 3 then one deleted; product saved without category;
     *        order with items of a trashed variant and a trashed product.
     * @output Labels; stock 5 then 3; is_active false; restoreStock() without error.
     */
    public function test_labels_stock_and_product_rules(): void
    {
        $order = $this->order(null, ['status' => 'shipped', 'payment_status' => 'cod']);
        $this->assertSame(['Shipped', 'Cash on delivery'], [$order->getStatusLabel(), $order->getPaymentStatusLabel()]);
        $this->assertSame(['Awaiting confirmation', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Returned', 'Canceled'], array_values(ShopOrder::getStatusOptions()));
        $order->forceFill(['status' => 'lost', 'payment_status' => 'unpaid']);
        $this->assertSame(['lost', 'unpaid'], [$order->getStatusLabel(), $order->getPaymentStatusLabel()]);
        $this->assertCount(7, ShopOrder::getStatusOptions());
        $this->assertCount(5, ShopOrder::getPaymentStatusOptions());

        $product = $this->product();
        $this->variant($product, ['stock_quantity' => 2]);
        $second = $this->variant($product, ['variant_name' => 'B', 'stock_quantity' => 3]);
        $this->assertSame(5, $product->fresh()->stock_quantity);
        $second->delete();
        $this->assertSame(2, $product->fresh()->stock_quantity);

        $loose = $this->product(['category_id' => null]);
        $this->assertFalse($loose->is_active);

        $gone = $this->variant($product, ['variant_name' => 'Gone']);
        $removed = $this->product();
        $orphan = $this->order(null, [], [[$product, 1, $gone], [$removed, 4]]);
        $gone->delete();
        $removed->delete();
        $orphan->load('items')->restoreStock();
        $this->assertSame(2, $product->fresh()->stock_quantity);
    }
}
