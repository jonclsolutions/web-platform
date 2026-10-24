<?php

/**
 * @file CustomerTest.php
 * @path api/tests/Feature/Shop/CustomerTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the shop customers (ShopCustomerController): list with search,
 *   create / edit with validation, delete / restore / trash.
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures.
 */

namespace Tests\Feature\Shop;

use App\Models\Shop\ShopCustomer;
use App\Models\Shop\ShopOrder;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/customers.
 */
class CustomerTest extends TestCase
{
    use ShopFixtures;

    /** @var string[] All customer permissions. */
    private const ALL = ['shop-customers-view', 'shop-customers-create', 'shop-customers-update', 'shop-customers-delete'];

    /**
     * @description A valid customer form body.
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge(['email' => 'jan@example.com', 'first_name' => 'Jan', 'last_name' => 'Novak', 'phone' => '+420 777 123 456', 'is_active' => true], $overrides);
    }

    /**
     * @description List: permission, newest first, search over e-mail / names / phone, active
     *   filter, trash, pagination, export.
     * @input A (Eva, yesterday), B (Petr, inactive, phone 602…), C trashed.
     * @output Each filter returns the expected customer; full_name and total_spent in the list.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/shop/customers')->assertStatus(403);

        $this->signIn($this->userWith(['shop-customers-view']));
        $a = $this->customer();
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $b = $this->customer(['email' => 'petr@x.cz', 'first_name' => 'Petr', 'phone' => '602111222', 'is_active' => false]);
        $this->customer(['email' => 'gone@x.cz'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/shop/customers?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$b->id], $ids('search=602'));
        $this->assertSame([$a->id], $ids('search=Nova&is_active=1'));
        $this->assertSame([$b->id], $ids('is_active=0'));
        $this->getJson("/api/shop/customers?search=eva")->assertJsonPath('data.0.full_name', 'Eva Nova')->assertJsonPath('data.0.total_spent', 0);
        $this->assertSame(['gone@x.cz'], array_column($this->getJson('/api/shop/customers?only_trashed=1')->json('data'), 'email'));
        $this->getJson('/api/shop/customers?per_page=1')->assertJson(['meta' => ['total' => 2, 'last_page' => 2]]);
        $this->getJson('/api/shop/customers?no_pagination=1')->assertOk()->assertJsonCount(2, 'data');
    }

    /**
     * @description Create and edit: unique e-mail (ignoring the edited customer), phone format,
     *   detail, 404s, database errors without SQL details in the answer.
     * @input POST valid; POST same e-mail; POST bad phone; GET; PUT own e-mail; PUT other's e-mail;
     *        /999; failing UPDATE / INSERT.
     * @output 201; 422 "This e-mail is already registered."; 422 phone; 200; 200; 422; 404; 500 / 500.
     */
    public function test_store_show_update(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $other = $this->customer();

        $id = $this->postJson('/api/shop/customers', $this->payload())->assertCreated()->assertJsonPath('data.full_name', 'Jan Novak')->json('data.id');
        $this->assertShopLog('create', 'Created customer: Jan Novak');
        $this->postJson('/api/shop/customers', $this->payload())->assertStatus(422)->assertJsonPath('errors.email.0', 'This e-mail is already registered.');
        $this->postJson('/api/shop/customers', $this->payload(['email' => 'x@x.cz', 'phone' => 'call me']))->assertStatus(422)->assertJsonPath('errors.phone.0', 'Enter a valid phone number.');

        $this->getJson("/api/shop/customers/{$id}")->assertOk()->assertJsonPath('data.email', 'jan@example.com');
        $this->getJson('/api/shop/customers/999')->assertStatus(404);
        $this->putJson("/api/shop/customers/{$id}", $this->payload(['city' => 'Brno']))->assertOk()->assertJsonPath('data.city', 'Brno');
        $this->assertShopLog('update', 'Updated customer: Jan Novak');
        $this->putJson("/api/shop/customers/{$id}", $this->payload(['email' => $other->email]))->assertStatus(422)->assertJsonPath('errors.email.0', 'This e-mail is already used by another customer.');
        $this->putJson('/api/shop/customers/999', $this->payload(['email' => 'new@x.cz']))->assertStatus(404);

        $this->failOn('shop_customers', 'UPDATE');
        $this->putJson("/api/shop/customers/{$id}", $this->payload(['city' => 'Ostrava']))->assertStatus(500)->assertExactJson(['message' => 'Update failed.']);
        $this->failOn('shop_customers', 'INSERT');
        $this->postJson('/api/shop/customers', $this->payload(['email' => 'new@x.cz']))->assertStatus(500)->assertExactJson(['message' => 'Customer creation failed.']);
        $this->assertShopLog('error', 'Customer creation failed');
    }

    /**
     * @description Delete (soft / permanent), restore, empty trash, 404s, database errors.
     * @input Customers A, B, C, D; actions in sequence; failing writes.
     * @output 204s; A restored; trash emptied (Count: 1); 404; 500s.
     */
    public function test_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        [$a, $b, $c, $d] = array_map(fn ($i) => $this->customer(['email' => "c{$i}@x.cz"]), [1, 2, 3, 4]);

        $this->deleteJson("/api/shop/customers/{$a->id}")->assertNoContent();
        $this->assertSoftDeleted($a);
        $this->deleteJson("/api/shop/customers/{$b->id}?force_delete=1")->assertNoContent();
        $this->assertNull(ShopCustomer::withTrashed()->find($b->id));
        $this->deleteJson('/api/shop/customers/999')->assertStatus(404);
        $this->postJson("/api/shop/customers/{$a->id}/restore")->assertOk()->assertJsonPath('data.deleted_at', null);
        $this->postJson('/api/shop/customers/999/restore')->assertStatus(404);

        $c->delete();
        $this->deleteJson('/api/shop/customers/force-delete-all')->assertNoContent();
        $this->assertSame(0, ShopCustomer::onlyTrashed()->count());
        $this->assertShopLog('force_delete_all', 'Count: 1');

        $e = $this->customer(['email' => 'e@x.cz']);
        $e->delete();
        $this->failOn('shop_customers', 'UPDATE');
        $this->deleteJson("/api/shop/customers/{$d->id}")->assertStatus(500)->assertJson(['message' => 'Deletion failed.']);
        $this->postJson("/api/shop/customers/{$e->id}/restore")->assertStatus(500)->assertJson(['message' => 'Restoration failed.']);
        $this->failOn('shop_customers', 'DELETE');
        $this->deleteJson('/api/shop/customers/force-delete-all')->assertStatus(500)->assertJson(['message' => 'Cleanup failed.']);
    }

    /**
     * @description Orders are accounting documents (finding #22): a customer with orders (also
     *   trashed ones) cannot be deleted permanently, emptying the trash keeps such customers, the
     *   foreign key refuses a direct delete; a customer without orders is deleted as before.
     * @input Customer A with an order, B with a trashed order, C without orders - all trashed;
     *        DELETE A ?force_delete=1; DELETE force-delete-all; direct forceDelete() of A.
     * @output 409 customer_has_orders (A and its order kept); 200 {deleted 1, skipped 2}; C gone;
     *   database refuses the direct delete (RESTRICT); orders still there.
     */
    public function test_customer_with_orders_is_never_deleted_permanently(): void
    {
        $this->signIn($this->userWith(self::ALL));
        [$a, $b, $c] = array_map(fn ($i) => $this->customer(['email' => "k{$i}@x.cz"]), [1, 2, 3]);
        $orderA = $this->order($a);
        $this->order($b)->delete();
        foreach ([$a, $b, $c] as $customer) { $customer->delete(); }

        $this->deleteJson("/api/shop/customers/{$a->id}?force_delete=1")->assertStatus(409)->assertJsonPath('code', 'customer_has_orders');
        $this->assertNotNull(ShopCustomer::withTrashed()->find($a->id));

        $this->deleteJson('/api/shop/customers/force-delete-all')->assertOk()
            ->assertJsonPath('data.deleted_count', 1)->assertJsonPath('data.skipped_count', 2);
        $this->assertNull(ShopCustomer::withTrashed()->find($c->id));
        $this->assertSame(2, ShopCustomer::onlyTrashed()->count());
        $this->assertShopLog('force_delete_all', 'Count: 1, kept (with orders): 2');

        $this->assertThrows(fn () => $a->forceDelete(), \Illuminate\Database\QueryException::class);
        $this->assertSame(2, ShopOrder::withTrashed()->count());
        $this->assertNotNull($orderA->fresh());
    }

    /**
     * @description GDPR erasure keeps the orders (finding #22): every personal field of the
     *   customer is replaced / cleared, the account deactivated; the order keeps its contact
     *   snapshot; the audit log has no personal data; twice → 409; unknown → 404; permission.
     * @input Customer Eva (phone, address, notes) with an order (snapshot Eva); POST anonymize twice;
     *        POST /999/anonymize; user without shop-customers-delete.
     * @output 200 email customer-{id}@anonymized.invalid, Anonymized customer, nulls, inactive; order
     *   contact still Eva; log 'anonymize' without e-mail; 409; 404; 403.
     */
    public function test_anonymize(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $customer = $this->customer(['address' => 'Main 1', 'city' => 'Praha', 'notes' => 'VIP', 'company' => 'Acme']);
        $order = $this->order($customer, ['customer_first_name' => 'Eva', 'customer_last_name' => 'Nova', 'customer_email' => 'eva@example.com']);

        $this->postJson("/api/shop/customers/{$customer->id}/anonymize")->assertOk()
            ->assertJsonPath('data.email', "customer-{$customer->id}@anonymized.invalid")->assertJsonPath('data.full_name', 'Anonymized customer');

        $customer->refresh();
        $this->assertSame([null, null, null, null, null, false], [$customer->phone, $customer->company, $customer->address, $customer->city, $customer->notes, $customer->is_active]);
        $this->assertTrue($customer->isAnonymized());
        $this->assertSame('Eva Nova', $order->fresh()->contact()['full_name']);
        $this->assertShopLog('anonymize', "Anonymised customer ID: {$customer->id}");
        $this->assertStringNotContainsString('eva@example.com', json_encode(\App\Models\Shop\ShopLog::where('event_type', 'anonymize')->sole()->toArray()));

        $this->postJson("/api/shop/customers/{$customer->id}/anonymize")->assertStatus(409);
        $this->postJson('/api/shop/customers/999/anonymize')->assertStatus(404);

        $other = $this->customer(['email' => 'x@x.cz']);
        $this->failOn('shop_customers', 'UPDATE');
        $this->postJson("/api/shop/customers/{$other->id}/anonymize")->assertStatus(500)->assertJson(['message' => 'Anonymisation failed.']);

        $this->signIn($this->userWith(['shop-customers-view']));
        $this->postJson("/api/shop/customers/{$other->id}/anonymize")->assertForbidden();
    }
}
