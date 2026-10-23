<?php

/**
 * @file CheckoutTest.php
 * @path api/tests/Feature/Shop/CheckoutTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the public checkout (ShopCheckoutController): order created
 *   with catalogue prices (never the prices sent by the browser), availability checks, coupon
 *   rules, customer handling, error / rate limit behaviour and the payment simulation (dev
 *   systems only).
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures; Illuminate\Support\Lottery (payment odds).
 */

namespace Tests\Feature\Shop;

use App\Models\Shop\ShopCustomer;
use App\Models\Shop\ShopOrder;
use App\Models\Shop\ShopPaymentMethod;
use App\Models\Shop\ShopShippingMethod;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Lottery;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/checkout/{create-order,simulate-payment}.
 */
class CheckoutTest extends TestCase
{
    use ShopFixtures;

    /** @var ShopPaymentMethod Payment method of the tests. */
    private ShopPaymentMethod $payment;

    /** @var ShopShippingMethod Shipping method of the tests (5 EUR). */
    private ShopShippingMethod $shipping;

    /**
     * @description Payment / shipping methods; payment simulation on, Lottery back to random.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->payment = $this->paymentMethod();
        $this->shipping = $this->shippingMethod();
        config(['services.shop.payment_simulation' => true]);
    }

    /**
     * @description Restores the real Lottery odds after a test forced them.
     * @return void
     */
    protected function tearDown(): void
    {
        Lottery::determineResultNormally();
        parent::tearDown();
    }

    /**
     * @description A valid checkout body.
     * @param array<int, array<string, mixed>> $items Cart lines.
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function payload(array $items, array $overrides = []): array
    {
        return array_merge([
            'email' => ' Jan@Example.com ', 'first_name' => 'Jan', 'last_name' => 'Novak', 'phone' => '777111222',
            'address' => 'Main 1', 'city' => 'Praha', 'postal_code' => '11000', 'country' => 'CZ',
            'payment_method_id' => $this->payment->id, 'shipping_method_id' => $this->shipping->id, 'items' => $items,
        ], $overrides);
    }

    /**
     * @description SECURITY: the order uses the catalogue prices and VAT rates - the cheap
     *   prices / VAT sent by the browser are ignored; a variant uses its own price (else the
     *   product price); stock is taken, coupon applied and counted, shipping added, customer created.
     * @input Product P 121 EUR / 21 % (10 pcs) ×2 sent at 0.01 EUR / 0 %; product B 110 EUR / 10 % with
     *        variant V1 (own price 55, 3 pcs) ×1 and variant V2 (no price, 4 pcs) ×1; coupon SAVE10.
     * @output 201 pending; items 121 / 55 / 110; total 407, discount 40.70, final 371.30;
     *   tax = Σ line × 0.9 × rate / (100 + rate); stock P 8, V1 2, V2 3, B 5; coupon used 1;
     *   customer jan@example.com; no gateway config in the answer.
     */
    public function test_order_is_priced_from_the_catalogue(): void
    {
        $p = $this->product(['name' => 'P']);
        $b = $this->product(['name' => 'B'], ['vat_rate' => 10, 'price_eur_without_vat' => 100, 'price_eur_with_vat' => 110]);
        $v1 = $this->variant($b, ['variant_name' => 'V1', 'stock_quantity' => 3], ['vat_rate' => 10, 'price_eur_without_vat' => 50, 'price_eur_with_vat' => 55]);
        $v2 = $this->variant($b, ['variant_name' => 'V2', 'stock_quantity' => 4]);
        $coupon = $this->coupon();

        $json = $this->postJson('/api/shop/checkout/create-order', $this->payload([
            ['product_id' => $p->id, 'quantity' => 2, 'unit_price' => 0.01, 'vat_rate' => 0],
            ['product_id' => $b->id, 'product_variant_id' => $v1->id, 'quantity' => 1, 'unit_price' => 0.01],
            ['product_id' => $b->id, 'product_variant_id' => $v2->id, 'quantity' => 1],
        ], ['coupon_code' => 'SAVE10', 'notes' => 'Ring twice']))->assertCreated()
            ->assertJsonPath('status', 'pending')->assertJsonPath('payment_status', 'pending')
            ->assertJsonPath('items.0.unit_price', 121)->assertJsonPath('items.0.total_price', 242)
            ->assertJsonPath('items.1.unit_price', 55)->assertJsonPath('items.1.variant_name', 'V1')->assertJsonPath('items.2.unit_price', 110)
            ->assertJsonPath('total_amount', 407)->assertJsonPath('discount_amount', 40.7)->assertJsonPath('shipping_amount', 5)
            ->assertJsonPath('final_amount', 371.3)->assertJsonPath('customer.email', 'jan@example.com')->assertJsonPath('notes', 'Ring twice')->json();

        $expectedTax = 242 * 0.9 * 21 / 121 + 55 * 0.9 * 10 / 110 + 110 * 0.9 * 10 / 110;
        $this->assertEqualsWithDelta($expectedTax, $json['tax_amount'], 0.01);
        $this->assertArrayNotHasKey('config', $json['payment_method']);
        $this->assertSame([8, 2, 3, 5], [$p->fresh()->stock_quantity, $v1->fresh()->stock_quantity, $v2->fresh()->stock_quantity, $b->fresh()->stock_quantity]);
        $this->assertSame(1, $coupon->fresh()->usage_count);
        $this->assertShopLog('create', 'Created order: ' . $json['order_number']);
    }

    /**
     * @description Lines that cannot be ordered are refused with 422 and nothing is written:
     *   inactive / trashed product, variant of another product, sold out product / variant,
     *   product without a price.
     * @input One request per case.
     * @output 422 with the reason; no order, stock unchanged.
     */
    public function test_unavailable_lines_are_refused(): void
    {
        $inactive = $this->product(['name' => 'Off']);
        $inactive->update(['is_active' => false]);
        $trashed = $this->product(['name' => 'Gone']);
        $trashed->delete();
        $p = $this->product(['name' => 'P', 'stock_quantity' => 1]);
        $other = $this->product(['name' => 'Other']);
        $foreignVariant = $this->variant($other, ['variant_name' => 'W']);
        $soldOut = $this->variant($this->product(['name' => 'S']), ['variant_name' => 'Empty', 'stock_quantity' => 0]);
        $noPrice = $this->product(['name' => 'Free'], null);

        $cases = [
            'One of the products is no longer available.' => [['product_id' => $inactive->id, 'quantity' => 1]],
            'One of the products is no longer available.' . ' ' => [['product_id' => $trashed->id, 'quantity' => 1]],
            "The selected variant of 'P' is not available." => [['product_id' => $p->id, 'product_variant_id' => $foreignVariant->id, 'quantity' => 1]],
            "The product 'P' was sold out in the meantime. Available quantity: 1 pcs." => [['product_id' => $p->id, 'quantity' => 2]],
            "The product 'S (Empty)' was sold out in the meantime. Available quantity: 0 pcs." => [['product_id' => $soldOut->product_id, 'product_variant_id' => $soldOut->id, 'quantity' => 1]],
            "The product 'Free' has no price and cannot be ordered." => [['product_id' => $noPrice->id, 'quantity' => 1]],
        ];
        foreach ($cases as $message => $items) {
            $this->postJson('/api/shop/checkout/create-order', $this->payload(array_merge([['product_id' => $p->id, 'quantity' => 1]], $items)))
                ->assertStatus(422)->assertExactJson(['message' => trim($message)]);
            $this->travel(61)->seconds();
        }

        $this->assertSame(0, ShopOrder::count());
        $this->assertSame(1, $p->fresh()->stock_quantity);
    }

    /**
     * @description Coupon rules of the checkout; the minimum is stated in EUR.
     * @input Codes NOPE, OFF, SOON, OLD, USED, MIN (min 500) on a 121 EUR cart.
     * @output 422 with the message per case; no order.
     */
    public function test_coupon_rules(): void
    {
        $p = $this->product(['name' => 'P']);
        $this->coupon(['code' => 'OFF', 'is_active' => false]);
        $this->coupon(['code' => 'SOON', 'valid_from' => now()->addDay()]);
        $this->coupon(['code' => 'OLD', 'valid_until' => now()->subDay()]);
        $this->coupon(['code' => 'USED', 'max_usage' => 1, 'usage_count' => 1]);
        $this->coupon(['code' => 'MIN', 'min_order_amount' => 500]);

        $cases = [
            'NOPE' => 'The coupon is invalid or inactive.', 'OFF' => 'The coupon is invalid or inactive.',
            'SOON' => 'The coupon is not valid yet.', 'OLD' => 'The coupon has already expired.',
            'USED' => 'The coupon has been exhausted.', 'MIN' => 'The minimum order amount is 500.00 EUR.',
        ];
        foreach ($cases as $code => $message) {
            $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]], ['coupon_code' => $code]))
                ->assertStatus(422)->assertExactJson(['message' => $message]);
            $this->travel(61)->seconds();
        }
        $this->assertSame(0, ShopOrder::count());
    }

    /**
     * @description An existing (also trashed) customer is only linked (finding #23): the master
     *   data are not overwritten and a trashed customer is not restored; the order keeps the
     *   contact given at checkout; a fixed coupon; total spent counts only confirmed+ orders.
     * @input Trashed customer jan@example.com (Eva, Brno); checkout as Jan / Praha / Acme with FIX20.
     * @output 201 same customer id, still trashed, name / city unchanged; order contact Jan Novak, Acme;
     *   discount 20, final 106; total_spent 0; one customer row.
     */
    public function test_existing_customer_is_reused(): void
    {
        $p = $this->product(['name' => 'P']);
        $customer = $this->customer(['email' => 'jan@example.com', 'city' => 'Brno']);
        $customer->delete();
        $this->coupon(['code' => 'FIX20', 'discount_type' => 'fixed', 'discount_value' => 20]);

        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]], ['coupon_code' => 'FIX20', 'company' => 'Acme']))
            ->assertCreated()->assertJsonPath('customer_id', $customer->id)->assertJsonPath('discount_amount', 20)->assertJsonPath('final_amount', 106)
            ->assertJsonPath('contact.full_name', 'Jan Novak')->assertJsonPath('contact.company', 'Acme')->assertJsonPath('contact.email', 'jan@example.com');

        $customer->refresh();
        $this->assertTrue($customer->trashed());
        $this->assertSame(['Eva', 'Brno', null], [$customer->first_name, $customer->city, $customer->company]);
        $this->assertEquals(0, $customer->total_spent);
        $this->assertSame(1, ShopCustomer::withTrashed()->count());
    }

    /**
     * @description An active existing customer keeps the stored data; only empty fields are
     *   filled in from the checkout (finding #23). The line VAT rate is stored (finding #21).
     * @input Customer jan@example.com Eva, phone 777123456, no address / company; checkout as Jan,
     *        phone 777111222, address Main 1, company Acme; product at 10 %.
     * @output Name / phone unchanged; address, city, postal code, country, company filled in;
     *   order contact Jan / 777111222; item vat_rate 10.
     */
    public function test_existing_customer_only_gets_missing_fields(): void
    {
        $p = $this->product(['name' => 'P'], ['vat_rate' => 10]);
        $customer = $this->customer(['email' => 'jan@example.com']);

        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]], ['company' => 'Acme']))
            ->assertCreated()->assertJsonPath('contact.first_name', 'Jan')->assertJsonPath('contact.phone', '777111222')->assertJsonPath('items.0.vat_rate', 10);

        $customer->refresh();
        $this->assertSame(['Eva', 'Nova', '777123456'], [$customer->first_name, $customer->last_name, $customer->phone]);
        $this->assertSame(['Main 1', 'Praha', '11000', 'CZ', 'Acme'], [$customer->address, $customer->city, $customer->postal_code, $customer->country, $customer->company]);
        $this->assertEquals(10, ShopOrder::sole()->items()->sole()->vat_rate);
    }

    /**
     * @description A parallel checkout that inserted the same e-mail first is handled by
     *   re-reading that customer (its stored name is kept, the empty phone is filled in).
     * @input The customer row (Other Tab, no phone) is inserted by "someone else" right before our insert.
     * @output 201 with that customer; customer name Other, phone filled; order contact Jan; one customer row.
     */
    public function test_parallel_customer_insert(): void
    {
        $p = $this->product(['name' => 'P']);
        ShopCustomer::creating(function () {
            DB::table('shop_customers')->insert(['email' => 'jan@example.com', 'first_name' => 'Other', 'last_name' => 'Tab', 'created_at' => now(), 'updated_at' => now()]);
        });

        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]]))->assertCreated()
            ->assertJsonPath('customer.first_name', 'Other')->assertJsonPath('customer.phone', '777111222')->assertJsonPath('contact.first_name', 'Jan');
        $this->assertSame(1, ShopCustomer::count());
    }

    /**
     * @description Validation (column lengths, items), database errors answer 500 without SQL
     *   details and leave stock untouched.
     * @input {} ; postal code 11 chars; order INSERT fails; customer INSERT of a new e-mail fails.
     * @output 422 fields; 422 postal_code; 500 "Error creating order." twice; stock 10; shop log 'error'.
     */
    public function test_validation_and_errors(): void
    {
        $p = $this->product(['name' => 'P']);
        $this->postJson('/api/shop/checkout/create-order', [])->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'first_name', 'last_name', 'phone', 'address', 'city', 'postal_code', 'country', 'payment_method_id', 'shipping_method_id', 'items']);
        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]], ['postal_code' => str_repeat('1', 11)]))
            ->assertStatus(422)->assertJsonValidationErrors(['postal_code']);

        $this->customer(['email' => 'jan@example.com']);
        $this->failOn('shop_orders', 'INSERT');
        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]]))->assertStatus(500)->assertExactJson(['message' => 'Error creating order.']);
        $this->failOn('shop_customers', 'INSERT');
        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]], ['email' => 'new@example.com']))->assertStatus(500)->assertExactJson(['message' => 'Error creating order.']);
        $this->assertSame(10, $p->fresh()->stock_quantity);
        $this->assertShopLog('error', 'Error creating order');
    }

    /**
     * @description Order creation is limited to 10 per minute per IP.
     * @input 10 refused requests (invalid body), then one more.
     * @output 11th answers 429.
     */
    public function test_rate_limit(): void
    {
        foreach (range(1, 10) as $i) {
            $this->postJson('/api/shop/checkout/create-order', [])->assertStatus(422);
        }
        $this->postJson('/api/shop/checkout/create-order', [])->assertStatus(429);
    }

    /**
     * @description Payment simulation: switched off (production default) it does not exist; on
     *   a dev system it pays a pending order (90 % odds), declines (402), refuses orders that
     *   are not waiting for payment (409), validates the id and answers 500 on a database error.
     * @input Simulation off; on + forced win; same order again; forced loss on another; {}; failing UPDATE.
     * @output 404; 200 paid / confirmed + paid_at + log; 409; 402 (order unchanged); 422; 500.
     */
    public function test_simulate_payment(): void
    {
        $paid = $this->order();
        $declined = $this->order();
        $broken = $this->order();

        config(['services.shop.payment_simulation' => false]);
        $this->postJson('/api/shop/checkout/simulate-payment', ['order_id' => $paid->id])->assertStatus(404);
        $this->assertSame('pending', $paid->fresh()->payment_status);

        config(['services.shop.payment_simulation' => true]);
        Lottery::alwaysWin();
        $this->postJson('/api/shop/checkout/simulate-payment', ['order_id' => $paid->id])->assertOk()
            ->assertJsonPath('success', true)->assertJsonPath('order.payment_status', 'paid')->assertJsonPath('order.status', 'confirmed');
        $this->assertNotNull($paid->fresh()->paid_at);
        $this->assertShopLog('payment', 'Payment simulated: ' . $paid->order_number);
        $this->postJson('/api/shop/checkout/simulate-payment', ['order_id' => $paid->id])->assertStatus(409)->assertJsonPath('success', false);

        Lottery::alwaysLose();
        $this->postJson('/api/shop/checkout/simulate-payment', ['order_id' => $declined->id])->assertStatus(402)->assertJson(['message' => 'Payment was declined (simulation)']);
        $this->assertSame('pending', $declined->fresh()->payment_status);
        $this->postJson('/api/shop/checkout/simulate-payment', [])->assertStatus(422);

        Lottery::alwaysWin();
        $this->failOn('shop_orders', 'UPDATE');
        $this->postJson('/api/shop/checkout/simulate-payment', ['order_id' => $broken->id])->assertStatus(500)->assertJson(['message' => 'Error during payment simulation']);
    }

    /**
     * @description Without SHOP_PAYMENT_SIMULATION the simulation follows APP_ENV: off in
     *   production, on elsewhere.
     * @input config/services.php evaluated with APP_ENV production / local.
     * @output false / true.
     */
    public function test_payment_simulation_default(): void
    {
        $evaluate = function (string $env): bool {
            putenv("APP_ENV={$env}");
            $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = $env;
            $value = (require base_path('config/services.php'))['shop']['payment_simulation'];
            putenv('APP_ENV=testing');
            $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = 'testing';

            return $value;
        };

        $this->assertFalse($evaluate('production'));
        $this->assertTrue($evaluate('local'));
    }
}
