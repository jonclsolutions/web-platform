<?php

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class ShopProductVariant extends Model
{
    use SoftDeletes;

    protected $table = 'shop_product_variants';

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

    protected $casts = [
        'stock_quantity' => 'integer',
    ];

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
     * Ceny specifické pro tuto variantu (EUR)
     */
    public function prices(): HasOne
    {
        return $this->hasOne(ShopProductPrice::class, 'variant_id');
    }

    public static function forceSyncParentStock(int $productId): void
    {
        $totalStock = self::where('product_id', $productId)
            ->whereNull('deleted_at')
            ->sum('stock_quantity');

        DB::table('shop_products')
            ->where('id', $productId)
            ->update(['stock_quantity' => $totalStock]);
            
        \Illuminate\Support\Facades\Log::info("Manual stock sync performed", [
            'product_id' => $productId, 
            'total_stock' => $totalStock
        ]);
    }

    public function syncParentStock(): void
    {
        if ($this->product_id) {
            self::forceSyncParentStock($this->product_id);
        }
    }

    public function product(): BelongsTo 
    { 
        return $this->belongsTo(ShopProduct::class, 'product_id'); 
    }
    
    public function images(): HasMany 
    { 
        return $this->hasMany(ShopProductImage::class, 'variant_id'); 
    }
}