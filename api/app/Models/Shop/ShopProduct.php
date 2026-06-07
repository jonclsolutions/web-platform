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
        'category_id',      // zachováno jako "primární kategorie" (mirror pivot)
        'supplier_id',
        'name',
        'slug',
        'description',
        'short_description',
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
    // RELACE
    // =========================================================

    /**
     * Primární kategorie (zpětná kompatibilita — přímý FK).
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ShopCategory::class, 'category_id');
    }

    /**
     * Všechny kategorie produktu přes pivot tabulku (M:N).
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
     * Primární kategorie přes pivot (is_primary = 1).
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
     * Ceny hlavního produktu (variant_id IS NULL).
     */
    public function prices(): HasOne
    {
        return $this->hasOne(ShopProductPrice::class, 'product_id')->whereNull('variant_id');
    }

    /**
     * Dodavatel.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(ShopSupplier::class, 'supplier_id');
    }

    /**
     * Obrázky produktu.
     */
    public function images(): HasMany
    {
        return $this->hasMany(ShopProductImage::class, 'product_id');
    }

    /**
     * Primární obrázek.
     */
    public function primaryImage(): HasOne
    {
        return $this->hasOne(ShopProductImage::class, 'product_id')
            ->where('is_primary', true)
            ->orderBy('sort_order');
    }

    /**
     * Varianty produktu.
     */
    public function variants(): HasMany
    {
        return $this->hasMany(ShopProductVariant::class, 'product_id');
    }

    /**
     * Recenze.
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(ShopReview::class, 'product_id');
    }

    /**
     * Položky objednávek.
     */
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

    /**
     * Scope: filtrování přes pivot tabulku (pro kategorii a všechny pod-kategorie).
     */
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
     * Synchronizuje pivot tabulku a zároveň udržuje category_id jako mirror primární kategorie.
     *
     * @param  array<int>  $categoryIds   Pole ID kategorií, které má produkt mít
     * @param  int         $primaryId     ID primární kategorie (musí být obsaženo v $categoryIds)
     */
    public function syncCategories(array $categoryIds, int $primaryId): void
    {
        // Sestavíme pivot data: každá kategorie dostane is_primary a sort_order
        $pivotData = [];
        foreach (array_values($categoryIds) as $idx => $catId) {
            $pivotData[$catId] = [
                'is_primary' => ($catId === $primaryId) ? 1 : 0,
                'sort_order' => $idx,
            ];
        }

        // Sync pivot (přidá nové, odebere chybějící, aktualizuje existující)
        $this->categories()->sync($pivotData);

        // Zrcadlení primární kategorie do přímého FK
        if ($this->category_id !== $primaryId) {
            $this->update(['category_id' => $primaryId]);
        }
    }
}