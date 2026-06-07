<?php

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ShopProduct extends Model
{
    use SoftDeletes;

    protected $table = 'shop_products';

    protected $fillable = [
        'category_id',            // nullable — produkt může existovat bez kategorie
        'supplier_id',
        'name',
        'name_en',                // anglický název
        'slug',
        'description',
        'description_en',         // anglický popis
        'short_description',
        'short_description_en',   // anglický krátký popis
        'sku',
        'stock_quantity',
        'stock_warning_level',
        'is_active',
        'is_featured',
    ];

    protected $casts = [
        'is_active'           => 'boolean',
        'is_featured'         => 'boolean',
        'stock_quantity'      => 'integer',
        'stock_warning_level' => 'integer',
        'created_at'          => 'datetime',
        'updated_at'          => 'datetime',
        'deleted_at'          => 'datetime',
    ];

    // =========================================================
    // BOOT — automatická deaktivace produktu bez kategorie
    // =========================================================

    protected static function booted(): void
    {
        static::saving(function (ShopProduct $product) {
            if (empty($product->category_id)) {
                $product->is_active = false;
            }
        });
    }

    // =========================================================
    // RELACE
    // =========================================================

    public function category(): BelongsTo
    {
        return $this->belongsTo(ShopCategory::class, 'category_id');
    }

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

    public function prices(): HasOne
    {
        return $this->hasOne(ShopProductPrice::class, 'product_id')->whereNull('variant_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(ShopSupplier::class, 'supplier_id');
    }

    public function images(): HasMany
    {
        return $this->hasMany(ShopProductImage::class, 'product_id');
    }

    public function primaryImage(): HasOne
    {
        return $this->hasOne(ShopProductImage::class, 'product_id')
            ->where('is_primary', true)
            ->orderBy('sort_order');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ShopProductVariant::class, 'product_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ShopReview::class, 'product_id');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(ShopOrderItem::class, 'product_id');
    }

    // =========================================================
    // SCOPES
    // =========================================================

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    public function scopeLowStock($query)
    {
        return $query->whereRaw('stock_quantity <= stock_warning_level');
    }

    public function scopeInCategory($query, int $categoryId)
    {
        return $query->whereHas('categories', function ($q) use ($categoryId) {
            $q->where('shop_categories.id', $categoryId);
        });
    }

    // =========================================================
    // HELPERS
    // =========================================================

    public function getPrimaryImageUrl(): ?string
    {
        return $this->primaryImage?->getUrl() ?? null;
    }

    public function getOrderedImages()
    {
        return $this->images()->orderBy('sort_order')->get();
    }

    /**
     * Synchronizuje pivot tabulku a udržuje category_id jako mirror primární kategorie.
     * Pokud je $categoryIds prázdné, produkt se automaticky deaktivuje.
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