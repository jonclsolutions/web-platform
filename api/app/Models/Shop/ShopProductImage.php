<?php
/**
 * @file ShopProductImage.php
 * @path app/Models/Shop/ShopProductImage.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model for managing product and variant imagery.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @description Handles images linked to products or specific variants, including metadata and primary image flags.
 */
class ShopProductImage extends Model
{
    use SoftDeletes;

    /**
     * @var string The table associated with the model.
     */
    protected $table = 'shop_product_images';

    /**
     * @var bool Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'product_id',
        'variant_id',
        'image_path',
        'alt_text',
        'is_primary',
        'sort_order',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'is_primary' => 'boolean',
        'sort_order' => 'integer',
        'created_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Get the product associated with this image.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(ShopProduct::class, 'product_id');
    }

    /**
     * Get the variant associated with this image.
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ShopProductVariant::class, 'variant_id');
    }

    /**
     * Generates the public storage URL for the image.
     */
    public function getUrl(): string
    {
        return asset('storage/products/' . $this->image_path);
    }

    /**
     * Returns the full server path for file operations.
     */
    public function getFullPath(): string
    {
        return storage_path('app/public/products/' . $this->image_path);
    }

    /**
     * Scope for primary product images.
     */
    public function scopePrimary($query)
    {
        return $query->where('is_primary', true)->whereNull('variant_id');
    }

    /**
     * Scope for images attached to the product directly.
     */
    public function scopeProductImages($query)
    {
        return $query->whereNull('variant_id');
    }

    /**
     * Scope for images attached to a specific variant.
     */
    public function scopeVariantImages($query, $variantId)
    {
        return $query->where('variant_id', $variantId);
    }
}