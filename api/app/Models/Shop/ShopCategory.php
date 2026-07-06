<?php
/**
 * @file ShopCategory.php
 * @path app/Models/Shop/ShopCategory.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model representing product categories in the shop system.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @description Manages hierarchical product categories and their relationship to products.
 * 
 * @property int $id The unique identifier.
 * @property string $name The display name of the category.
 * @property string $slug The URL-friendly identifier.
 * @property bool $is_active Toggle for category visibility.
 */
class ShopCategory extends Model
{
    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'name',
        'slug',
        'description',
        'parent_id',
        'image_path',
        'is_active',
        'sort_order',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'parent_id' => 'integer',
    ];

    /**
     * Get the parent category.
     *
     * @return BelongsTo
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(ShopCategory::class, 'parent_id');
    }

    /**
     * Get the subcategories.
     *
     * @return HasMany
     */
    public function children(): HasMany
    {
        return $this->hasMany(ShopCategory::class, 'parent_id')->orderBy('sort_order', 'asc');
    }

    /**
     * Get the products associated with this category.
     *
     * @return BelongsToMany
     */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(
            ShopProduct::class,
            'shop_product_categories',
            'category_id',
            'product_id'
        )->withPivot(['is_primary', 'sort_order'])->withTimestamps();
    }
}