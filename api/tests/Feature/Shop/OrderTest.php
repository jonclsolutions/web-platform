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
        $this->getJson('/api/shop/orders?per_page=1')->assertJson(['meta' => ['total' => 2, 'last_page' => 2]]);
        $this->getJson('/api/shop/orders?no_pagination=1')->assertOk()->assertJsonCount(2, 'data');
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
            ->assertJsonPath('data.total_amount', 250)->assertJsonPath('data.discount_amount', 25)->assertJsonPath('data.shipping_amount', 5)
            ->assertJsonPath('data.final_amount', 230)->assertJsonCount(2, 'data.items')->assertJsonPath('data.items.1.variant_name', 'V')
            ->assertJsonPath('data.paid_at', fn ($v) => $v !== null)->assertJsonPath('data.status_label', 'Confirmed')
            ->assertJsonPath('data.items.0.vat_rate', 21)->assertJsonPath('data.contact.full_name', 'Jan Novak')->assertJsonPath('data.contact.email', 'jan@example.com');

        $this->assertEqualsWithDelta(225 * 21 / 121, $response->json('data.tax_amount'), 0.01);
        $this->assertSame([8, 4, 4], [$p->fresh()->stock_quantity, $v->fresh()->stock_quantity, $q->fresh()->stock_quantity]);
        $this->assertSame(1, $coupon->fresh()->usage_count);
        $this->assertEquals(225, ShopCustomer::where('email', 'jan@example.com')->sole()->total_spent);
        $this->assertShopLog('create', 'Created order: ' . $response->json('data.order_number'));
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
            ->assertJsonPath('data.discount_amount', 30)->assertJsonPath('data.customer_id', $existing->id)->assertJsonPath('data.final_amount', 75);
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
     * @output 200: order contact Iva (customer master data unchanged: Eva, finding #23); items i1 (300)
     *   + new (50); total 350, discount 35, final 320; x1 unchanged; stock of the pending order moved by
     *   the item edits (finding #24): 10 − 2 (1 → 3) + 1 (deleted) − 1 (new) = 8.
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

        $this->getJson("/api/shop/orders/{$order->id}")->assertOk()->assertJsonCount(2, 'data.items');
        $this->getJson('/api/shop/orders/999')->assertStatus(404);

        $this->putJson("/api/shop/orders/{$order->id}", [
            'first_name' => 'Iva',
            'items' => [
                ['id' => $i1->id, 'product_id' => $p->id, 'quantity' => 3, 'unit_price' => 100],
                ['id' => $x1->id, 'product_id' => $p->id, 'quantity' => 9, 'unit_price' => 1],
                ['product_id' => $p->id, 'quantity' => 1, 'unit_price' => 50],
            ],
            'delete_items' => [$i2->id, $x1->id],
        ])->assertOk()->assertJsonPath('data.contact.first_name', 'Iva')->assertJsonPath('data.customer.first_name', 'Eva')->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.total_amount', 350)->assertJsonPath('data.discount_amount', 35)->assertJsonPath('data.shipping_amount', 5)->assertJsonPath('data.final_amount', 320);

        $this->assertSame([2, '242.00'], [$x1->fresh()->quantity, $x1->fresh()->total_price]);
        $this->assertNull(ShopOrderItem::find($i2->id));
        $this->assertSame(8, $p->fresh()->stock_quantity);
        $this->assertSame('Iva', $order->fresh()->customer_first_name);
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

        $this->putJson("/api/shop/orders/{$order->id}", ['status' => 'canceled'])->assertOk()->assertJsonPath('data.status', 'canceled')->assertJsonPath('data.discount_amount', 20);
        $this->assertSame([10, 5, 5], [$p->fresh()->stock_quantity, $v->fresh()->stock_quantity, $q->fresh()->stock_quantity]);
        $this->putJson("/api/shop/orders/{$order->id}", ['status' => 'pending'])->assertOk();
        $this->assertSame([8, 4], [$p->fresh()->stock_quantity, $v->fresh()->stock_quantity]);
        $this->putJson("/api/shop/orders/{$order->id}", ['status' => 'shipped', 'shipped_at' => '2026-10-23 10:00:00'])->assertOk()->assertJsonPath('data.shipped_at', fn ($t) => str_starts_with($t, '2026-10-23'));
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
        $this->postJson("/api/shop/orders/{$d->id}/restore")->assertOk()->assertJsonPath('data.deleted_at', null)->assertJsonCount(1, 'data.items');
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

    /**
     * @description EU VAT (finding #21): the rate of every line is stored from the catalogue
     *   (variant price, else product price; the form value only without catalogue price) and the
     *   order tax uses the stored rates - also after an edit.
     * @input Product R price 110 EUR at 10 % (form sends 21 %), variant Z of R with own price at 0 %,
     *        product N without price (form 12 %); PUT adding another R line.
     * @output Items vat 10 / 0 / 12 stored; tax = 2×110×10/110 + 0 + 50×12/112; after the edit the
     *   new line has 10 % and the tax is recomputed with the stored rates (not 21 %).
     */
    public function test_vat_rate_is_stored_per_item(): void
    {
        $this->signIn($this->userWith(['shop-orders-create', 'shop-orders-update']));
        $reduced = $this->product(['name' => 'R'], ['vat_rate' => 10, 'price_eur_with_vat' => 110, 'price_eur_without_vat' => 100]);
        $zero = $this->variant($reduced, ['variant_name' => 'Z'], ['vat_rate' => 0, 'price_eur_with_vat' => 30, 'price_eur_without_vat' => 30]);
        $noPrice = $this->product(['name' => 'N'], null);

        $response = $this->postJson('/api/shop/orders', $this->payload([
            ['product_id' => $reduced->id, 'quantity' => 2, 'unit_price' => 110, 'vat_rate' => 21],
            ['product_id' => $reduced->id, 'product_variant_id' => $zero->id, 'quantity' => 1, 'unit_price' => 30, 'vat_rate' => 21],
            ['product_id' => $noPrice->id, 'quantity' => 1, 'unit_price' => 50, 'vat_rate' => 12],
        ]))->assertCreated();

        $this->assertSame([10.0, 0.0, 12.0], array_map('floatval', array_column($response->json('data.items'), 'vat_rate')));
        $this->assertEquals([10, 0, 12], ShopOrderItem::orderBy('id')->pluck('vat_rate')->map(fn ($v) => (float) $v)->all());
        $this->assertEqualsWithDelta(220 * 10 / 110 + 50 * 12 / 112, $response->json('data.tax_amount'), 0.01);

        $id = $response->json('data.id');
        $items = collect($response->json('data.items'))->map(fn ($i) => ['id' => $i['id'], 'product_id' => $i['product_id'], 'quantity' => $i['quantity'], 'unit_price' => $i['unit_price']])->all();
        $items[] = ['product_id' => $reduced->id, 'quantity' => 1, 'unit_price' => 110];
        $edited = $this->putJson("/api/shop/orders/{$id}", ['items' => $items])->assertOk();

        $this->assertEquals(10, $edited->json('data.items.3.vat_rate'));
        $this->assertEqualsWithDelta(330 * 10 / 110 + 50 * 12 / 112, $edited->json('data.tax_amount'), 0.01);
    }

    /**
     * @description Item edits move stock only while the order holds it (finding #24): a cancelled
     *   order's items can be changed without touching the stock; reopening then takes the edited
     *   quantities; a variant line moves the variant (and the product sum).
     * @input Cancelled order with P×1 (P 10) and V×1 (V 5); PUT P→4, V→2; PUT status pending; PUT V→1.
     * @output Stock unchanged after the first edit; P 6 / V 3 after reopen; V 4 after lowering V to 1.
     */
    public function test_item_edits_move_stock_only_for_active_orders(): void
    {
        $this->signIn($this->userWith(['shop-orders-update']));
        $p = $this->product(['name' => 'P']);
        $q = $this->product(['name' => 'Q']);
        $v = $this->variant($q, ['variant_name' => 'V', 'stock_quantity' => 5]);
        $order = $this->order(null, ['status' => 'canceled'], [[$p, 1], [$q, 1, $v]]);
        [$ip, $iv] = $order->items()->orderBy('id')->get()->all();
        $line = fn ($item, $product, $qty, $variant = null) => array_filter(['id' => $item->id, 'product_id' => $product->id, 'product_variant_id' => $variant?->id, 'quantity' => $qty, 'unit_price' => 10]);

        $this->putJson("/api/shop/orders/{$order->id}", ['items' => [$line($ip, $p, 4), $line($iv, $q, 2, $v)]])->assertOk();
        $this->assertSame([10, 5], [$p->fresh()->stock_quantity, $v->fresh()->stock_quantity]);

        $this->putJson("/api/shop/orders/{$order->id}", ['status' => 'pending'])->assertOk();
        $this->assertSame([6, 3, 3], [$p->fresh()->stock_quantity, $v->fresh()->stock_quantity, $q->fresh()->stock_quantity]);

        $this->putJson("/api/shop/orders/{$order->id}", ['items' => [$line($iv, $q, 1, $v)]])->assertOk();
        $this->assertSame([4, 4], [$v->fresh()->stock_quantity, $q->fresh()->stock_quantity]);
    }

    /**
     * @description The order keeps the buyer contact given for it (snapshot): an existing customer
     *   is only linked (master data untouched, also a trashed one), the search finds the snapshot
     *   e-mail, and an order without snapshot shows the customer's data.
     * @input Trashed customer jan@example.com 'Old'; admin order for jan@example.com as Jan Novak;
     *        order without snapshot of customer Eva; search 'jan@example'.
     * @output Same customer id, still trashed, first_name Old; contact Jan Novak; Eva's order contact
     *   from the customer; search finds the new order.
     */
    public function test_order_keeps_its_contact(): void
    {
        $this->signIn($this->userWith(['shop-orders-create', 'shop-orders-view']));
        $p = $this->product(['name' => 'P']);
        $old = $this->customer(['email' => 'jan@example.com', 'first_name' => 'Old']);
        $old->delete();

        $response = $this->postJson('/api/shop/orders', $this->payload([['product_id' => $p->id, 'quantity' => 1, 'unit_price' => 100]]))
            ->assertCreated()->assertJsonPath('data.customer_id', $old->id)->assertJsonPath('data.contact.full_name', 'Jan Novak');
        $this->assertTrue($old->fresh()->trashed());
        $this->assertSame('Old', $old->fresh()->first_name);

        $legacy = $this->order($this->customer());
        $this->getJson("/api/shop/orders/{$legacy->id}")->assertJsonPath('data.contact.full_name', 'Eva Nova')->assertJsonPath('data.contact.email', 'eva@example.com');
        $this->assertSame([$response->json('data.id')], array_column($this->getJson('/api/shop/orders?search=jan@example')->json('data'), 'id'));
    }
}
