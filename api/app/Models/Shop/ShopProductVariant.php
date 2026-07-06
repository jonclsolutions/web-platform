<?php
/**
 * @file ShopProductVariant.php
 * @path app/Models/Shop/ShopProductVariant.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model representing a specific product variant (e.g., color, size).
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * @description Manages stock, pricing, and imagery for individual product variations, including automated parent stock synchronization.
 * * @property int $id Unique identifier.
 * @property int $product_id Parent product association.
 * @property string $sku_variant Unique SKU for this specific variant.
 * @property int $stock_quantity Inventory level for this variant.
 */
class ShopProductVariant extends Model
{
    use SoftDeletes;

    /**
     * @var string The table associated with the model.
     */
    protected $table = 'shop_product_variants';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'product_id', 
        'variant_name', 
        'attribute_1_name', 
        'attribute_1_value',
        'attribute_2_name', 
        'attribute_2_value', 
        'sku_variant',
        'stock_quantity',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'stock_quantity' => 'integer',
    ];

    /**
     * Register model events for automated stock sync and cleanup.
     */
    protected static function booted()
    {
        static::saved(function ($variant) {
            $variant->syncParentStock();
        });

        static::deleted(function ($variant) {
            $variant->syncParentStock();
        });

        static::deleting(function ($variant) {
            foreach ($variant->images as $image) {
                if (Storage::disk('public')->exists('products/' . $image->image_path)) {
                    Storage::disk('public')->delete('products/' . $image->image_path);
                }
                $image->delete();
            }
        });
    }

    /**
     * Get pricing specific to this variant.
     */
    public function prices(): HasOne
    {
        return $this->hasOne(ShopProductPrice::class, 'variant_id');
    }

    /**
     * Performs a manual sync of total stock quantity for a parent product based on all active variants.
     * * @param int $productId
     * @return void
     */
    public static function forceSyncParentStock(int $productId): void
    {
        $totalStock = self::where('product_id', $productId)
            ->whereNull('deleted_at')
            ->sum('stock_quantity');

        DB::table('shop_products')
            ->where('id', $productId)
            ->update(['stock_quantity' => $totalStock]);
            
        Log::info("Manual stock sync performed", [
            'product_id' => $productId, 
            'total_stock' => $totalStock
        ]);
    }

    /**
     * Syncs stock for the associated parent product.
     */
    public function syncParentStock(): void
    {
        if ($this->product_id) {
            self::forceSyncParentStock($this->product_id);
        }
    }

    /**
     * Get parent product.
     */
    public function product(): BelongsTo 
    { 
        return $this->belongsTo(ShopProduct::class, 'product_id'); 
    }
    
    /**
     * Get images specific to this variant.
     */
    public function images(): HasMany 
    { 
        return $this->hasMany(ShopProductImage::class, 'variant_id'); 
    }
}