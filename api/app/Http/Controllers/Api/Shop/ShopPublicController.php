<?php
/**
 * @file ShopPublicController.php
 * @path app/Http/Controllers/Api/Shop/ShopPublicController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Provides public-facing API endpoints for shop storefront operations, including stock verification, payment/shipping configuration, and real-time coupon validation.
 *
 * @refactor-note (2026-08-15) `getStatus()` repointed from `App\Models\Core\CoreSiteSetting`
 * to `App\Models\Shop\ShopSiteSetting` following the move of shop maintenance data out of
 * the Core domain - see ShopSiteSettingController for the accompanying admin endpoint.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopProduct;
use App\Models\Shop\ShopProductVariant;
use App\Models\Shop\ShopShippingMethod;
use App\Models\Shop\ShopPaymentMethod;
use App\Models\Shop\ShopCoupon;
use App\Models\Shop\ShopSiteSetting;
use App\Http\Resources\Shop\ShopShippingMethodResource;
use App\Http\Resources\Shop\ShopPaymentMethodResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * @description Handles public shop storefront requests.
 * @note Implements caching mechanisms to optimize high-traffic queries like stock availability.
 */
class ShopPublicController extends Controller
{
    /**
     * Retrieves all active shipping methods for public selection.
     *
     * @param Request $request Incoming request.
     * @return JsonResponse Collection of active shipping methods.
     */
    public function getShippingMethods(Request $request): JsonResponse
    {
        $methods = ShopShippingMethod::where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->get();

        return response()->json(ShopShippingMethodResource::collection($methods));
    }

    /**
     * Retrieves all active payment methods for public checkout.
     *
     * @param Request $request Incoming request.
     * @return JsonResponse Collection of active payment methods.
     */
    public function getPaymentMethods(Request $request): JsonResponse
    {
        $methods = ShopPaymentMethod::where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->get();

        return response()->json(ShopPaymentMethodResource::collection($methods));
    }

    /**
     * Verifies product or variant stock availability against a requested quantity.
     * * Uses a cache layer to minimize database load for frequent storefront inventory checks.
     *
     * @param Request $request Request containing optional variant_id and quantity.
     * @param int $id The product ID.
     * @return JsonResponse JSON object containing availability boolean.
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
     * Validates a coupon code against current business rules (active status, validity dates, usage limits, and minimum order amount).
     *
     * @param Request $request Request containing code and order_amount.
     * @return JsonResponse Status and coupon data if valid, error message if invalid.
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

    /**
     * Checks global shop activity status from shop-owned site settings.
     *
     * @return JsonResponse Shop active status boolean.
     */
    public function getStatus(): JsonResponse
    {
        $settings = ShopSiteSetting::first();

        return response()->json([
            'is_shop_active' => (bool) ($settings->is_shop_active ?? true)
        ]);
    }
}