<?php

/**
 * @file ProductTest.php
 * @path api/tests/Feature/Shop/ProductTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the product administration (ShopProductController): list
 *   with filters, create with categories / prices / images / variants, edit (stock, images,
 *   variants - only of the edited product), quick category change, delete / restore / trash.
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures; Storage fake (public disk).
 */

namespace Tests\Feature\Shop;

use App\Models\Shop\ShopProduct;
use App\Models\Shop\ShopProductImage;
use App\Models\Shop\ShopProductPrice;
use App\Models\Shop\ShopProductVariant;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/products.
 */
class ProductTest extends TestCase
{
    use ShopFixtures;

    /** @var string[] All product permissions. */
    private const ALL = ['shop-products-view', 'shop-products-create', 'shop-products-update', 'shop-products-delete'];

    /**
     * @description Fake product image disk.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    /**
     * @description A valid product form body (price 100 + 21 %).
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge(['name' => 'Desk Lamp', 'prices' => ['vat_rate' => 21, 'price_eur_without_vat' => 100, 'price_eur_with_vat' => 121, 'cost_price_eur' => 60]], $overrides);
    }

    /**
     * @description List: permission, newest first, search, category (any assigned), supplier,
     *   flags, low stock, price range, trash, pagination, export; purchase price for the admin.
     * @input A (Lamp, cat X, supplier S, featured, 2 pcs, 121 EUR, yesterday), B (Chair, cat Y + X,
     *        inactive, 50 pcs, 242 EUR), C trashed.
     * @output Each filter returns the expected product; prices.cost_price_eur present.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/shop/products')->assertStatus(403);

        $this->signIn($this->userWith(['shop-products-view']));
        $x = $this->category(['name' => 'X']);
        $supplier = $this->supplier();
        $a = $this->product(['name' => 'Lamp', 'category_id' => $x->id, 'supplier_id' => $supplier->id, 'is_featured' => true, 'stock_quantity' => 2, 'sku' => 'L-1']);
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $b = $this->product(['name' => 'Chair', 'stock_quantity' => 50], ['price_eur_with_vat' => 242]);
        $b->categories()->attach($x->id);
        $b->update(['is_active' => false]);
        $this->product(['name' => 'Gone'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/shop/products?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$a->id], $ids('search=L-1'));
        $this->assertSame([$b->id, $a->id], $ids("category_id={$x->id}"));
        $this->assertSame([$a->id], $ids("supplier_id={$supplier->id}"));
        $this->assertSame([$b->id], $ids('is_active=0'));
        $this->assertSame([$a->id], $ids('is_featured=1'));
        $this->assertSame([$a->id], $ids('low_stock=1'));
        $this->assertSame([$b->id], $ids('price_from=200'));
        $this->assertSame([$a->id], $ids('price_to=200'));
        $this->assertSame(['Gone'], array_column($this->getJson('/api/shop/products?only_trashed=1')->json('data'), 'name'));
        $this->getJson("/api/shop/products?id={$a->id}&search=Lamp")->assertJsonPath('data.0.prices.cost_price_eur', fn ($v) => $v == 60)
            ->assertJsonPath('data.0.supplier.id', $supplier->id)->assertJsonPath('data.0.categories.0.is_primary', true);
        $this->getJson('/api/shop/products?per_page=1')->assertJson(['total' => 2, 'last_page' => 2]);
        $this->getJson('/api/shop/products?no_pagination=1')->assertOk()->assertJsonCount(2);
    }

    /**
     * @description Create: slug from the name, categories (first = primary), only the known
     *   price fields are stored, images on the public disk, variants with prices + image, stock
     *   = sum of the variants.
     * @input POST multipart {name, category_ids [Y, X], prices (+ unknown key), images [photo], variants
     *        [{M, 3 pcs, prices, images [v.jpg]}, {L, 4 pcs, prices}]}.
     * @output 201 slug 'desk-lamp', active, category_id Y primary, 2 categories, 1 product image,
     *   2 variants, stock 7, variant image linked; price row without the unknown key; files exist.
     */
    public function test_store_with_categories_images_and_variants(): void
    {
        $this->signIn($this->userWith(['shop-products-create']));
        [$x, $y] = [$this->category(['name' => 'X']), $this->category(['name' => 'Y'])];
        $variantPrice = ['vat_rate' => 21, 'price_eur_without_vat' => 50, 'price_eur_with_vat' => 60.5];

        $response = $this->post('/api/shop/products', $this->payload([
            'category_ids' => [$y->id, $x->id], 'is_active' => '1',
            'prices' => ['vat_rate' => 21, 'price_eur_without_vat' => 100, 'price_eur_with_vat' => 121, 'price_czk_with_vat' => 3000],
            'images' => [['file' => $this->imageUpload('main.jpg'), 'is_primary' => '1', 'alt_text' => 'Front']],
            'variants' => [
                ['variant_name' => 'M', 'stock_quantity' => 3, 'sku_variant' => 'L-M', 'prices' => $variantPrice, 'images' => [['file' => $this->imageUpload('v.jpg')]]],
                ['variant_name' => 'L', 'stock_quantity' => 4, 'prices' => $variantPrice],
            ],
        ]), ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('slug', 'desk-lamp')->assertJsonPath('is_active', true)->assertJsonPath('category_id', $y->id)
            ->assertJsonCount(2, 'categories')->assertJsonCount(2, 'variants')->assertJsonPath('stock_quantity', 7)
            ->assertJsonPath('primary_image.alt_text', 'Front')->assertJsonPath('variants.0.prices.price_eur_with_vat', 60.5);

        $product = ShopProduct::findOrFail($response->json('id'));
        $this->assertSame($y->id, $product->primaryCategory()->sole()->id);
        $this->assertSame(['vat_rate' => 21.0, 'price_eur_with_vat' => 121.0], ShopProductPrice::whereNull('variant_id')->sole()->only(['vat_rate', 'price_eur_with_vat']));
        $this->assertSame(1, ShopProductImage::whereNotNull('variant_id')->count());
        foreach (ShopProductImage::pluck('image_path') as $path) {
            Storage::disk('public')->assertExists('products/' . $path);
        }
        $this->assertShopLog('create', 'Created product: Desk Lamp');
    }

    /**
     * @description Create rules: without a category the product is inactive (asking for active
     *   is refused), price required, unique slug / sku; a database error answers 500 without SQL.
     * @input POST without category; POST is_active without category; POST {}; POST same name;
     *        failing shop_products INSERT.
     * @output 201 is_active false; 422 is_active; 422 name / prices; 422 slug; 500 "Product creation failed.".
     */
    public function test_store_rules(): void
    {
        $this->signIn($this->userWith(['shop-products-create']));

        $this->postJson('/api/shop/products', $this->payload())->assertCreated()->assertJsonPath('is_active', false)->assertJsonPath('categories', []);
        $this->postJson('/api/shop/products', $this->payload(['name' => 'Other', 'is_active' => true]))->assertStatus(422)
            ->assertJsonPath('errors.is_active.0', 'Product cannot be set as active without an assigned category.');
        $this->postJson('/api/shop/products', [])->assertStatus(422)->assertJsonValidationErrors(['name', 'prices']);
        $this->postJson('/api/shop/products', $this->payload())->assertStatus(422)->assertJsonValidationErrors(['slug']);

        $this->failOn('shop_products', 'INSERT');
        $this->postJson('/api/shop/products', $this->payload(['name' => 'Boom']))->assertStatus(500)->assertExactJson(['message' => 'Product creation failed.']);
        $this->assertShopLog('error', 'Product creation failed');
    }

    /**
     * @description Detail and edit of a product WITHOUT variants: its own stock is kept (was
     *   reset to 0), price updated, categories kept when not sent, category_ids replace them.
     * @input Product (cat X, 10 pcs); GET; PUT {stock 25, price 150}; PUT {category_ids [Y]}; /999.
     * @output 200; stock 25, price 181.5; categories [X]; then [Y] with category_id Y; 404.
     */
    public function test_show_and_update_simple_product(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $x = $this->category(['name' => 'X']);
        $y = $this->category(['name' => 'Y']);
        $product = $this->product(['name' => 'Desk Lamp', 'category_id' => $x->id]);

        $this->getJson("/api/shop/products/{$product->id}")->assertOk()->assertJsonPath('category.id', $x->id);
        $this->getJson('/api/shop/products/999')->assertStatus(404);

        $this->putJson("/api/shop/products/{$product->id}", $this->payload(['category_id' => $x->id, 'is_active' => true, 'stock_quantity' => 25,
            'prices' => ['vat_rate' => 21, 'price_eur_without_vat' => 150, 'price_eur_with_vat' => 181.5]]))
            ->assertOk()->assertJsonPath('stock_quantity', 25)->assertJsonPath('prices.price_eur_with_vat', 181.5)->assertJsonPath('categories.0.id', $x->id);
        $this->assertSame(25, $product->fresh()->stock_quantity);
        $this->assertShopLog('update', 'Updated product: Desk Lamp');

        $this->putJson("/api/shop/products/{$product->id}", $this->payload(['category_ids' => [$y->id], 'is_active' => true]))
            ->assertOk()->assertJsonPath('category_id', $y->id)->assertJsonCount(1, 'categories')->assertJsonPath('is_active', true);
        $this->putJson('/api/shop/products/999', $this->payload(['name' => 'Unknown']))->assertStatus(404);
    }

    /**
     * @description Edit images and variants: own image replaced / deleted, own variant updated /
     *   deleted, new variant added, stock re-summed; ids of ANOTHER product are ignored (IDOR).
     * @input Product P (image p1, variants V1 2 pcs, V2 3 pcs); product Q (image q1, variant W 9 pcs).
     *        PUT P {images [{id p1, file new}, {id q1, file x}], delete_images [q1], variants [{id V1, 6 pcs},
     *        {id W, 'Hijack'}, {new N, 1 pc}], delete_variants [V2, W]}.
     * @output p1 file replaced (old file gone); q1 untouched; an entry without file is skipped;
     *   V1 6 with a new image, V2 gone with its image file, N added; W unchanged; P stock 7, Q stock 9.
     */
    public function test_update_images_and_variants_of_own_product_only(): void
    {
        $this->signIn($this->userWith(['shop-products-update']));
        $p = $this->product(['name' => 'P']);
        $p1 = $this->image($p, 'p1.jpg');
        $v1 = $this->variant($p, ['variant_name' => 'V1', 'stock_quantity' => 2]);
        $v2 = $this->variant($p, ['variant_name' => 'V2', 'stock_quantity' => 3]);
        $this->image($p, 'v2.jpg', ['variant_id' => $v2->id]);
        $q = $this->product(['name' => 'Q']);
        $q1 = $this->image($q, 'q1.jpg');
        $w = $this->variant($q, ['variant_name' => 'W', 'stock_quantity' => 9]);
        $price = ['vat_rate' => 21, 'price_eur_without_vat' => 10, 'price_eur_with_vat' => 12.1];

        $this->post("/api/shop/products/{$p->id}", $this->payload([
            '_method' => 'PUT', 'name' => 'P', 'category_id' => $p->category_id, 'is_active' => '1',
            'images' => [['id' => $p1->id, 'file' => $this->imageUpload('new.jpg')], ['id' => $q1->id, 'file' => $this->imageUpload('x.jpg')], ['id' => $p1->id], ['alt_text' => 'no file']],
            'delete_images' => [$q1->id],
            'variants' => [
                ['id' => $v1->id, 'variant_name' => 'V1', 'stock_quantity' => 6, 'prices' => $price, 'images' => [['file' => $this->imageUpload('v1.jpg')]]],
                ['id' => $w->id, 'variant_name' => 'Hijack', 'stock_quantity' => 0, 'prices' => $price],
                ['variant_name' => 'N', 'stock_quantity' => 1, 'prices' => $price],
            ],
            'delete_variants' => [$v2->id, $w->id],
        ]), ['Accept' => 'application/json'])->assertOk()->assertJsonPath('stock_quantity', 7)->assertJsonCount(2, 'variants');

        Storage::disk('public')->assertMissing('products/p1.jpg');
        Storage::disk('public')->assertExists('products/' . $p1->fresh()->image_path);
        $this->assertSame('q1.jpg', $q1->fresh()->image_path);
        Storage::disk('public')->assertExists('products/q1.jpg');
        $this->assertSame(6, $v1->fresh()->stock_quantity);
        $this->assertSoftDeleted($v2);
        $this->assertSame(['W', 9], [$w->fresh()->variant_name, $w->fresh()->stock_quantity]);
        $this->assertNotNull($w->fresh());
        $this->assertSame(9, $q->fresh()->stock_quantity);
        $this->assertSame(1, ShopProductVariant::where('variant_name', 'N')->count());
        $this->assertSame(1, ShopProductImage::where('variant_id', $v1->id)->count());
        Storage::disk('public')->assertMissing('products/v2.jpg');
        $this->assertSame(0, ShopProductImage::where('variant_id', $v2->id)->count());
    }

    /**
     * @description Edit rules: without a category in the form the product is saved inactive and
     *   cannot be switched active; a variant SKU must be unique (its own SKU may stay).
     * @input Product P (active, cat X) with variant V (sku V-1), other variant W (sku W-1).
     *        PUT without category; PUT is_active without category; PUT variant sku W-1; PUT own sku V-1.
     * @output 200 is_active false (categories kept); 422 is_active; 422 'Variant SKU "W-1" already exists.'; 200.
     */
    public function test_update_rules(): void
    {
        $this->signIn($this->userWith(['shop-products-update']));
        $product = $this->product(['name' => 'P']);
        $variant = $this->variant($product, ['sku_variant' => 'V-1']);
        $this->variant($this->product(['name' => 'Q']), ['sku_variant' => 'W-1']);
        $price = ['vat_rate' => 21, 'price_eur_without_vat' => 1, 'price_eur_with_vat' => 1.21];

        $this->putJson("/api/shop/products/{$product->id}", $this->payload(['name' => 'P']))->assertOk()->assertJsonPath('is_active', false)->assertJsonCount(1, 'categories');
        $this->putJson("/api/shop/products/{$product->id}", $this->payload(['name' => 'P', 'is_active' => true]))->assertStatus(422)
            ->assertJsonPath('errors.is_active.0', 'Product cannot be set as active without an assigned category.');
        $this->putJson("/api/shop/products/{$product->id}", $this->payload(['name' => 'P', 'category_id' => $product->category_id,
            'variants' => [['id' => $variant->id, 'variant_name' => 'V', 'sku_variant' => 'W-1', 'prices' => $price]]]))
            ->assertStatus(422)->assertJsonPath('errors', fn ($e) => $e['variants.0.sku_variant'][0] === 'Variant SKU "W-1" already exists.');
        $this->putJson("/api/shop/products/{$product->id}", $this->payload(['name' => 'P', 'category_id' => $product->category_id,
            'variants' => [['id' => $variant->id, 'variant_name' => 'V', 'sku_variant' => 'V-1', 'prices' => $price]]]))->assertOk();
    }

    /**
     * @description Deleting an own image and a variant's own image list in an edit.
     * @input Product with image i1 and variant V with image vi; PUT {delete_images [i1], variants [{id V,
     *        delete_images [vi]}]}.
     * @output Both rows soft-deleted, both files removed.
     */
    public function test_update_deletes_images(): void
    {
        $this->signIn($this->userWith(['shop-products-update']));
        $product = $this->product(['name' => 'P']);
        $i1 = $this->image($product, 'i1.jpg');
        $variant = $this->variant($product, ['variant_name' => 'V']);
        $vi = $this->image($product, 'vi.jpg', ['variant_id' => $variant->id]);

        $this->putJson("/api/shop/products/{$product->id}", $this->payload([
            'name' => 'P', 'category_id' => $product->category_id, 'delete_images' => [$i1->id],
            'variants' => [['id' => $variant->id, 'variant_name' => 'V', 'delete_images' => [$vi->id], 'prices' => ['vat_rate' => 21, 'price_eur_without_vat' => 1, 'price_eur_with_vat' => 1.21]]],
        ]))->assertOk();

        $this->assertSoftDeleted($i1);
        $this->assertSoftDeleted($vi);
        Storage::disk('public')->assertMissing('products/i1.jpg');
        Storage::disk('public')->assertMissing('products/vi.jpg');
    }

    /**
     * @description A database error during an edit answers 500 without SQL details.
     * @input shop_products UPDATE fails.
     * @output 500 "Update failed."; shop log 'error'.
     */
    public function test_update_database_error(): void
    {
        $this->signIn($this->userWith(['shop-products-update']));
        $product = $this->product(['name' => 'P']);
        $this->failOn('shop_products', 'UPDATE');

        $this->putJson("/api/shop/products/{$product->id}", $this->payload(['name' => 'P2', 'category_id' => $product->category_id]))
            ->assertStatus(500)->assertExactJson(['message' => 'Update failed.']);
        $this->assertShopLog('error', "Update failed for ID {$product->id}");
    }

    /**
     * @description Quick category change: new set with a primary, removing all categories
     *   deactivates the product; validation; 404; database error.
     * @input Product (cat X); PATCH {category_id Y, category_ids [X]}; PATCH {category_ids []};
     *        PATCH {category_ids [999]}; /999; failing pivot INSERT.
     * @output categories X + Y, category_id Y; no categories, inactive; 422; 404; 500.
     */
    public function test_update_category(): void
    {
        $this->signIn($this->userWith(['shop-products-update']));
        $x = $this->category(['name' => 'X']);
        $y = $this->category(['name' => 'Y']);
        $product = $this->product(['category_id' => $x->id]);

        $this->patchJson("/api/shop/products/{$product->id}/category", ['category_id' => $y->id, 'category_ids' => [$x->id]])->assertOk()
            ->assertJsonPath('category_id', $y->id)->assertJsonCount(2, 'categories');
        $this->assertShopLog('update', 'Quick update of product categories');
        $this->patchJson("/api/shop/products/{$product->id}/category", ['category_ids' => []])->assertOk()
            ->assertJsonPath('categories', [])->assertJsonPath('category_id', null)->assertJsonPath('is_active', false);
        $this->patchJson("/api/shop/products/{$product->id}/category", ['category_ids' => [999]])->assertStatus(422);
        $this->patchJson('/api/shop/products/999/category', ['category_ids' => [$x->id]])->assertStatus(404);

        $this->failOn('shop_product_categories', 'INSERT');
        $this->patchJson("/api/shop/products/{$product->id}/category", ['category_ids' => [$x->id]])->assertStatus(500)->assertJson(['message' => 'Category update failed.']);
    }

    /**
     * @description Delete soft / permanent (files, variants and prices removed), a product that
     *   was ordered cannot be removed permanently (order items keep it), restore, empty trash,
     *   404s, database errors.
     * @input A (image, variant with image); B ordered; C; actions in sequence; failing writes.
     * @output A soft then gone with its files / rows; B 500 "Product deletion failed." (still there);
     *   C restored; trash emptied (Count: …); 404s; 500s.
     */
    public function test_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $a = $this->product(['name' => 'A']);
        $this->image($a, 'a.jpg');
        $variant = $this->variant($a, [], ['price_eur_with_vat' => 10]);
        $this->image($a, 'av.jpg', ['variant_id' => $variant->id]);
        $b = $this->product(['name' => 'B']);
        $this->order(null, [], [[$b, 1]]);
        $c = $this->product(['name' => 'C']);

        $this->deleteJson("/api/shop/products/{$a->id}")->assertNoContent();
        $this->assertSoftDeleted($a);
        $this->deleteJson("/api/shop/products/{$a->id}?force_delete=true")->assertNoContent();
        $this->assertNull(ShopProduct::withTrashed()->find($a->id));
        $this->assertSame(0, ShopProductVariant::withTrashed()->where('product_id', $a->id)->count() + ShopProductPrice::where('product_id', $a->id)->count());
        Storage::disk('public')->assertMissing('products/a.jpg');
        Storage::disk('public')->assertMissing('products/av.jpg');
        $this->assertShopLog('hard_delete', "Deleted product ID: {$a->id}");

        $this->deleteJson("/api/shop/products/{$b->id}?force_delete=true")->assertStatus(500)->assertExactJson(['message' => 'Product deletion failed.']);
        $this->assertNotNull(ShopProduct::withTrashed()->find($b->id));
        $this->deleteJson('/api/shop/products/999')->assertStatus(404);

        $c->delete();
        $this->postJson("/api/shop/products/{$c->id}/restore")->assertOk()->assertJsonPath('deleted_at', null);
        $this->assertShopLog('restore', "Restored product ID: {$c->id}");
        $this->postJson('/api/shop/products/999/restore')->assertStatus(404);

        $d = $this->product(['name' => 'D']);
        $this->image($d, 'd.jpg');
        $dv = $this->variant($d);
        $this->image($d, 'dv.jpg', ['variant_id' => $dv->id]);
        $d->delete();
        $this->deleteJson('/api/shop/products/force-delete-all')->assertNoContent();
        Storage::disk('public')->assertMissing('products/d.jpg');
        Storage::disk('public')->assertMissing('products/dv.jpg');
        $this->assertShopLog('force_delete_all', 'Count: 1');

        $b->delete();
        $this->deleteJson('/api/shop/products/force-delete-all')->assertStatus(500)->assertExactJson(['message' => 'Emptying trash failed.']);
        $this->failOn('shop_products', 'UPDATE');
        $this->postJson("/api/shop/products/{$b->id}/restore")->assertStatus(500)->assertJson(['message' => 'Product restore failed.']);
    }
}
