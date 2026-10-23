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
        $this->getJson('/api/shop/customers?per_page=1')->assertJson(['total' => 2, 'last_page' => 2]);
        $this->getJson('/api/shop/customers?no_pagination=1')->assertOk()->assertJsonCount(2);
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

        $id = $this->postJson('/api/shop/customers', $this->payload())->assertCreated()->assertJsonPath('full_name', 'Jan Novak')->json('id');
        $this->assertShopLog('create', 'Created customer: Jan Novak');
        $this->postJson('/api/shop/customers', $this->payload())->assertStatus(422)->assertJsonPath('errors.email.0', 'This e-mail is already registered.');
        $this->postJson('/api/shop/customers', $this->payload(['email' => 'x@x.cz', 'phone' => 'call me']))->assertStatus(422)->assertJsonPath('errors.phone.0', 'Enter a valid phone number.');

        $this->getJson("/api/shop/customers/{$id}")->assertOk()->assertJsonPath('email', 'jan@example.com');
        $this->getJson('/api/shop/customers/999')->assertStatus(404);
        $this->putJson("/api/shop/customers/{$id}", $this->payload(['city' => 'Brno']))->assertOk()->assertJsonPath('city', 'Brno');
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
        $this->postJson("/api/shop/customers/{$a->id}/restore")->assertOk()->assertJsonPath('deleted_at', null);
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
}
