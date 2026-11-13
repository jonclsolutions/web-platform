<?php
/**
 * @file ShopPublicController.php
 * @path app/Apps/Shop/Http/Controllers/ShopPublicController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Provides public-facing API endpoints for shop storefront operations, including stock verification, payment/shipping configuration, and real-time coupon validation.
 */

namespace App\Apps\Shop\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\Shop\Models\ShopProduct;
use App\Apps\Shop\Models\ShopProductVariant;
use App\Apps\Shop\Models\ShopShippingMethod;
use App\Apps\Shop\Models\ShopPaymentMethod;
use App\Apps\Shop\Models\ShopCoupon;
use App\Apps\Shop\Models\ShopSiteSetting;
use App\Apps\Shop\Http\Resources\ShopShippingMethodResource;
use App\Apps\Shop\Http\Resources\ShopPaymentMethodResource;
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

        return $this->respond(ShopShippingMethodResource::collection($methods));
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

        return $this->respond(ShopPaymentMethodResource::collection($methods));
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
                $variant = ShopProductVariant::where('product_id', $product->id)->find($variantId);
                return $variant ? $variant->stock_quantity : 0;
            }

            return $product->stock_quantity;
        });

        return $this->respond([
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
            return response()->json(['message' => 'Coupon does not exist or is not active.'], 404);
        }

        $now = now();

        if ($coupon->valid_from && $now->lt($coupon->valid_from)) {
            return response()->json(['message' => 'Coupon is not valid yet.'], 422);
        }

        if ($coupon->valid_until && $now->gt($coupon->valid_until)) {
            return response()->json(['message' => 'Coupon has expired.'], 422);
        }

        if ($coupon->max_usage > 0 && $coupon->usage_count >= $coupon->max_usage) {
            return response()->json(['message' => 'Coupon usage limit has been reached.'], 422);
        }

        if ($coupon->min_order_amount > 0 && $validated['order_amount'] < (float)$coupon->min_order_amount) {
            return response()->json([
                'message' => "Minimum order amount is " . number_format($coupon->min_order_amount, 2) . " EUR."
            ], 422);
        }

        // Only what the checkout needs - not usage counters / limits / timestamps (finding #26).
        return $this->respond([
            'coupon' => $coupon->only(['code', 'discount_type', 'discount_value', 'min_order_amount', 'applies_to', 'valid_until']),
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

        return $this->respond([
            'is_shop_active' => (bool) ($settings->is_shop_active ?? true)
        ]);
    }
}