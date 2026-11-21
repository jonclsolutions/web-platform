<?php

/**
 * @file CheckoutTest.php
 * @path api/tests/Apps/Shop/Feature/CheckoutTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the public checkout (ShopCheckoutController): order created
 *   with catalogue prices (never the prices sent by the browser), availability checks, coupon
 *   rules, customer handling, error / rate limit behaviour and the payment simulation (dev
 *   systems only).
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Shop\Support\ShopFixtures; Illuminate\Support\Lottery (payment odds).
 */

namespace Tests\Apps\Shop\Feature;

use App\Apps\Shop\Models\ShopCoupon;
use App\Apps\Shop\Models\ShopCustomer;
use App\Apps\Shop\Models\ShopLog;
use App\Apps\Shop\Models\ShopOrder;
use App\Apps\Shop\Models\ShopPaymentMethod;
use App\Apps\Shop\Models\ShopShippingMethod;
use App\Models\Legal\DocumentSection;
use App\Models\Legal\DocumentType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Lottery;
use App\Http\Middleware\PublicFormGuard;
use Tests\Apps\Shop\Support\ShopFixtures;
use Tests\Support\CommonFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/checkout/{create-order,simulate-payment}.
 */
class CheckoutTest extends TestCase
{
    use ShopFixtures;
    use CommonFixtures;

    /** @var ShopPaymentMethod Payment method of the tests. */
    private ShopPaymentMethod $payment;

    /** @var ShopShippingMethod Shipping method of the tests (5 EUR). */
    private ShopShippingMethod $shipping;

    /**
     * @description Payment / shipping methods; payment simulation on, Lottery back to random;
     *   the captcha of the public form accepts the test token.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeCaptcha();
        $this->payment = $this->paymentMethod();
        $this->shipping = $this->shippingMethod();
        config(['shop.payment_simulation' => true]);
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
     * @description A valid checkout body (with the captcha token of the public form).
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
            'terms_accepted' => true,
        ] + $this->captcha(), $overrides);
    }

    /**
     * @description SECURITY: the order uses the catalogue prices and VAT rates - the cheap
     *   prices / VAT sent by the browser are ignored; a variant uses its own price (else the
     *   product price); stock is taken, coupon applied and counted, shipping added, customer created.
     * @input Product P 121 EUR / 21 % (10 pcs) ×2 sent at 0.01 EUR / 0 %; product B 110 EUR / 10 % with
     *        variant V1 (own price 55, 3 pcs) ×1 and variant V2 (no price, 4 pcs) ×1; coupon SAVE10.
     * @output 201 pending; items 121 / 55 / 110; total 407, discount 40.70, final 371.30;
     *   tax = Σ line × 0.9 × rate / (100 + rate); stock P 8, V1 2, V2 3, B 5; coupon used 1;
     *   customer jan@example.com; no gateway config in the answer; the shop log keeps no copy of
     *   the buyer's contact (GDPR).
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
            ->assertJsonPath('data.status', 'pending')->assertJsonPath('data.payment_status', 'pending')
            ->assertJsonPath('data.items.0.unit_price', 121)->assertJsonPath('data.items.0.total_price', 242)
            ->assertJsonPath('data.items.1.unit_price', 55)->assertJsonPath('data.items.1.variant_name', 'V1')->assertJsonPath('data.items.2.unit_price', 110)
            ->assertJsonPath('data.total_amount', 407)->assertJsonPath('data.discount_amount', 40.7)->assertJsonPath('data.shipping_amount', 5)
            ->assertJsonPath('data.final_amount', 371.3)->assertJsonPath('data.customer.email', 'jan@example.com')->assertJsonPath('data.notes', 'Ring twice')->json('data');

        $expectedTax = 242 * 0.9 * 21 / 121 + 55 * 0.9 * 10 / 110 + 110 * 0.9 * 10 / 110;
        $this->assertEqualsWithDelta($expectedTax, $json['tax_amount'], 0.01);
        $this->assertArrayNotHasKey('config', $json['payment_method']);
        $this->assertSame([8, 2, 3, 5], [$p->fresh()->stock_quantity, $v1->fresh()->stock_quantity, $v2->fresh()->stock_quantity, $b->fresh()->stock_quantity]);
        $this->assertSame(1, $coupon->fresh()->usage_count);
        $this->assertShopLog('create', 'Created order: ' . $json['order_number']);
        $context = ShopLog::latest('id')->first()->context_data;
        $this->assertSame([], array_values(array_intersect(array_keys($context), ShopCustomer::AUDIT_MASKED)));
        $this->assertArrayHasKey('items', $context);
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
     * @description SECURITY (stock): lines of the same product / variant are checked for their
     *   total quantity and stored as one item - two lines of 5 pcs never pass against a stock of
     *   6 (the stock went negative); a product with variants is ordered only as a variant (its own
     *   stock is the sum of the variants and its price may differ).
     * @input P 6 pcs: lines P×5 + P×5; lines P×2 + P×3. B with variant V (4 pcs): line B without
     *        a variant; lines V×1 + V×2.
     * @output 422 "sold out… 6 pcs", stock 6; 201 one item ×5, stock 1; 422 "Choose a variant of 'B'.";
     *   201 one item V×3, V stock 1.
     */
    public function test_lines_of_one_product_are_checked_together(): void
    {
        $p = $this->product(['name' => 'P', 'stock_quantity' => 6]);
        $b = $this->product(['name' => 'B']);
        $v = $this->variant($b, ['variant_name' => 'V', 'stock_quantity' => 4]);

        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 5], ['product_id' => $p->id, 'quantity' => 5]]))
            ->assertStatus(422)->assertExactJson(['message' => "The product 'P' was sold out in the meantime. Available quantity: 6 pcs."]);
        $this->assertSame(6, $p->fresh()->stock_quantity);

        $this->travel(61)->seconds();
        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 2], ['product_id' => $p->id, 'quantity' => 3]]))
            ->assertCreated()->assertJsonCount(1, 'data.items')->assertJsonPath('data.items.0.quantity', 5);
        $this->assertSame(1, $p->fresh()->stock_quantity);

        $this->travel(61)->seconds();
        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $b->id, 'quantity' => 1]]))
            ->assertStatus(422)->assertExactJson(['message' => "Choose a variant of 'B'."]);

        $this->travel(61)->seconds();
        $this->postJson('/api/shop/checkout/create-order', $this->payload([
            ['product_id' => $b->id, 'product_variant_id' => $v->id, 'quantity' => 1],
            ['product_id' => $b->id, 'product_variant_id' => $v->id, 'quantity' => 2],
        ]))->assertCreated()->assertJsonCount(1, 'data.items')->assertJsonPath('data.items.0.quantity', 3);
        $this->assertSame(1, $v->fresh()->stock_quantity);
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
     * @description SECURITY (coupon limit): the use of a coupon is taken atomically with its
     *   limit - when a parallel checkout uses the last use after this checkout read the coupon,
     *   the order is refused instead of exceeding the limit. The parallel use is simulated by the
     *   `retrieved` event of the coupon (it fires right after the checkout read it).
     * @input LAST (max 1, used 0) consumed by a "parallel" checkout right after the read; ONCE
     *        (max 1, used 0) without competition.
     * @output 422 "The coupon has been exhausted.", no order, LAST never used more than once; 201 with ONCE, used 1,
     *   stock 9 (only the accepted order took a piece).
     */
    public function test_coupon_limit_holds_under_a_parallel_checkout(): void
    {
        $p = $this->product(['name' => 'P']);
        $last = $this->coupon(['code' => 'LAST', 'max_usage' => 1]);
        $once = $this->coupon(['code' => 'ONCE', 'max_usage' => 1]);

        ShopCoupon::retrieved(function (ShopCoupon $coupon) use ($last) {
            if ($coupon->id === $last->id) {
                DB::table('shop_coupons')->where('id', $last->id)->update(['usage_count' => 1]);
            }
        });

        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]], ['coupon_code' => 'LAST']))
            ->assertStatus(422)->assertExactJson(['message' => 'The coupon has been exhausted.']);
        $this->assertSame(0, ShopOrder::count());
        // The simulated parallel use ran inside this checkout's transaction, so the rollback undid it
        // too - what matters is that the limit was never exceeded.
        $this->assertLessThanOrEqual(1, (int) DB::table('shop_coupons')->where('id', $last->id)->value('usage_count'));

        $this->travel(61)->seconds();
        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]], ['coupon_code' => 'ONCE']))
            ->assertCreated();
        $this->assertSame(1, $once->fresh()->usage_count);
        $this->assertSame(9, $p->fresh()->stock_quantity);
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
            ->assertCreated()->assertJsonPath('data.customer_id', $customer->id)->assertJsonPath('data.discount_amount', 20)->assertJsonPath('data.final_amount', 106)
            ->assertJsonPath('data.contact.full_name', 'Jan Novak')->assertJsonPath('data.contact.company', 'Acme')->assertJsonPath('data.contact.email', 'jan@example.com');

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
            ->assertCreated()->assertJsonPath('data.contact.first_name', 'Jan')->assertJsonPath('data.contact.phone', '777111222')->assertJsonPath('data.items.0.vat_rate', 10);

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
            ->assertJsonPath('data.customer.first_name', 'Other')->assertJsonPath('data.customer.phone', '777111222')->assertJsonPath('data.contact.first_name', 'Jan');
        $this->assertSame(1, ShopCustomer::count());
    }

    /**
     * @description Delivery countries (U-02): the country is an ISO code of a delivery country
     *   (a legacy name of a cached page is read as its code), the shipping method must deliver
     *   there; the order stores the code, the e-mail shows its name.
     * @input Shipping method for CZ + SK (storefront list); order to "US"; to DE; to "sk"; legacy "Czechia"; a
     *   method without countries (from before) to DE.
     * @output list carries countries CZ, SK; 422 country; 422 shipping_method_id; 201 shipping_country SK, customer country SK;
     *   201 CZ; 201 (no countries = everywhere).
     */
    public function test_delivery_countries(): void
    {
        $this->shipping->update(['countries' => ['CZ', 'SK']]);
        $this->getJson('/api/shop/public/shipping-methods')->assertOk()->assertJsonPath('data.0.countries', ['CZ', 'SK']);
        $p = $this->product(['name' => 'P']);
        $line = [['product_id' => $p->id, 'quantity' => 1]];

        $this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['country' => 'US']))->assertStatus(422)->assertJsonValidationErrors(['country']);
        $this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['country' => 'DE']))->assertStatus(422)->assertJsonValidationErrors(['shipping_method_id']);

        $order = ShopOrder::find($this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['country' => 'sk']))->assertCreated()->json('data.id'));
        $this->assertSame(['SK', 'SK'], [$order->shipping_country, $order->customer->country]);
        $this->assertSame('CZ', ShopOrder::find($this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['email' => 'eva@example.com', 'country' => 'Czechia']))->assertCreated()->json('data.id'))->shipping_country);

        $this->shipping->update(['countries' => null]);
        $this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['email' => 'ota@example.com', 'country' => 'DE']))->assertCreated();
    }

    /**
     * @description Buying on a company (U-03): with `is_company` the company name and the IČO are
     *   required, the DIČ needs a country prefix; IČO / DIČ are normalised (spaces, upper case) and
     *   stored on the order (snapshot) and the new customer; a private buyer's company data are
     *   dropped even when sent.
     * @input is_company without company / ico; DIČ "X1"; company ACME, ico " 123 456 78", dic
     *   "cz 12345678"; private buyer (is_company false) sending company / ico.
     * @output 422 company + ico; 422 dic (message with the prefix); 201 order customer_ico
     *   12345678, customer_dic CZ12345678, contact.ico in the answer, customer ico / dic; private
     *   order and customer without company data.
     */
    public function test_company_purchase(): void
    {
        $p = $this->product(['name' => 'P']);
        $line = [['product_id' => $p->id, 'quantity' => 1]];

        $this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['is_company' => true]))
            ->assertStatus(422)->assertJsonValidationErrors(['company', 'ico']);
        $this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['is_company' => true, 'company' => 'ACME', 'ico' => '12345678', 'dic' => 'X1']))
            ->assertStatus(422)->assertJsonPath('errors.dic.0', 'Enter a valid VAT ID with the country prefix (e.g. CZ12345678).');

        $id = $this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['is_company' => true, 'company' => 'ACME s.r.o.', 'ico' => ' 123 456 78', 'dic' => 'cz 12345678']))
            ->assertCreated()->assertJsonPath('data.contact.ico', '12345678')->assertJsonPath('data.contact.dic', 'CZ12345678')->json('data.id');
        $order = ShopOrder::find($id);
        $this->assertSame(['ACME s.r.o.', '12345678', 'CZ12345678'], [$order->customer_company, $order->customer_ico, $order->customer_dic]);
        $this->assertSame(['12345678', 'CZ12345678'], [$order->customer->ico, $order->customer->dic]);

        $private = ShopOrder::find($this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['email' => 'eva@example.com', 'is_company' => false, 'company' => 'X', 'ico' => '87654321']))->assertCreated()->json('data.id'));
        $this->assertSame([null, null], [$private->customer_company, $private->customer_ico]);
        $this->assertNull($private->customer->ico);
    }

    /**
     * @description The consent with the terms and conditions is required and stored with the
     *   order (U-04): its time and the accepted wording of the terms in the order's language -
     *   the last change and the SHA-256 of the text; an edit of the terms changes the version
     *   for later orders only.
     * @input Terms (tos) cz, two sections; order without consent; order with it; terms edited
     *   a day later; second order.
     * @output 422 terms_accepted; order: accepted at now, version = last change (UTC), hash =
     *   sha256 of [[heading, text], …]; resource returns them; second order has another hash,
     *   the first one is unchanged.
     */
    public function test_terms_consent_is_stored_with_the_order(): void
    {
        $this->freezeSecond();
        $tos = DocumentType::create(['slug' => 'tos', 'title' => 'Obchodní podmínky']);
        DocumentSection::create(['document_type_id' => $tos->id, 'position' => 1, 'heading' => 'Úvod', 'content' => 'Text A', 'lang' => 'cz']);
        $second = DocumentSection::create(['document_type_id' => $tos->id, 'position' => 2, 'heading' => 'Platby', 'content' => 'Text B', 'lang' => 'cz']);
        $p = $this->product(['name' => 'P']);
        $line = [['product_id' => $p->id, 'quantity' => 1]];

        $this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['terms_accepted' => false]))
            ->assertStatus(422)->assertJsonValidationErrors(['terms_accepted']);

        $first = $this->postJson('/api/shop/checkout/create-order', $this->payload($line))->assertCreated()
            ->assertJsonPath('data.terms_version', now()->utc()->format('Y-m-d\TH:i:s\Z'))->json('data.id');
        $order = ShopOrder::find($first);
        $this->assertSame(now()->format('Y-m-d H:i:s'), $order->terms_accepted_at->format('Y-m-d H:i:s'));
        $this->assertSame(hash('sha256', json_encode([['Úvod', 'Text A'], ['Platby', 'Text B']], JSON_UNESCAPED_UNICODE)), $order->terms_hash);

        $this->travel(1)->days();
        $second->update(['content' => 'Text B2']);
        $other = ShopOrder::find($this->postJson('/api/shop/checkout/create-order', $this->payload($line, ['email' => 'eva@example.com']))->assertCreated()->json('data.id'));
        $this->assertNotSame($order->terms_hash, $other->terms_hash);
        $this->assertSame(now()->utc()->format('Y-m-d\TH:i:s\Z'), $other->terms_version);
        $this->assertSame($order->terms_hash, $order->fresh()->terms_hash);
    }

    /**
     * @description Validation (column lengths, items), database errors answer 500 without SQL
     *   details and leave stock untouched.
     * @input Only the captcha token; postal code 11 chars; order INSERT fails; customer INSERT of a new e-mail fails.
     * @output 422 fields (incl. terms_accepted); 422 postal_code; 500 "Error creating order." twice; stock 10; shop log 'error'.
     */
    public function test_validation_and_errors(): void
    {
        $p = $this->product(['name' => 'P']);
        $this->postJson('/api/shop/checkout/create-order', $this->captcha())->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'first_name', 'last_name', 'phone', 'address', 'city', 'postal_code', 'country', 'payment_method_id', 'shipping_method_id', 'items', 'terms_accepted']);
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
     * @description Order creation is limited like every public form: the named limiter
     *   `public-form` (5 per minute per IP, the refused requests count too).
     * @input 5 refused requests (empty body), then one more.
     * @output 6th answers 429.
     */
    public function test_rate_limit(): void
    {
        foreach (range(1, 5) as $i) {
            $this->postJson('/api/shop/checkout/create-order', [])->assertStatus(422);
        }
        $this->postJson('/api/shop/checkout/create-order', [])->assertStatus(429);
    }

    /**
     * @description SECURITY (SA-05): the checkout is guarded like the other public forms - the
     *   confirmation e-mail goes to the address typed in, so without the guard anybody could make
     *   the shop mail any address (with their own text) and use up the stock with fake orders.
     *   Without a valid captcha the order is refused, a filled honeypot is dropped silently, and
     *   one e-mail address gets at most RECIPIENT_PER_HOUR orders an hour (successful ones only);
     *   another address is not affected.
     * @input No captcha token; rejected token; honeypot 'website' filled; RECIPIENT_PER_HOUR orders
     *        for jan@example.com (other IPs), one more; one for eva@example.com.
     * @output 422 captcha_required ×2; 204; 201 ×3; 429 error_code RECIPIENT_LIMIT; 201; 4 orders, stock 6.
     */
    public function test_checkout_is_guarded_like_the_public_forms(): void
    {
        $p = $this->product(['name' => 'P']);
        $line = [['product_id' => $p->id, 'quantity' => 1]];
        $send = fn (array $overrides, string $ip) => $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/shop/checkout/create-order', $this->payload($line, $overrides));

        $send(['captcha_token' => null], '10.1.0.1')->assertStatus(422)->assertJsonPath('captcha_required', true);
        $this->fakeCaptcha(false);
        $send([], '10.1.0.2')->assertStatus(422)->assertJsonPath('captcha_required', true);
        $this->fakeCaptcha();
        $send([PublicFormGuard::HONEYPOT_FIELD => 'http://spam.example'], '10.1.0.3')->assertNoContent();
        $this->assertSame(0, ShopOrder::count());

        for ($i = 0; $i < PublicFormGuard::RECIPIENT_PER_HOUR; $i++) {
            $send([], "10.1.1.{$i}")->assertCreated();
        }
        $send(['email' => 'JAN@example.com'], '10.1.2.1')->assertStatus(429)->assertJsonPath('error_code', 'RECIPIENT_LIMIT');
        $send(['email' => 'eva@example.com'], '10.1.2.2')->assertCreated();

        $this->assertSame(PublicFormGuard::RECIPIENT_PER_HOUR + 1, ShopOrder::count());
        $this->assertSame(10 - PublicFormGuard::RECIPIENT_PER_HOUR - 1, $p->fresh()->stock_quantity);
    }

    /**
     * @description Payment simulation (dev / test systems only): create-order gives the buyer the
     *   order's payment token (only while the simulation is on); switched off the endpoint does
     *   not exist; an unknown order and a wrong token answer the same 404 (no probing of
     *   sequential ids, VT-16); with the token it pays a pending order (90 % odds), declines
     *   (402), refuses orders not waiting for payment (409), validates and answers 500 on a
     *   database error.
     * @input create-order on / off; simulation off; wrong token; unknown id; token + forced win;
     *        same order again; forced loss on another; {}; failing UPDATE.
     * @output meta.payment_token = the order's token / no meta; 404 ×3; 200 paid / confirmed +
     *   paid_at + log; 409; 402 (order unchanged); 422; 500.
     */
    public function test_simulate_payment(): void
    {
        $p = $this->product();
        $created = $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]]))->assertCreated();
        $this->assertSame(ShopOrder::find($created->json('data.id'))->paymentSimulationToken(), $created->json('meta.payment_token'));
        config(['shop.payment_simulation' => false]);
        $this->postJson('/api/shop/checkout/create-order', $this->payload([['product_id' => $p->id, 'quantity' => 1]]))->assertCreated()->assertJsonMissingPath('meta');

        $paid = $this->order();
        $declined = $this->order();
        $broken = $this->order();
        $pay = fn (ShopOrder $order, ?string $token = null) => $this->postJson('/api/shop/checkout/simulate-payment', [
            'order_id' => $order->id, 'payment_token' => $token ?? $order->paymentSimulationToken(),
        ]);

        $pay($paid)->assertStatus(404);
        $this->assertSame('pending', $paid->fresh()->payment_status);

        config(['shop.payment_simulation' => true]);
        Lottery::alwaysWin();
        $pay($paid, $declined->paymentSimulationToken())->assertStatus(404)->assertExactJson(['message' => 'Not found.']);
        $this->postJson('/api/shop/checkout/simulate-payment', ['order_id' => 999999, 'payment_token' => str_repeat('a', 64)])
            ->assertStatus(404)->assertExactJson(['message' => 'Not found.']);
        $this->assertSame('pending', $paid->fresh()->payment_status);

        $pay($paid)->assertOk()->assertJsonPath('data.payment_status', 'paid')->assertJsonPath('data.status', 'confirmed');
        $this->assertNotNull($paid->fresh()->paid_at);
        $this->assertShopLog('payment', 'Payment simulated: ' . $paid->order_number);
        $pay($paid)->assertStatus(409)->assertExactJson(['message' => 'This order is not waiting for payment.']);

        Lottery::alwaysLose();
        $pay($declined)->assertStatus(402)->assertExactJson(['message' => 'Payment was declined (simulation).']);
        $this->assertSame('pending', $declined->fresh()->payment_status);
        $this->postJson('/api/shop/checkout/simulate-payment', [])->assertStatus(422)->assertJsonValidationErrors(['order_id', 'payment_token']);

        Lottery::alwaysWin();
        $this->failOn('shop_orders', 'UPDATE');
        $pay($broken)->assertStatus(500)->assertJson(['message' => 'Error during payment simulation']);
    }

    /**
     * @description The simulation is on only when SHOP_PAYMENT_SIMULATION is set explicitly, and
     *   never in production (VT-16).
     * @input app/Apps/Shop/config.php with APP_ENV local / production × SHOP_PAYMENT_SIMULATION unset / true.
     * @output local: false / true; production: false / false.
     */
    public function test_payment_simulation_default(): void
    {
        $evaluate = function (string $env, ?string $flag): bool {
            putenv("APP_ENV={$env}");
            $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = $env;
            $flag === null ? putenv('SHOP_PAYMENT_SIMULATION') : putenv("SHOP_PAYMENT_SIMULATION={$flag}");
            unset($_ENV['SHOP_PAYMENT_SIMULATION'], $_SERVER['SHOP_PAYMENT_SIMULATION']);
            $value = (require base_path('app/Apps/Shop/config.php'))['payment_simulation'];
            putenv('APP_ENV=testing');
            putenv('SHOP_PAYMENT_SIMULATION');
            $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = 'testing';

            return $value;
        };

        $this->assertFalse($evaluate('local', null));
        $this->assertTrue($evaluate('local', 'true'));
        $this->assertFalse($evaluate('production', null));
        $this->assertFalse($evaluate('production', 'true'));
    }
}
