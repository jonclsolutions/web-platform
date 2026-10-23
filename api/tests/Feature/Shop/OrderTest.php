<?php

/**
 * @file OrderTest.php
 * @path api/tests/Feature/Shop/OrderTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the order administration (ShopOrderController): list with
 *   filters, manual order (customer, stock, coupon rules, totals and tax), edit (customer,
 *   items only of the edited order, totals, stock on cancel / reopen), delete / restore /
 *   trash with stock restoration.
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures.
 */

namespace Tests\Feature\Shop;

use App\Models\Shop\ShopCustomer;
use App\Models\Shop\ShopOrder;
use App\Models\Shop\ShopOrderItem;
use App\Models\Shop\ShopPaymentMethod;
use App\Models\Shop\ShopShippingMethod;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/orders.
 */
class OrderTest extends TestCase
{
    use ShopFixtures;

    /** @var string[] All order permissions. */
    private const ALL = ['shop-orders-view', 'shop-orders-create', 'shop-orders-update', 'shop-orders-delete'];

    /** @var ShopPaymentMethod Payment method of the tests. */
    private ShopPaymentMethod $payment;

    /** @var ShopShippingMethod Shipping method of the tests (5 EUR). */
    private ShopShippingMethod $shipping;

    /**
     * @description Payment and shipping method used by the orders.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->payment = $this->paymentMethod();
        $this->shipping = $this->shippingMethod();
    }

    /**
     * @description A valid manual order body.
     * @param array<int, array<string, mixed>> $items Order lines.
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function payload(array $items, array $overrides = []): array
    {
        return array_merge([
            'email' => 'jan@example.com', 'first_name' => 'Jan', 'last_name' => 'Novak', 'phone' => '777111222',
            'payment_method_id' => $this->payment->id, 'shipping_method_id' => $this->shipping->id, 'status' => 'pending', 'payment_status' => 'pending',
            'shipping_address' => 'Main 1', 'shipping_city' => 'Praha', 'shipping_postal_code' => '11000', 'shipping_country' => 'CZ', 'items' => $items,
        ], $overrides);
    }

    /**
     * @description List: permission, newest first, search (number, customer), filters (id, status
     *   list, payment status, customer, amount, dates), relation sort refused, trash, export.
     * @input A (Eva, 202610…, paid, shipped, 121, yesterday, 1 item), B (Petr, pending, 500), C trashed.
     * @output Each filter returns the expected order; items_count 1.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/shop/orders')->assertStatus(403);

        $this->signIn($this->userWith(['shop-orders-view']));
        $eva = $this->customer();
        $a = $this->order($eva, ['status' => 'shipped', 'payment_status' => 'paid'], [[$this->product(), 1]]);
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $b = $this->order($this->customer(['email' => 'petr@x.cz', 'first_name' => 'Petr']), ['final_amount' => 500, 'shipping_address' => 'Hill 2']);
        $this->order()->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/shop/orders?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$a->id], $ids('search=eva@'));
        $this->assertSame([$b->id], $ids('search=Hill'));
        $this->assertSame([$a->id], $ids("id={$a->id}&order_number=" . substr($a->order_number, 0, 6)));
        $this->assertSame([$a->id], $ids('status=shipped'));
        $this->assertSame([$b->id, $a->id], $ids('status=pending,shipped'));
        $this->assertSame([$a->id], $ids('payment_status=paid'));
        $this->assertSame([$a->id], $ids("customer_id={$eva->id}"));
        $this->assertSame([$b->id], $ids('amount_from=200'));
        $this->assertSame([$a->id], $ids('amount_to=200'));
        $this->assertSame([$a->id], $ids('date_to=' . now()->subDay()->toDateString()));
        $this->assertSame([$b->id], $ids('date_from=' . now()->toDateString()));
        $this->assertSame([$b->id, $a->id], $ids('sort_by=customer.email&sort_direction=desc'));
        $this->assertCount(1, $this->getJson('/api/shop/orders?only_trashed=1')->json('data'));
        $this->getJson("/api/shop/orders?id={$a->id}")->assertJsonPath('data.0.items_count', 1)->assertJsonPath('data.0.customer.email', 'eva@example.com');
        $this->getJson('/api/shop/orders?per_page=1')->assertJson(['total' => 2, 'last_page' => 2]);
        $this->getJson('/api/shop/orders?no_pagination=1')->assertOk()->assertJsonCount(2);
    }

    /**
     * @description Manual order: new customer, stock taken from product and variant, 10 %
     *   coupon (usage counted), shipping 5 EUR, tax from the discounted lines, paid_at for a paid
     *   order, customer total spent.
     * @input Product P (10 pcs), product Q with variant V (5 pcs); items P×2 @100, Q/V×1 @50;
     *        coupon SAVE10; status confirmed, paid.
     * @output 201 total 250, discount 25, final 230, tax ≈ 39.05, 2 items (V name); P stock 8,
     *   V 4, Q 4; coupon used 1; paid_at set; customer total_spent 225.
     */
    public function test_store(): void
    {
        $this->signIn($this->userWith(['shop-orders-create']));
        $p = $this->product(['name' => 'P']);
        $q = $this->product(['name' => 'Q']);
        $v = $this->variant($q, ['variant_name' => 'V', 'stock_quantity' => 5]);
        $coupon = $this->coupon();

        $response = $this->postJson('/api/shop/orders', $this->payload([
            ['product_id' => $p->id, 'quantity' => 2, 'unit_price' => 100],
            ['product_id' => $q->id, 'product_variant_id' => $v->id, 'quantity' => 1, 'unit_price' => 50],
        ], ['coupon_id' => $coupon->id, 'status' => 'confirmed', 'payment_status' => 'paid']))->assertCreated()
            ->assertJsonPath('total_amount', 250)->assertJsonPath('discount_amount', 25)->assertJsonPath('shipping_amount', 5)
            ->assertJsonPath('final_amount', 230)->assertJsonCount(2, 'items')->assertJsonPath('items.1.variant_name', 'V')
            ->assertJsonPath('paid_at', fn ($v) => $v !== null)->assertJsonPath('status_label', 'Potvrzena');

        $this->assertEqualsWithDelta(225 * 21 / 121, $response->json('tax_amount'), 0.01);
        $this->assertSame([8, 4, 4], [$p->fresh()->stock_quantity, $v->fresh()->stock_quantity, $q->fresh()->stock_quantity]);
        $this->assertSame(1, $coupon->fresh()->usage_count);
        $this->assertEquals(225, ShopCustomer::where('email', 'jan@example.com')->sole()->total_spent);
        $this->assertShopLog('create', 'Created order: ' . $response->json('order_number'));
    }

    /**
     * @description Manual order validation: stock, required fields and every coupon rule; a
     *   fixed coupon; the existing customer is reused.
     * @input P (1 pc): quantity 2; variant V (0 pcs); {}; coupons inactive / future / expired /
     *        exhausted / minimum 1000; fixed 30 EUR coupon for an existing customer.
     * @output 422 "Only 1 pcs …"; 422 variant; 422 fields; 422 per coupon; 201 discount 30, same customer.
     */
    public function test_store_validation_and_coupon_rules(): void
    {
        $this->signIn($this->userWith(['shop-orders-create']));
        $p = $this->product(['name' => 'P', 'stock_quantity' => 1]);
        $v = $this->variant($this->product(['name' => 'Q']), ['variant_name' => 'V', 'stock_quantity' => 0]);
        $line = [['product_id' => $p->id, 'quantity' => 1, 'unit_price' => 100]];

        $this->postJson('/api/shop/orders', $this->payload([['product_id' => $p->id, 'quantity' => 2, 'unit_price' => 100]]))
            ->assertStatus(422)->assertJsonPath('errors', fn ($e) => str_contains($e['items.0.quantity'][0], "Only 1 pcs of product 'P'"));
        $this->postJson('/api/shop/orders', $this->payload([['product_id' => $v->product_id, 'product_variant_id' => $v->id, 'quantity' => 1, 'unit_price' => 1]]))
            ->assertStatus(422)->assertJsonPath('errors', fn ($e) => str_contains($e['items.0.quantity'][0], "variant 'V'"));
        $this->postJson('/api/shop/orders', [])->assertStatus(422)->assertJsonPath('errors.items.0', 'The order must contain at least one item.');
        $this->postJson('/api/shop/orders', $this->payload($line, ['shipping_postal_code' => str_repeat('1', 11)]))->assertStatus(422)->assertJsonValidationErrors(['shipping_postal_code']);

        $cases = [
            'This coupon is not active.' => ['is_active' => false],
            'The validity of this coupon has not started yet.' => ['valid_from' => now()->addDay()],
            'The validity of this coupon has already expired.' => ['valid_until' => now()->subDay()],
            'This coupon has already been exhausted.' => ['max_usage' => 1, 'usage_count' => 1],
            'The minimum order amount for this coupon is 1,000.00 EUR.' => ['min_order_amount' => 1000],
        ];
        foreach ($cases as $message => $attributes) {
            $coupon = $this->coupon(array_merge(['code' => 'C' . md5($message)], $attributes));
            $this->postJson('/api/shop/orders', $this->payload($line, ['coupon_id' => $coupon->id]))->assertStatus(422)->assertExactJson(['message' => $message]);
        }

        $existing = $this->customer(['email' => 'jan@example.com']);
        $fixed = $this->coupon(['code' => 'FIX30', 'discount_type' => 'fixed', 'discount_value' => 30]);
        $this->postJson('/api/shop/orders', $this->payload($line, ['coupon_id' => $fixed->id]))->assertCreated()
            ->assertJsonPath('discount_amount', 30)->assertJsonPath('customer_id', $existing->id)->assertJsonPath('final_amount', 75);
        $this->assertSame(1, ShopCustomer::count());
    }

    /**
     * @description A database error answers 500 without SQL details and takes nothing from stock.
     * @input shop_orders INSERT fails.
     * @output 500 "Order creation failed."; P stock unchanged; shop log 'error'.
     */
    public function test_store_database_error(): void
    {
        $this->signIn($this->userWith(['shop-orders-create']));
        $p = $this->product(['name' => 'P']);
        $this->failOn('shop_orders', 'INSERT');

        $this->postJson('/api/shop/orders', $this->payload([['product_id' => $p->id, 'quantity' => 1, 'unit_price' => 100]]))
            ->assertStatus(500)->assertExactJson(['message' => 'Order creation failed.']);
        $this->assertSame(10, $p->fresh()->stock_quantity);
        $this->assertShopLog('error', 'Order creation failed');
    }

    /**
     * @description Edit: customer details, own items changed / deleted / added, totals with a
     *   percent coupon and shipping recalculated; items of ANOTHER order are never touched (IDOR);
     *   detail; 404s.
     * @input Order O (coupon 10 %, items i1 P×1, i2 P×1), order X (item x1). PUT O {first_name Iva,
     *        items [{id i1, 3 × 100}, {id x1, 9 × 1}, {new P×1 @50}], delete_items [i2, x1]}; GET; /999.
     * @output 200: customer Iva; items i1 (300) + new (50); total 350, discount 35, final 320; x1 unchanged.
     */
    public function test_update_items_of_own_order_only(): void
    {
        $this->signIn($this->userWith(['shop-orders-view', 'shop-orders-update']));
        $p = $this->product(['name' => 'P']);
        $coupon = $this->coupon();
        $order = $this->order(null, ['coupon_id' => $coupon->id, 'shipping_method_id' => $this->shipping->id], [[$p, 1], [$p, 1]]);
        [$i1, $i2] = $order->items()->orderBy('id')->get()->all();
        $foreign = $this->order(null, [], [[$p, 2]]);
        $x1 = $foreign->items()->sole();

        $this->getJson("/api/shop/orders/{$order->id}")->assertOk()->assertJsonCount(2, 'items');
        $this->getJson('/api/shop/orders/999')->assertStatus(404);

        $this->putJson("/api/shop/orders/{$order->id}", [
            'first_name' => 'Iva',
            'items' => [
                ['id' => $i1->id, 'product_id' => $p->id, 'quantity' => 3, 'unit_price' => 100],
                ['id' => $x1->id, 'product_id' => $p->id, 'quantity' => 9, 'unit_price' => 1],
                ['product_id' => $p->id, 'quantity' => 1, 'unit_price' => 50],
            ],
            'delete_items' => [$i2->id, $x1->id],
        ])->assertOk()->assertJsonPath('customer.first_name', 'Iva')->assertJsonCount(2, 'items')
            ->assertJsonPath('total_amount', 350)->assertJsonPath('discount_amount', 35)->assertJsonPath('shipping_amount', 5)->assertJsonPath('final_amount', 320);

        $this->assertSame([2, '242.00'], [$x1->fresh()->quantity, $x1->fresh()->total_price]);
        $this->assertNull(ShopOrderItem::find($i2->id));
        $this->assertShopLog('update', 'Updated order: ' . $order->order_number);
        $this->putJson('/api/shop/orders/999', ['notes' => 'x'])->assertStatus(404);
    }

    /**
     * @description Cancelling returns the pieces to stock, reopening takes them again, a
     *   status change between active states moves nothing; a fixed coupon in the totals.
     * @input Order (fixed 20 EUR coupon, no shipping) with P×2 (P stock 8) and V×1 (V stock 4);
     *        PUT status canceled; PUT status pending; PUT status shipped.
     * @output P 10 / V 5 after cancel; P 8 / V 4 after reopen; unchanged after shipped; discount 20.
     */
    public function test_update_status_moves_stock(): void
    {
        $this->signIn($this->userWith(['shop-orders-update']));
        $p = $this->product(['name' => 'P', 'stock_quantity' => 8]);
        $q = $this->product(['name' => 'Q']);
        $v = $this->variant($q, ['stock_quantity' => 4]);
        $fixed = $this->coupon(['code' => 'FIX20', 'discount_type' => 'fixed', 'discount_value' => 20]);
        $order = $this->order(null, ['coupon_id' => $fixed->id], [[$p, 2], [$q, 1, $v]]);

        $this->putJson("/api/shop/orders/{$order->id}", ['status' => 'canceled'])->assertOk()->assertJsonPath('status', 'canceled')->assertJsonPath('discount_amount', 20);
        $this->assertSame([10, 5, 5], [$p->fresh()->stock_quantity, $v->fresh()->stock_quantity, $q->fresh()->stock_quantity]);
        $this->putJson("/api/shop/orders/{$order->id}", ['status' => 'pending'])->assertOk();
        $this->assertSame([8, 4], [$p->fresh()->stock_quantity, $v->fresh()->stock_quantity]);
        $this->putJson("/api/shop/orders/{$order->id}", ['status' => 'shipped', 'shipped_at' => '2026-10-23 10:00:00'])->assertOk()->assertJsonPath('shipped_at', fn ($t) => str_starts_with($t, '2026-10-23'));
        $this->assertSame([8, 4], [$p->fresh()->stock_quantity, $v->fresh()->stock_quantity]);
        $this->putJson("/api/shop/orders/{$order->id}", ['status' => 'lost'])->assertStatus(422);
    }

    /**
     * @description Edit rules: a newly assigned coupon must be valid (the current one may stay);
     *   a database error answers 500 without SQL details.
     * @input Order with expired coupon E: PUT {coupon_id E}; PUT {coupon_id other expired};
     *        failing shop_orders UPDATE.
     * @output 200; 422 "no longer valid"; 500 "Update failed.".
     */
    public function test_update_rules_and_error(): void
    {
        $this->signIn($this->userWith(['shop-orders-update']));
        $expired = $this->coupon(['code' => 'OLD', 'valid_until' => now()->subDay()]);
        $other = $this->coupon(['code' => 'OLD2', 'valid_until' => now()->subDay()]);
        $order = $this->order(null, ['coupon_id' => $expired->id], [[$this->product(), 1]]);

        $this->putJson("/api/shop/orders/{$order->id}", ['coupon_id' => $expired->id])->assertOk();
        $this->putJson("/api/shop/orders/{$order->id}", ['coupon_id' => $other->id])->assertStatus(422)
            ->assertJsonPath('errors.coupon_id.0', 'This coupon is no longer valid and cannot be newly assigned to the order.');

        $this->failOn('shop_orders', 'UPDATE');
        $this->putJson("/api/shop/orders/{$order->id}", ['notes' => 'Boom'])->assertStatus(500)->assertExactJson(['message' => 'Update failed.']);
    }

    /**
     * @description Delete: soft keeps stock; permanent returns the pieces of an active order
     *   (not of a cancelled one); restore works (was always 500); empty trash returns stock of
     *   active orders; 404s; database errors.
     * @input P stock 5. A (P×2, pending), B (P×1, canceled), C (P×3, pending, trashed), D.
     * @output A soft: P 5; A permanent: P 7; B permanent: P 7; restore D 200 with items; trash: P 10;
     *   404s; 500s.
     */
    public function test_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $p = $this->product(['name' => 'P', 'stock_quantity' => 5]);
        $a = $this->order(null, [], [[$p, 2]]);
        $b = $this->order(null, ['status' => 'canceled'], [[$p, 1]]);
        $c = $this->order(null, [], [[$p, 3]]);
        $d = $this->order(null, [], [[$p, 1]]);

        $this->deleteJson("/api/shop/orders/{$a->id}")->assertNoContent();
        $this->assertSoftDeleted($a);
        $this->assertSame(5, $p->fresh()->stock_quantity);
        $this->deleteJson("/api/shop/orders/{$a->id}?force_delete=1")->assertNoContent();
        $this->assertSame(7, $p->fresh()->stock_quantity);
        $this->assertSame(0, ShopOrderItem::where('order_id', $a->id)->count());
        $this->deleteJson("/api/shop/orders/{$b->id}?force_delete=1")->assertNoContent();
        $this->assertSame(7, $p->fresh()->stock_quantity);
        $this->assertShopLog('hard_delete', "Deleted order ID: {$b->id}");
        $this->deleteJson('/api/shop/orders/999')->assertStatus(404);

        $d->delete();
        $this->postJson("/api/shop/orders/{$d->id}/restore")->assertOk()->assertJsonPath('deleted_at', null)->assertJsonCount(1, 'items');
        $this->assertShopLog('restore', "Restored order ID: {$d->id}");
        $this->postJson('/api/shop/orders/999/restore')->assertStatus(404);

        $c->delete();
        $this->deleteJson('/api/shop/orders/force-delete-all')->assertNoContent();
        $this->assertSame(10, $p->fresh()->stock_quantity);
        $this->assertNull(ShopOrder::withTrashed()->find($c->id));
        $this->assertShopLog('force_delete_all', 'Count: 1');

        $e = $this->order(null, [], [[$p, 1]]);
        $e->delete();
        $this->failOn('shop_orders', 'DELETE');
        $this->deleteJson("/api/shop/orders/{$d->id}?force_delete=1")->assertStatus(500)->assertJson(['message' => 'Deletion failed.']);
        $this->deleteJson('/api/shop/orders/force-delete-all')->assertStatus(500)->assertJson(['message' => 'Error purging trash.']);
        $this->assertSame(10, $p->fresh()->stock_quantity);
        $this->failOn('shop_orders', 'UPDATE');
        $this->postJson("/api/shop/orders/{$e->id}/restore")->assertStatus(500)->assertJson(['message' => 'Order restoration failed.']);
    }
}
