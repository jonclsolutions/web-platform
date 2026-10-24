<?php

/**
 * @file DeliveryPaymentMethodTest.php
 * @path api/tests/Feature/Shop/DeliveryPaymentMethodTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the shipping methods (ShopShippingMethodController: CRUD,
 *   protected system methods, trash) and the payment methods (ShopPaymentMethodController:
 *   list / detail / edit only, code and provider never changed).
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures.
 */

namespace Tests\Feature\Shop;

use App\Models\Shop\ShopShippingMethod;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/shipping_methods and /api/shop/payment_methods.
 */
class DeliveryPaymentMethodTest extends TestCase
{
    use ShopFixtures;

    /** @var string[] All shipping method permissions. */
    private const SHIPPING = ['shop-shipping-methods-view', 'shop-shipping-methods-create', 'shop-shipping-methods-update', 'shop-shipping-methods-delete'];

    /**
     * @description A valid shipping method body.
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function shipping(array $overrides = []): array
    {
        return array_merge(['code' => 'dpd', 'name' => 'DPD', 'shipping_type' => 'address', 'base_price' => 4.5], $overrides);
    }

    /**
     * @description Shipping list: permission, sort order, search, flag filters, trash, export.
     * @input PPL (sort 2), Packeta pickup point with COD (sort 1), DPD trashed.
     * @output [Packeta, PPL]; search / filters; trash ['dpd']; total 2.
     */
    public function test_shipping_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/shop/shipping_methods')->assertStatus(403);

        $this->signIn($this->userWith(['shop-shipping-methods-view']));
        $ppl = $this->shippingMethod(['sort_order' => 2]);
        $packeta = $this->shippingMethod(['code' => 'packeta', 'name' => 'Packeta', 'shipping_type' => 'pickup', 'requires_pickup_point' => true, 'allows_cod' => true, 'sort_order' => 1]);
        $this->shippingMethod(['code' => 'dpd', 'name' => 'DPD'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/shop/shipping_methods?{$q}")->json('data'), 'id');
        $this->assertSame([$packeta->id, $ppl->id], $ids(''));
        $this->assertSame([$ppl->id], $ids('search=PPL'));
        $this->assertSame([$packeta->id], $ids('shipping_type=pickup'));
        $this->assertSame([$packeta->id], $ids('requires_pickup_point=1'));
        $this->assertSame([$packeta->id], $ids('allows_cod=1'));
        $this->assertSame([$ppl->id], $ids('is_active=1&allows_cod=0'));
        $this->assertSame(['dpd'], array_column($this->getJson('/api/shop/shipping_methods?only_trashed=1')->json('data'), 'code'));
        $this->getJson('/api/shop/shipping_methods?per_page=1')->assertJson(['meta' => ['total' => 2, 'last_page' => 2]]);
        $this->getJson('/api/shop/shipping_methods?no_pagination=1')->assertOk()->assertJsonCount(2, 'data');
    }

    /**
     * @description Shipping create (COD price / free threshold default 0, active by default),
     *   detail, edit (the code of a system method stays), validation, 404s, database errors.
     * @input POST valid; POST same code; GET; PUT; system 'local_pickup' PUT {code 'x'}; /999; failures.
     * @output 201 cod_price 0, active; 422; 200; 200; code still local_pickup; 404; 500 / 500.
     */
    public function test_shipping_store_show_update(): void
    {
        $this->signIn($this->userWith(self::SHIPPING));

        $id = $this->postJson('/api/shop/shipping_methods', $this->shipping())->assertCreated()
            ->assertJsonPath('data.cod_price', '0.00')->assertJsonPath('data.free_shipping_threshold', '0.00')->assertJsonPath('data.is_active', true)->json('data.id');
        $this->assertShopLog('create', 'Created shipping method: DPD');
        $this->postJson('/api/shop/shipping_methods', $this->shipping())->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->postJson('/api/shop/shipping_methods', [])->assertStatus(422)->assertJsonValidationErrors(['code', 'name', 'shipping_type', 'base_price']);

        $this->getJson("/api/shop/shipping_methods/{$id}")->assertOk()->assertJsonPath('data.code', 'dpd');
        $this->getJson('/api/shop/shipping_methods/999')->assertStatus(404);
        $this->putJson("/api/shop/shipping_methods/{$id}", $this->shipping(['base_price' => 6, 'is_active' => false]))->assertOk()->assertJsonPath('data.base_price', '6.00')->assertJsonPath('data.is_active', false);
        $this->assertShopLog('update', 'Updated shipping method: DPD');

        $system = $this->shippingMethod(['code' => 'local_pickup', 'name' => 'Pickup']);
        $this->putJson("/api/shop/shipping_methods/{$system->id}", $this->shipping(['code' => 'renamed', 'name' => 'Own pickup']))
            ->assertOk()->assertJsonPath('data.code', 'local_pickup')->assertJsonPath('data.name', 'Own pickup');
        $this->putJson('/api/shop/shipping_methods/999', $this->shipping(['code' => 'x1']))->assertStatus(404);

        $this->failOn('shop_shipping_methods', 'UPDATE');
        $this->putJson("/api/shop/shipping_methods/{$id}", $this->shipping())->assertStatus(500)->assertJson(['message' => 'Update failed.']);
        $this->failOn('shop_shipping_methods', 'INSERT');
        $this->postJson('/api/shop/shipping_methods', $this->shipping(['code' => 'new']))->assertStatus(500)->assertJson(['message' => 'Error creating shipping method.']);
    }

    /**
     * @description System methods (local pickup / nearest carrier) cannot be deleted; others
     *   soft / permanently; restore; empty trash; 404s.
     * @input closest_carrier, A, B, C; the actions in sequence.
     * @output 403; 204s; restored; trash emptied (log Count: 1); 404; failing DELETE 500.
     */
    public function test_shipping_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::SHIPPING));
        $system = $this->shippingMethod(['code' => 'closest_carrier', 'name' => 'Nearest']);
        [$a, $b, $c] = [$this->shippingMethod(['code' => 'a']), $this->shippingMethod(['code' => 'b']), $this->shippingMethod(['code' => 'c'])];

        $this->deleteJson("/api/shop/shipping_methods/{$system->id}")->assertStatus(403)->assertJsonPath('message', fn ($m) => str_contains($m, 'cannot be deleted'));
        $this->deleteJson("/api/shop/shipping_methods/{$a->id}")->assertNoContent();
        $this->assertSoftDeleted($a);
        $this->deleteJson("/api/shop/shipping_methods/{$b->id}?force_delete=1")->assertNoContent();
        $this->assertNull(ShopShippingMethod::withTrashed()->find($b->id));
        $this->deleteJson('/api/shop/shipping_methods/999')->assertStatus(404);
        $this->postJson("/api/shop/shipping_methods/{$a->id}/restore")->assertOk()->assertJsonPath('data.deleted_at', null);
        $this->assertShopLog('restore', "Restored shipping method ID: {$a->id}");
        $this->postJson('/api/shop/shipping_methods/999/restore')->assertStatus(404);

        $c->delete();
        $this->deleteJson('/api/shop/shipping_methods/force-delete-all')->assertNoContent();
        $this->assertSame(0, ShopShippingMethod::onlyTrashed()->count());
        $this->assertShopLog('force_delete_all', 'Count: 1');

        $a->delete();
        $this->failOn('shop_shipping_methods', 'DELETE');
        $this->deleteJson('/api/shop/shipping_methods/force-delete-all')->assertStatus(500)->assertJson(['message' => 'Emptying trash failed.']);
    }

    /**
     * @description Payment methods: list (sort order, search, filters, trash, export), detail,
     *   edit without changing code / provider, validation, 404s, database error; no create /
     *   delete routes.
     * @input bank_transfer (sort 1), card via 'stripe' external (sort 0), cod trashed.
     * @output [card, bank]; filters; PUT keeps code / provider; 422; 404; 500; POST / DELETE 405.
     */
    public function test_payment_methods(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/shop/payment_methods')->assertStatus(403);

        $this->signIn($this->userWith(['shop-payment-methods-view', 'shop-payment-methods-update']));
        $bank = $this->paymentMethod(['sort_order' => 1]);
        $card = $this->paymentMethod(['code' => 'card', 'name' => 'Card', 'provider' => 'stripe', 'is_external' => true, 'sort_order' => 0]);
        $this->paymentMethod(['code' => 'cod', 'name' => 'COD'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/shop/payment_methods?{$q}")->json('data'), 'id');
        $this->assertSame([$card->id, $bank->id], $ids(''));
        $this->assertSame([$card->id], $ids('search=strip'));
        $this->assertSame([$card->id], $ids('provider=stripe'));
        $this->assertSame([$bank->id], $ids('is_external=0&is_active=1'));
        $this->assertSame(['cod'], array_column($this->getJson('/api/shop/payment_methods?only_trashed=1')->json('data'), 'code'));
        $this->getJson('/api/shop/payment_methods?no_pagination=1')->assertOk()->assertJsonCount(2, 'data');

        $this->getJson("/api/shop/payment_methods/{$bank->id}")->assertOk()->assertJsonPath('data.config.merchant_key', 'secret-key');
        $this->getJson('/api/shop/payment_methods/999')->assertStatus(404);
        $this->putJson("/api/shop/payment_methods/{$bank->id}", [
            'name' => 'Transfer', 'price' => 1, 'variable_symbol_type' => 'none', 'code' => 'hacked', 'provider' => 'evil', 'config' => ['iban' => 'CZ1'],
        ])->assertOk()->assertJsonPath('data.name', 'Transfer')->assertJsonPath('data.code', 'bank_transfer')->assertJsonPath('data.provider', 'manual')->assertJsonPath('data.config.iban', 'CZ1');
        $this->assertShopLog('update', 'Updated payment method: Transfer');
        $this->putJson("/api/shop/payment_methods/{$bank->id}", ['name' => 'X'])->assertStatus(422)->assertJsonValidationErrors(['price', 'variable_symbol_type']);
        $this->putJson('/api/shop/payment_methods/999', ['name' => 'X', 'price' => 0, 'variable_symbol_type' => 'none'])->assertStatus(404);
        $this->postJson('/api/shop/payment_methods', ['name' => 'New'])->assertStatus(405);
        $this->deleteJson("/api/shop/payment_methods/{$bank->id}")->assertStatus(405);

        $this->failOn('shop_payment_methods', 'UPDATE');
        $this->putJson("/api/shop/payment_methods/{$bank->id}", ['name' => 'Y', 'price' => 0, 'variable_symbol_type' => 'none'])->assertStatus(500)->assertJson(['message' => 'Update failed.']);
    }
}
