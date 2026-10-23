<?php

/**
 * @file ShopFixtures.php
 * @path api/tests/Support/ShopFixtures.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Test helpers of the Shop section: creates the catalogue (categories,
 *   suppliers, products with prices / variants / images), coupons, customers, payment and
 *   shipping methods and orders with items, and asserts on the shop audit log.
 * @dependencies
 * - App\Models\Shop\*; Illuminate\Http\UploadedFile (fake images / import files).
 */

namespace Tests\Support;

use App\Models\Shop\ShopCategory;
use App\Models\Shop\ShopCoupon;
use App\Models\Shop\ShopCustomer;
use App\Models\Shop\ShopLog;
use App\Models\Shop\ShopOrder;
use App\Models\Shop\ShopOrderItem;
use App\Models\Shop\ShopPaymentMethod;
use App\Models\Shop\ShopProduct;
use App\Models\Shop\ShopProductImage;
use App\Models\Shop\ShopProductVariant;
use App\Models\Shop\ShopShippingMethod;
use App\Models\Shop\ShopSupplier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * @description Used by the tests in tests/Feature/Shop and tests/Unit/Shop.
 */
trait ShopFixtures
{
    /** @var array<string, float> Default price row: 100 EUR + 21 % VAT, purchase price 60. */
    protected array $defaultPrice = ['vat_rate' => 21, 'price_eur_without_vat' => 100, 'price_eur_with_vat' => 121, 'cost_price_eur' => 60];

    /**
     * @description Creates a category.
     * @param array<string, mixed> $attributes Column overrides.
     * @return ShopCategory
     */
    protected function category(array $attributes = []): ShopCategory
    {
        $name = $attributes['name'] ?? 'Category ' . Str::random(5);

        return ShopCategory::create(array_merge(['name' => $name, 'slug' => Str::slug($name), 'is_active' => true], $attributes));
    }

    /**
     * @description Creates a supplier.
     * @param array<string, mixed> $attributes Column overrides.
     * @return ShopSupplier
     */
    protected function supplier(array $attributes = []): ShopSupplier
    {
        return ShopSupplier::create(array_merge(['name' => 'Supplier s.r.o.', 'is_active' => true], $attributes));
    }

    /**
     * @description Creates an active product in a (new) primary category with a price row.
     * @param array<string, mixed> $attributes Column overrides ('category_id' => null = no category).
     * @param array<string, float>|null $price Price row; null = no price.
     * @return ShopProduct
     */
    protected function product(array $attributes = [], ?array $price = []): ShopProduct
    {
        $name = $attributes['name'] ?? 'Product ' . Str::random(6);
        if (!array_key_exists('category_id', $attributes)) {
            $attributes['category_id'] = $this->category()->id;
        }
        $product = ShopProduct::create(array_merge(['name' => $name, 'slug' => Str::slug($name), 'stock_quantity' => 10, 'is_active' => true], $attributes));
        if ($product->category_id) {
            $product->categories()->attach($product->category_id, ['is_primary' => 1, 'sort_order' => 0]);
        }
        if ($price !== null) {
            $product->prices()->create(array_merge($this->defaultPrice, $price));
        }

        return $product->fresh();
    }

    /**
     * @description Creates a variant of the product (re-sums the product stock), optionally priced.
     * @param ShopProduct $product Owner product.
     * @param array<string, mixed> $attributes Column overrides.
     * @param array<string, float>|null $price Variant price row; null = uses the product price.
     * @return ShopProductVariant
     */
    protected function variant(ShopProduct $product, array $attributes = [], ?array $price = null): ShopProductVariant
    {
        $variant = ShopProductVariant::create(array_merge(['product_id' => $product->id, 'variant_name' => 'Black M', 'stock_quantity' => 5], $attributes));
        if ($price !== null) {
            $variant->prices()->create(array_merge($this->defaultPrice, $price, ['product_id' => $product->id]));
        }

        return $variant;
    }

    /**
     * @description Adds a stored image (file on the faked public disk + row) to a product.
     * @param ShopProduct $product Owner product.
     * @param string $fileName File name in products/.
     * @param array<string, mixed> $attributes Column overrides (variant_id, is_primary, …).
     * @return ShopProductImage
     */
    protected function image(ShopProduct $product, string $fileName = 'a.jpg', array $attributes = []): ShopProductImage
    {
        Storage::disk('public')->put('products/' . $fileName, 'img');

        return ShopProductImage::create(array_merge(['product_id' => $product->id, 'image_path' => $fileName, 'alt_text' => 'Alt'], $attributes))->fresh();
    }

    /**
     * @description A fake image upload.
     * @param string $name File name.
     * @return UploadedFile
     */
    protected function imageUpload(string $name = 'photo.jpg'): UploadedFile
    {
        return $this->fakeImage($name);
    }

    /**
     * @description Creates a coupon (10 % off, active, unlimited).
     * @param array<string, mixed> $attributes Column overrides.
     * @return ShopCoupon
     */
    protected function coupon(array $attributes = []): ShopCoupon
    {
        return ShopCoupon::create(array_merge(['code' => 'SAVE10', 'discount_type' => 'percent', 'discount_value' => 10, 'applies_to' => 'all', 'is_active' => true], $attributes));
    }

    /**
     * @description Creates a customer.
     * @param array<string, mixed> $attributes Column overrides.
     * @return ShopCustomer
     */
    protected function customer(array $attributes = []): ShopCustomer
    {
        return ShopCustomer::create(array_merge([
            'email' => 'eva@example.com', 'first_name' => 'Eva', 'last_name' => 'Nova', 'phone' => '777123456', 'is_active' => true,
        ], $attributes));
    }

    /**
     * @description Creates a payment method.
     * @param array<string, mixed> $attributes Column overrides.
     * @return ShopPaymentMethod
     */
    protected function paymentMethod(array $attributes = []): ShopPaymentMethod
    {
        return ShopPaymentMethod::create(array_merge(['code' => 'bank_transfer', 'name' => 'Bank transfer', 'price' => 0, 'provider' => 'manual', 'config' => ['merchant_key' => 'secret-key'], 'is_active' => true], $attributes));
    }

    /**
     * @description Creates a shipping method (5 EUR).
     * @param array<string, mixed> $attributes Column overrides.
     * @return ShopShippingMethod
     */
    protected function shippingMethod(array $attributes = []): ShopShippingMethod
    {
        return ShopShippingMethod::create(array_merge(['code' => 'ppl', 'name' => 'PPL', 'shipping_type' => 'address', 'base_price' => 5, 'is_active' => true], $attributes));
    }

    /**
     * @description Creates an order with items (no stock movement - a stored order as it is).
     * @param ShopCustomer|null $customer Customer (new one when null).
     * @param array<string, mixed> $attributes Column overrides.
     * @param array<int, array{0: ShopProduct, 1: int, 2?: ShopProductVariant|null}> $items [product, quantity, variant?] at 121 EUR.
     * @return ShopOrder
     */
    protected function order(?ShopCustomer $customer = null, array $attributes = [], array $items = []): ShopOrder
    {
        $customer ??= $this->customer(['email' => Str::random(8) . '@example.com']);
        $order = ShopOrder::create(array_merge([
            'customer_id' => $customer->id, 'order_number' => ShopOrder::generateOrderNumber(), 'status' => 'pending', 'payment_status' => 'pending',
            'total_amount' => 121, 'shipping_amount' => 0, 'final_amount' => 121, 'shipping_address' => 'Main 1', 'shipping_city' => 'Praha',
            'shipping_postal_code' => '11000', 'shipping_country' => 'CZ',
        ], $attributes));
        foreach ($items as $item) {
            [$product, $quantity] = $item;
            $variant = $item[2] ?? null;
            ShopOrderItem::create([
                'order_id' => $order->id, 'product_id' => $product->id, 'product_variant_id' => $variant?->id, 'product_name' => $product->name,
                'variant_name' => $variant?->variant_name, 'quantity' => $quantity, 'unit_price' => 121, 'total_price' => 121 * $quantity,
            ]);
        }

        return $order;
    }

    /**
     * @description Whether a shop_logs row with the given event type exists.
     * @param string $eventType Event type, e.g. 'create'.
     * @param string|null $descriptionContains Optional fragment of the description.
     * @return void
     */
    protected function assertShopLog(string $eventType, ?string $descriptionContains = null): void
    {
        $query = ShopLog::where('event_type', $eventType);
        if ($descriptionContains !== null) {
            $query->where('description', 'like', '%' . $descriptionContains . '%');
        }
        $this->assertTrue($query->exists(), "shop_logs entry '{$eventType}'" . ($descriptionContains ? " containing '{$descriptionContains}'" : '') . ' not found.');
    }
}
