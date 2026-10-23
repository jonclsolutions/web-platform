<?php

/**
 * @file CategoryTest.php
 * @path api/tests/Feature/Shop/CategoryTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the product categories (ShopCategoryController): list with
 *   product counts (admin and public storefront), create / edit with the per-level unique
 *   slug and the parent rules, delete protection for categories with children or products.
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures.
 */

namespace Tests\Feature\Shop;

use App\Models\Shop\ShopCategory;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/categories and GET /api/shop/public/categories.
 */
class CategoryTest extends TestCase
{
    use ShopFixtures;

    /** @var string[] All category permissions. */
    private const ALL = ['shop-categories-view', 'shop-categories-create', 'shop-categories-update', 'shop-categories-delete'];

    /**
     * @description List: permission, sort order, search, filters, product count, parent name,
     *   pagination, export; the same list is public for the storefront.
     * @input Root 'Shoes' (sort 2, 1 product), child 'Boots' of Shoes (sort 1), 'Hats' inactive (sort 3).
     * @output Order Boots, Shoes, Hats; filters; products_count 1; parent_name 'Shoes'; public 200.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/shop/categories')->assertStatus(403);

        $this->signIn($this->userWith(['shop-categories-view']));
        $shoes = $this->category(['name' => 'Shoes', 'sort_order' => 2]);
        $boots = $this->category(['name' => 'Boots', 'parent_id' => $shoes->id, 'sort_order' => 1]);
        $hats = $this->category(['name' => 'Hats', 'is_active' => false, 'sort_order' => 3]);
        $this->product(['category_id' => $shoes->id]);

        $ids = fn (string $q) => array_column($this->getJson("/api/shop/categories?{$q}")->json('data'), 'id');
        $this->assertSame([$boots->id, $shoes->id, $hats->id], $ids(''));
        $this->assertSame([$boots->id], $ids('search=boo'));
        $this->assertSame([$boots->id], $ids("parent_id={$shoes->id}"));
        $this->assertSame([$hats->id], $ids('is_active=0'));
        $this->getJson("/api/shop/categories?search=Shoes")->assertJsonPath('data.0.products_count', 1);
        $this->getJson("/api/shop/categories?search=Boots")->assertJsonPath('data.0.parent_name', 'Shoes');
        $this->getJson('/api/shop/categories?per_page=1')->assertJson(['total' => 3, 'last_page' => 3]);
        $this->getJson('/api/shop/categories?no_pagination=1')->assertOk()->assertJsonCount(3);

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/shop/public/categories')->assertOk()->assertJsonPath('total', 3);
    }

    /**
     * @description Create: slug from the name, unique per parent level (the same slug is fine
     *   under another parent), is_active defaults to false; validation; database error.
     * @input POST {name 'Summer Sale'}; POST same name; POST same name under a parent; POST {}; failure.
     * @output 201 slug 'summer-sale', is_active false; 422 slug; 201; 422 name; 500.
     */
    public function test_store(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $parent = $this->category(['name' => 'Root']);

        $this->postJson('/api/shop/categories', ['name' => 'Summer Sale'])->assertCreated()
            ->assertJsonPath('slug', 'summer-sale')->assertJsonPath('is_active', false);
        $this->assertShopLog('create', 'Created category: Summer Sale');
        $this->postJson('/api/shop/categories', ['name' => 'Summer Sale', 'parent_id' => $parent->id])->assertCreated()->assertJsonPath('parent_id', $parent->id);
        $this->postJson('/api/shop/categories', ['name' => 'Summer Sale', 'parent_id' => $parent->id])->assertStatus(422)->assertJsonValidationErrors(['slug']);
        $this->postJson('/api/shop/categories', [])->assertStatus(422)->assertJsonValidationErrors(['name']);

        $this->failOn('shop_categories', 'INSERT');
        $this->postJson('/api/shop/categories', ['name' => 'Boom'])->assertStatus(500)->assertJson(['message' => 'Failed to create category.']);
    }

    /**
     * @description Detail with children; edit (slug re-generated from the name, uniqueness
     *   checked on the stored parent level); a category cannot be its own parent; 404s; error.
     * @input A with child C, B; GET A; PUT B {name 'A'}; PUT B {name 'B2'}; PUT B {parent_id B};
     *        PUT B {parent A}; PUT B {name 'C', parent A} (C exists under A); PUT /999; failing UPDATE.
     * @output children [C]; 422 slug; 200 slug 'b2'; 422 parent_id; 200; 422 slug; 404; 500.
     */
    public function test_show_and_update(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $a = $this->category(['name' => 'A']);
        $child = $this->category(['name' => 'C', 'parent_id' => $a->id]);
        $b = $this->category(['name' => 'B']);

        $this->getJson("/api/shop/categories/{$a->id}")->assertOk()->assertJsonPath('children.0.id', $child->id);
        $this->getJson('/api/shop/categories/999')->assertStatus(404);
        $this->putJson("/api/shop/categories/{$b->id}", ['name' => 'A'])->assertStatus(422)->assertJsonValidationErrors(['slug']);
        $this->putJson("/api/shop/categories/{$b->id}", ['name' => 'B2', 'sort_order' => 4])->assertOk()->assertJsonPath('slug', 'b2')->assertJsonPath('sort_order', 4);
        $this->assertShopLog('update', "Updated category ID: {$b->id}");
        $this->putJson("/api/shop/categories/{$b->id}", ['parent_id' => $b->id])->assertStatus(422)->assertJsonValidationErrors(['parent_id']);
        $this->putJson("/api/shop/categories/{$b->id}", ['parent_id' => $a->id])->assertOk()->assertJsonPath('parent_id', $a->id);
        $this->putJson("/api/shop/categories/{$b->id}", ['name' => 'C', 'parent_id' => $a->id])->assertStatus(422)->assertJsonValidationErrors(['slug']);
        $this->putJson('/api/shop/categories/999', ['sort_order' => 1])->assertStatus(404);

        $this->failOn('shop_categories', 'UPDATE');
        $this->putJson("/api/shop/categories/{$b->id}", ['sort_order' => 9])->assertStatus(500)->assertJson(['message' => 'Failed to update category.']);
    }

    /**
     * @description A category with subcategories or products cannot be deleted; an empty one can.
     * @input Parent P with child K; category Q with a product; empty E; /999; failing DELETE.
     * @output 422 "contains subcategories"; 422 "has assigned products"; 204; 404; 500.
     */
    public function test_destroy(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $parent = $this->category(['name' => 'P']);
        $this->category(['name' => 'K', 'parent_id' => $parent->id]);
        $withProduct = $this->category(['name' => 'Q']);
        $this->product(['category_id' => $withProduct->id]);
        $empty = $this->category(['name' => 'E']);
        $other = $this->category(['name' => 'F']);

        $this->deleteJson("/api/shop/categories/{$parent->id}")->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'contains subcategories'));
        $this->deleteJson("/api/shop/categories/{$withProduct->id}")->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'has assigned products'));
        $this->deleteJson("/api/shop/categories/{$empty->id}")->assertNoContent();
        $this->assertNull(ShopCategory::find($empty->id));
        $this->assertShopLog('delete', 'Deleted category: E');
        $this->deleteJson('/api/shop/categories/999')->assertStatus(404);

        $this->failOn('shop_categories', 'DELETE');
        $this->deleteJson("/api/shop/categories/{$other->id}")->assertStatus(500)->assertJson(['message' => 'Deletion failed.']);
    }
}
