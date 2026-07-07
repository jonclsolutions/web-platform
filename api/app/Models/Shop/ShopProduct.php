<?php
/**
 * @file ShopProduct.php
 * @path app/Models/Shop/ShopProduct.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model representing a product within the shop catalog.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @description Manages product information, inventory status, and associations with categories, variants, and suppliers.
 * * @property int $id Unique identifier.
 * @property int|null $category_id Foreign key to the primary category.
 * @property string $name Product display name.
 * @property bool $is_active Visibility status.
 * @property int $stock_quantity Current inventory level.
 */
class ShopProduct extends Model
{
    use SoftDeletes;

    /**
     * @var string The table associated with the model.
     */
    protected $table = 'shop_products';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'category_id',
        'supplier_id',
        'name',
        'name_en',
        'slug',
        'description',
        'description_en',
        'short_description',
        'short_description_en',
        'sku',
        'stock_quantity',
        'stock_warning_level',
        'is_active',
        'is_featured',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'is_active'           => 'boolean',
        'is_featured'         => 'boolean',
        'stock_quantity'      => 'integer',
        'stock_warning_level' => 'integer',
        'created_at'          => 'datetime',
        'updated_at'          => 'datetime',
        'deleted_at'          => 'datetime',
    ];

    /**
     * Boot the model and register model events.
     * Ensure products are inactive if no primary category is assigned.
     */
    protected static function booted(): void
    {
        static::saving(function (ShopProduct $product) {
            if (empty($product->category_id)) {
                $product->is_active = false;
            }
        });
    }

    /**
     * Get the primary category.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ShopCategory::class, 'category_id');
    }

    /**
     * Get all categories assigned to the product.
     */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(
            ShopCategory::class,
            'shop_product_categories',
            'product_id',
            'category_id'
        )
        ->withPivot(['is_primary', 'sort_order'])
        ->withTimestamps()
        ->orderByPivot('sort_order', 'asc');
    }

    /**
     * Get the primary category relationship.
     */
    public function primaryCategory(): BelongsToMany
    {
        return $this->belongsToMany(
            ShopCategory::class,
            'shop_product_categories',
            'product_id',
            'category_id'
        )
        ->withPivot(['is_primary', 'sort_order'])
        ->wherePivot('is_primary', 1);
    }

    /**
     * Get the base product price.
     */
    public function prices(): HasOne
    {
        return $this->hasOne(ShopProductPrice::class, 'product_id')->whereNull('variant_id');
    }

    /**
     * Get the product supplier.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(ShopSupplier::class, 'supplier_id');
    }

    /**
     * Get all product images.
     */
    public function images(): HasMany
    {
        return $this->hasMany(ShopProductImage::class, 'product_id');
    }

    /**
     * Get the primary product image.
     */
    public function primaryImage(): HasOne
    {
        return $this->hasOne(ShopProductImage::class, 'product_id')
            ->where('is_primary', true)
            ->orderBy('sort_order');
    }

    /**
     * Get the product variants.
     */
    public function variants(): HasMany
    {
        return $this->hasMany(ShopProductVariant::class, 'product_id');
    }

    /**
     * Get the product reviews.
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(ShopReview::class, 'product_id');
    }

    /**
     * Get historical order items.
     */
    public function orderItems(): HasMany
    {
        return $this->hasMany(ShopOrderItem::class, 'product_id');
    }

    /**
     * Scope query to active products.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope query to featured products.
     */
    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    /**
     * Scope query to products with low stock.
     */
    public function scopeLowStock($query)
    {
        return $query->whereRaw('stock_quantity <= stock_warning_level');
    }

    /**
     * Scope query to products in a specific category.
     * * @param int $categoryId
     */
    public function scopeInCategory($query, int $categoryId)
    {
        return $query->whereHas('categories', function ($q) use ($categoryId) {
            $q->where('shop_categories.id', $categoryId);
        });
    }

    /**
     * Returns the URL of the primary product image.
     */
    public function getPrimaryImageUrl(): ?string
    {
        return $this->primaryImage?->getUrl() ?? null;
    }

    /**
     * Returns all images ordered by sort_order.
     */
    public function getOrderedImages()
    {
        return $this->images()->orderBy('sort_order')->get();
    }

    /**
     * Synchronizes the product categories and updates the primary category mirror.
     * * @param array $categoryIds
     * @param int|null $primaryId
     * @return void
     */
    public function syncCategories(array $categoryIds, ?int $primaryId): void
    {
        if (empty($categoryIds)) {
            $this->categories()->detach();
            $this->updateQuietly([
                'category_id' => null,
                'is_active'   => false,
            ]);
            return;
        }

        $pivotData = [];
        foreach (array_values($categoryIds) as $idx => $catId) {
            $pivotData[$catId] = [
                'is_primary' => ($catId === $primaryId) ? 1 : 0,
                'sort_order' => $idx,
            ];
        }

        $this->categories()->sync($pivotData);

        $newPrimary = $primaryId ?? $categoryIds[0];
        if ($this->category_id !== $newPrimary) {
            $this->updateQuietly(['category_id' => $newPrimary]);
        }
    }
}