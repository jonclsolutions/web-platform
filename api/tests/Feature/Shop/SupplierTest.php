<?php

/**
 * @file SupplierTest.php
 * @path api/tests/Feature/Shop/SupplierTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the suppliers (ShopSupplierController): list with filters,
 *   create / edit with validation, delete / bulk delete / restore / trash and the import
 *   (template, dry run, commit).
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures, Tests\Support\WebFixtures (importFile); Storage fake.
 */

namespace Tests\Feature\Shop;

use App\Models\Core\CoreImportBatch;
use App\Models\Shop\ShopSupplier;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ShopFixtures;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/suppliers.
 */
class SupplierTest extends TestCase
{
    use ShopFixtures;
    use WebFixtures;

    /** @var string[] All supplier permissions. */
    private const ALL = ['shop-suppliers-view', 'shop-suppliers-create', 'shop-suppliers-update', 'shop-suppliers-delete'];

    /** @var string[] Columns of the import file. */
    private const COLUMNS = ['name', 'ico', 'contact_person', 'email', 'phone', 'address', 'city', 'postal_code', 'country', 'payment_terms', 'is_active', 'notes'];

    /**
     * @description Fake disk for the temporary import files.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /**
     * @description One import row with the given values (other columns empty).
     * @param array<string, string> $values Values.
     * @return array<string, string>
     */
    private function row(array $values): array
    {
        return array_merge(array_fill_keys(self::COLUMNS, ''), $values);
    }

    /**
     * @description List: permission, search, exact / partial filters, date, trash, export.
     * @input A (Acme, ico 123, Praha, yesterday), B (Beta, Brno, inactive), C trashed.
     * @output Each filter returns the expected supplier.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/shop/suppliers')->assertStatus(403);

        $this->signIn($this->userWith(['shop-suppliers-view']));
        $a = $this->supplier(['name' => 'Acme', 'ico' => '123', 'city' => 'Praha', 'payment_terms' => '14 days']);
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $b = $this->supplier(['name' => 'Beta', 'city' => 'Brno', 'is_active' => false, 'email' => 'b@beta.cz']);
        $this->supplier(['name' => 'Gone'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/shop/suppliers?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$a->id], $ids('search=14%20da'));
        $this->assertSame([$a->id], $ids("id={$a->id}"));
        $this->assertSame([$b->id], $ids('is_active=0'));
        $this->assertSame([$b->id], $ids('email=beta'));
        $this->assertSame([$a->id], $ids('ico=12'));
        $this->assertSame([$a->id], $ids('created_at=' . now()->subDay()->toDateString()));
        $this->assertSame(['Gone'], array_column($this->getJson('/api/shop/suppliers?only_trashed=1')->json('data'), 'name'));
        $this->getJson('/api/shop/suppliers?per_page=1')->assertJson(['meta' => ['total' => 2, 'last_page' => 2]]);
        $this->getJson('/api/shop/suppliers?no_pagination=1')->assertOk()->assertJsonCount(2, 'data');
    }

    /**
     * @description Create, detail (also trashed), edit, unique company id, 404s, database errors.
     * @input POST valid; POST same ico; GET; PUT {name, ico same}; PUT other's ico; /999; failures.
     * @output 201; 422 "A supplier with this company ID already exists."; 200; 200; 422; 404; 500.
     */
    public function test_store_show_update(): void
    {
        $this->signIn($this->userWith(self::ALL));

        $id = $this->postJson('/api/shop/suppliers', ['name' => 'Acme', 'ico' => '123', 'is_active' => true])->assertCreated()->assertJsonPath('data.ico', '123')->json('data.id');
        $this->assertShopLog('create', 'Created supplier: Acme');
        $this->postJson('/api/shop/suppliers', ['name' => 'Other', 'ico' => '123', 'is_active' => true])
            ->assertStatus(422)->assertJsonPath('errors.ico.0', 'A supplier with this company ID already exists.');
        $this->postJson('/api/shop/suppliers', [])->assertStatus(422)->assertJsonValidationErrors(['name', 'is_active']);

        $other = $this->supplier(['ico' => '999']);
        $this->getJson("/api/shop/suppliers/{$id}")->assertOk()->assertJsonPath('data.name', 'Acme');
        $this->getJson('/api/shop/suppliers/999')->assertStatus(404);
        $this->putJson("/api/shop/suppliers/{$id}", ['name' => 'Acme 2', 'ico' => '123', 'is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertShopLog('update', "Updated supplier ID: {$id}");
        $this->putJson("/api/shop/suppliers/{$id}", ['name' => 'Acme', 'ico' => '999', 'is_active' => true])->assertStatus(422);
        $this->putJson('/api/shop/suppliers/999', ['name' => 'X1', 'is_active' => true])->assertStatus(404);

        $this->failOn('shop_suppliers', 'UPDATE');
        $this->putJson("/api/shop/suppliers/{$other->id}", ['name' => 'Boom', 'is_active' => true])->assertStatus(500)->assertJson(['message' => 'Supplier update failed.']);
        $this->failOn('shop_suppliers', 'INSERT');
        $this->postJson('/api/shop/suppliers', ['name' => 'New', 'is_active' => true])->assertStatus(500)->assertJson(['message' => 'Supplier creation failed.']);
    }

    /**
     * @description Delete (soft / permanent), bulk delete, restore, empty trash, 404s, errors.
     * @input Suppliers A, B, C, D; the actions in sequence; then failing writes.
     * @output As expected; logs written.
     */
    public function test_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        [$a, $b, $c, $d] = [$this->supplier(), $this->supplier(), $this->supplier(), $this->supplier()];

        $this->deleteJson("/api/shop/suppliers/{$a->id}")->assertNoContent();
        $this->assertSoftDeleted($a);
        $this->deleteJson("/api/shop/suppliers/{$b->id}?force_delete=1")->assertNoContent();
        $this->assertNull(ShopSupplier::withTrashed()->find($b->id));
        $this->deleteJson('/api/shop/suppliers/999')->assertStatus(404);
        $this->postJson("/api/shop/suppliers/{$a->id}/restore")->assertOk()->assertJsonPath('data.deleted_at', null);
        $this->postJson('/api/shop/suppliers/999/restore')->assertStatus(404);

        $this->postJson('/api/shop/suppliers/bulk-delete', ['ids' => [$a->id, 999]])->assertOk()
            ->assertJson(['data' => ['deleted_count' => 1, 'skipped_count' => 1, 'requested' => 2]]);
        $this->assertShopLog('soft_delete_bulk');
        $this->postJson('/api/shop/suppliers/bulk-delete', ['ids' => array_merge([$c->id], range(500, 560)), 'force_delete' => true])->assertOk()->assertJsonPath('data.deleted_count', 1);
        $this->assertShopLog('hard_delete_bulk', '...');
        $this->postJson('/api/shop/suppliers/bulk-delete', [])->assertStatus(422);

        $this->deleteJson('/api/shop/suppliers/force-delete-all')->assertNoContent();
        $this->assertSame(0, ShopSupplier::onlyTrashed()->count());
        $this->assertShopLog('force_delete_all', 'Count: 1');

        $e = $this->supplier();
        $e->delete();
        $this->failOn('shop_suppliers', 'UPDATE');
        $this->deleteJson("/api/shop/suppliers/{$d->id}")->assertStatus(500)->assertJson(['message' => 'Supplier deletion failed.']);
        $this->postJson('/api/shop/suppliers/bulk-delete', ['ids' => [$d->id]])->assertStatus(500)->assertJson(['message' => 'Bulk deletion failed.']);
        $this->postJson("/api/shop/suppliers/{$e->id}/restore")->assertStatus(500)->assertJson(['message' => 'Supplier restoration failed.']);
        $this->failOn('shop_suppliers', 'DELETE');
        $this->deleteJson('/api/shop/suppliers/force-delete-all')->assertStatus(500)->assertJson(['message' => 'Emptying trash failed.']);
    }

    /**
     * @description Import template in CSV (';'), TXT (tab) and JSON; unknown format; permission.
     * @input GET import/template ?format=csv|txt|json|xml; account without create permission.
     * @output Header lines / one empty record, file name import-template-shop-suppliers; 422; 403.
     */
    public function test_import_template(): void
    {
        $this->signIn($this->userWith(['shop-suppliers-view']));
        $this->getJson('/api/shop/suppliers/import/template')->assertStatus(403);

        $this->signIn($this->userWith(['shop-suppliers-create']));
        $this->get('/api/shop/suppliers/import/template')->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="import-template-shop-suppliers.csv"')
            ->assertContent(implode(';', self::COLUMNS) . "\n");
        $this->get('/api/shop/suppliers/import/template?format=txt')->assertOk()->assertContent(implode("\t", self::COLUMNS) . "\n");
        $json = $this->get('/api/shop/suppliers/import/template?format=json')->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="import-template-shop-suppliers.json"')->getContent();
        $this->assertSame([array_fill_keys(self::COLUMNS, '')], json_decode($json, true));
        $this->getJson('/api/shop/suppliers/import/template?format=xml')->assertStatus(422);
    }

    /**
     * @description Dry run counts valid / invalid rows (with file row numbers), keeps the file,
     *   imports nothing; bad input is refused; commit imports the valid rows (empty cells as
     *   NULL, so two rows without ico do not collide), skips a duplicate ico, completes the
     *   batch and logs; the batch cannot be committed twice.
     * @input Template CSV + rows: A (no ico), B (no ico), C (ico 77), D (ico 77 again), E (no name).
     * @output validate {total 5, valid 4, invalid 1, errors[0].row 6}; commit {imported 3, skipped 2};
     *   A/B ico NULL; batch 'completed'; file gone; log 'import'; second commit 404.
     */
    public function test_import_validate_and_commit(): void
    {
        $this->signIn($this->userWith(['shop-suppliers-create']));
        $template = $this->get('/api/shop/suppliers/import/template')->getContent();
        $rows = [
            $this->row(['name' => 'Alpha', 'is_active' => '1']),
            $this->row(['name' => 'Bravo', 'is_active' => '0', 'email' => 'b@bravo.cz']),
            $this->row(['name' => 'Charlie', 'ico' => '77', 'is_active' => '1']),
            $this->row(['name' => 'Delta', 'ico' => '77', 'is_active' => '1']),
            $this->row(['name' => '', 'is_active' => '1']),
        ];
        $csv = $template . implode("\n", array_map(fn ($r) => implode(';', $r), $rows)) . "\n";

        $response = $this->post('/api/shop/suppliers/import/validate', ['format' => 'csv', 'file' => $this->importFile('csv', $csv)], ['Accept' => 'application/json'])
            ->assertOk()->assertJson(['data' => ['total_rows' => 5, 'valid_rows' => 4, 'invalid_rows' => 1, 'can_commit' => true]])->assertJsonPath('data.errors.0.row', 6);
        $batch = CoreImportBatch::findOrFail($response->json('data.import_token'));
        $this->assertSame('shop/suppliers', $batch->resource);
        Storage::disk('local')->assertExists($batch->temp_path);
        $this->assertSame(0, ShopSupplier::count());

        $this->postJson('/api/shop/suppliers/import/commit', ['import_token' => $batch->id])->assertOk()
            ->assertJson(['data' => ['queued' => false, 'imported_count' => 3, 'skipped_count' => 2, 'skip_reasons' => []]]);
        $this->assertSame(['Alpha', 'Bravo', 'Charlie'], ShopSupplier::orderBy('id')->pluck('name')->all());
        $this->assertSame(2, ShopSupplier::whereNull('ico')->count());
        $this->assertSame('completed', $batch->fresh()->status);
        Storage::disk('local')->assertMissing($batch->temp_path);
        $this->assertShopLog('import', 'added 3 suppliers, skipped 2');
        $this->postJson('/api/shop/suppliers/import/commit', ['import_token' => $batch->id])->assertStatus(404);
        $this->postJson('/api/shop/suppliers/import/commit', [])->assertStatus(422);

        $this->postJson('/api/shop/suppliers/import/validate', [])->assertStatus(422)->assertJsonValidationErrors(['format', 'file']);
        $this->post('/api/shop/suppliers/import/validate', ['format' => 'json', 'file' => $this->importFile('json', json_encode([['foo' => 'bar']]))], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'column headers in the file do not match'));
    }

    /**
     * @description Expired temporary file answers 410; a database error fails the batch,
     *   deletes the file and answers 500 without SQL details.
     * @input Batch whose file was removed; batch with shop_suppliers INSERT failing.
     * @output 410 "has expired"; 500 "Import failed." + batch 'failed' + shop log 'error'.
     */
    public function test_import_commit_failures(): void
    {
        $this->signIn($this->userWith(['shop-suppliers-create']));
        $file = fn () => $this->importFile('json', json_encode([$this->row(['name' => 'Alpha', 'is_active' => '1'])]));

        $expired = $this->post('/api/shop/suppliers/import/validate', ['format' => 'json', 'file' => $file()], ['Accept' => 'application/json'])->json('data.import_token');
        Storage::disk('local')->delete(CoreImportBatch::find($expired)->temp_path);
        $this->postJson('/api/shop/suppliers/import/commit', ['import_token' => $expired])->assertStatus(410)->assertJsonPath('message', fn ($m) => str_contains($m, 'has expired'));

        $broken = $this->post('/api/shop/suppliers/import/validate', ['format' => 'json', 'file' => $file()], ['Accept' => 'application/json'])->json('data.import_token');
        $this->failOn('shop_suppliers', 'INSERT');
        $this->postJson('/api/shop/suppliers/import/commit', ['import_token' => $broken])->assertStatus(500)->assertExactJson(['message' => 'Import failed.']);
        $this->assertSame('failed', CoreImportBatch::find($broken)->status);
        $this->assertShopLog('error', 'Error during import');
    }
}
