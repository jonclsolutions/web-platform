<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopProduct;
use App\Models\Shop\ShopProductVariant;
use App\Models\Shop\ShopShippingMethod;
use App\Models\Shop\ShopPaymentMethod;
use App\Models\Shop\ShopCoupon;
use App\Http\Resources\Shop\ShopShippingMethodResource;
use App\Http\Resources\Shop\ShopPaymentMethodResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class ShopPublicController extends Controller
{
    /**
     * ZÍSKÁNÍ VEŘEJNÝCH DOPRAVNÍCH METOD
     */
    public function getShippingMethods(Request $request): JsonResponse
    {
        $methods = ShopShippingMethod::where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->get();

        return response()->json(ShopShippingMethodResource::collection($methods));
    }

    /**
     * ZÍSKÁNÍ VEŘEJNÝCH PLATEBNÍCH METOD (Filtrované a seřazené)
     */
    public function getPaymentMethods(Request $request): JsonResponse
    {
        $methods = ShopPaymentMethod::where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->get();

        // Obalíme data resource třídou, která zajistí správné URL pro frontend
        return response()->json(ShopPaymentMethodResource::collection($methods));
    }

    /**
     * RYCHLÉ OVĚŘENÍ DOSTUPNOSTI MNOŽSTVÍ NA SKLADĚ (S CACHE)
     */
    public function checkStock(Request $request, $id): JsonResponse
    {
        $variantId = $request->query('variant_id');
        $requestedQuantity = (int)$request->query('quantity');

        $cacheKey = "product_stock_{$id}" . ($variantId ? "_v{$variantId}" : "");

        $stockQuantity = Cache::remember($cacheKey, now()->addMinutes(2), function () use ($id, $variantId) {
            $product = ShopProduct::find($id);
            if (!$product) return 0;
            
            if ($variantId) {
                $foreignKey = 'product_id';
                $variantModel = new ShopProductVariant();
                
                if (method_exists($variantModel, 'product')) {
                    $foreignKey = $variantModel->product()->getForeignKeyName();
                } elseif (method_exists($variantModel, 'shopProduct')) {
                    $foreignKey = $variantModel->shopProduct()->getForeignKeyName();
                }

                try {
                    $variant = ShopProductVariant::where($foreignKey, $id)->find($variantId);
                    return $variant ? $variant->stock_quantity : 0;
                } catch (\Illuminate\Database\QueryException $e) {
                    $fallbackKey = ($foreignKey === 'product_id') ? 'shop_product_id' : 'product_id';
                    try {
                        $variant = ShopProductVariant::where($fallbackKey, $id)->find($variantId);
                        return $variant ? $variant->stock_quantity : 0;
                    } catch (\Exception $ex) {
                        $variant = ShopProductVariant::find($variantId);
                        if ($variant) {
                            $pId = $variant->product_id ?? $variant->shop_product_id ?? null;
                            if ($pId == $id) {
                                return $variant->stock_quantity;
                            }
                        }
                        return 0;
                    }
                }
            }
            
            return $product->stock_quantity;
        });

        return response()->json([
            'available' => $requestedQuantity <= $stockQuantity
        ]);
    }

    /**
     * VEŘEJNÉ OVĚŘENÍ KUPÓNU V KOŠÍKU
     */
    public function validateCoupon(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string',
            'order_amount' => 'required|numeric|min:0'
        ]);

        $coupon = ShopCoupon::where('code', $validated['code'])
            ->where('is_active', true)
            ->first();

        if (!$coupon) {
            return response()->json(['message' => 'Kupón neexistuje nebo není aktivní.'], 404);
        }

        $now = now();

        if ($coupon->valid_from && $now->lt($coupon->valid_from)) {
            return response()->json(['message' => 'Kupón zatím není platný.'], 422);
        }

        if ($coupon->valid_until && $now->gt($coupon->valid_until)) {
            return response()->json(['message' => 'Kupón vypršel.'], 422);
        }

        if ($coupon->max_usage > 0 && $coupon->usage_count >= $coupon->max_usage) {
            return response()->json(['message' => 'Kupón byl vyčerpán.'], 422);
        }

        if ($coupon->min_order_amount > 0 && $validated['order_amount'] < (float)$coupon->min_order_amount) {
            return response()->json([
                'message' => "Minimální objednávka je " . number_format($coupon->min_order_amount, 2) . "EUR."
            ], 422);
        }

        return response()->json([
            'coupon' => $coupon,
            'is_valid' => true
        ]);
    }

    public function getStatus()
{
    // Načte nastavení z DB (nebo cache)
    $settings = \App\Models\Core\CoreSiteSetting::first();
    
    return response()->json([
        'is_shop_active' => (bool) ($settings->is_shop_active ?? true)
    ]);
}
}