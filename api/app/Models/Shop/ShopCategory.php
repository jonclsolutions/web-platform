<?php

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ShopCategory extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'parent_id',
        'image_path',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'parent_id' => 'integer',
    ];

    /**
     * Relace na nadřazenou kategorii.
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(ShopCategory::class, 'parent_id');
    }

    /**
     * Relace na podkategorie.
     */
    public function children(): HasMany
    {
        return $this->hasMany(ShopCategory::class, 'parent_id')->orderBy('sort_order', 'asc');
    }

    /**
     * ✅ OPRAVENO: Relace na produkty v této kategorii přes pivot tabulku (M:N).
     * Zajišťuje správný počet produktů (products_count) pro hlavní i sekundární kategorie.
     */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(
            ShopProduct::class,
            'shop_product_categories', // tvá pivotní tabulka
            'category_id',
            'product_id'
        )->withPivot(['is_primary', 'sort_order'])->withTimestamps();
    }
}