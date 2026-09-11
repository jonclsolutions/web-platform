<?php
/**
 * @file ShopCheckoutController.php
 * @path app/Http/Controllers/Api/Shop/ShopCheckoutController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the end-to-end checkout process, including order persistence, atomic inventory stock updates, coupon validation, and payment simulation.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction() - doménově beze změny (ShopLog::class). Zároveň
 * ODSTRANĚN ladicí `Log::info("Checkout createOrder started", ['payload' => $request->all()])`
 * na začátku createOrder() - jde o VEŘEJNÝ (bez auth) endpoint, takže tohle volání
 * zapisovalo do laravel.log kompletní nešifrovaný payload (jméno, e-mail, adresa,
 * telefon zákazníka) při KAŽDÉm checkoutu bez jakékoli ochrany/expirace typické pro
 * `shop_logs` audit trail - zbytečná duplicita osobních údajů mimo řízené úložiště.
 * Skutečná obchodní událost (vytvoření objednávky) se loguje standardně přes
 * logAction() níže.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopOrder;
use App\Models\Shop\ShopOrderItem;
use App\Models\Shop\ShopProduct;
use App\Models\Shop\ShopProductVariant;
use App\Models\Shop\ShopCustomer;
use App\Models\Shop\ShopCoupon;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopOrderResource;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

/**
 * @description Controller responsible for processing customer checkouts.
 * @note Uses database transactions and row-level locking to prevent race conditions during inventory decrementation.
 */
class ShopCheckoutController extends Controller
{
    use LogsActivity;

    /**
     * Orchestrates the order creation process, handling customer identification, price calculation, and inventory management.
     */
    public function createOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'phone' => 'required|string',
            'company' => 'nullable|string',
            'address' => 'required|string',
            'city' => 'required|string',
            'postal_code' => 'required|string',
            'country' => 'required|string',
            'payment_method_id' => 'required|integer|exists:shop_payment_methods,id',
            'shipping_method_id' => 'required|integer|exists:shop_shipping_methods,id',
            'coupon_code' => 'nullable|string',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:shop_products,id',
            'items.*.product_variant_id' => 'nullable|integer|exists:shop_product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.vat_rate' => 'nullable|integer|between:0,100'
        ]);

        try {
            DB::beginTransaction();

            $email = trim(strtolower($validated['email']));

            $customer = ShopCustomer::withTrashed()->where('email', $email)->first();

            if ($customer) {
                if ($customer->trashed()) {
                    $customer->restore();
                }

                $customer->update([
                    'first_name'   => $validated['first_name'],
                    'last_name'    => $validated['last_name'],
                    'phone'        => $validated['phone'],
                    'company'      => $validated['company'],
                    'address'      => $validated['address'],
                    'city'         => $validated['city'],
                    'postal_code'  => $validated['postal_code'],
                    'country'      => $validated['country'],
                ]);
            } else {
                try {
                    $customer = ShopCustomer::create([
                        'email'        => $email,
                        'first_name'   => $validated['first_name'],
                        'last_name'    => $validated['last_name'],
                        'phone'        => $validated['phone'],
                        'company'      => $validated['company'],
                        'address'      => $validated['address'],
                        'city'         => $validated['city'],
                        'postal_code'  => $validated['postal_code'],
                        'country'      => $validated['country'],
                        'is_active'    => true
                    ]);
                } catch (\Illuminate\Database\QueryException $e) {
                    if ($e->getCode() == 23000 || $e->errorInfo[1] == 1062 || str_contains($e->getMessage(), '1062')) {
                        $customer = ShopCustomer::withTrashed()->where('email', $email)->first();
                        if ($customer && $customer->trashed()) {
                            $customer->restore();
                        }
                    } else {
                        throw new \Exception("Error writing customer to DB: " . $e->getMessage());
                    }
                }
            }

            if (!$customer) {
                throw new \Exception("Critical error: Failed to initialize customer with email {$email}.");
            }

            $totalAmount = 0;
            foreach ($validated['items'] as $itemData) {
                $totalAmount += (float)$itemData['quantity'] * (float)$itemData['unit_price'];
            }

            $coupon = null;
            $discountAmount = 0;

            if (!empty($validated['coupon_code'])) {
                $coupon = ShopCoupon::where('code', $validated['coupon_code'])->first();

                if (!$coupon || !$coupon->is_active) {
                    DB::rollBack();
                    return response()->json(['message' => 'The coupon is invalid or inactive.'], 422);
                }

                $now = now();
                if ($coupon->valid_from && $now->lt($coupon->valid_from)) {
                    DB::rollBack();
                    return response()->json(['message' => 'The coupon is not valid yet.'], 422);
                }
                if ($coupon->valid_until && $now->gt($coupon->valid_until)) {
                    DB::rollBack();
                    return response()->json(['message' => 'The coupon has already expired.'], 422);
                }

                if ($coupon->max_usage > 0 && $coupon->usage_count >= $coupon->max_usage) {
                    DB::rollBack();
                    return response()->json(['message' => 'The coupon has been exhausted.'], 422);
                }

                if ($coupon->min_order_amount > 0 && $totalAmount < (float)$coupon->min_order_amount) {
                    DB::rollBack();
                    return response()->json([
                        'message' => "The minimum order amount is " . number_format($coupon->min_order_amount, 2) . " CZK."
                    ], 422);
                }

                $discountAmount = ($coupon->discount_type === 'percent')
                    ? ($totalAmount * (float)$coupon->discount_value) / 100
                    : (float)$coupon->discount_value;
            }

            $shippingAmount = 0;
            if (!empty($validated['shipping_method_id'])) {
                $shippingMethod = \App\Models\Shop\ShopShippingMethod::find($validated['shipping_method_id']);
                $shippingAmount = $shippingMethod ? (float)$shippingMethod->base_price : 0;
            }

            $finalAmount = max(0, $totalAmount + $shippingAmount - $discountAmount);

            $order = ShopOrder::create([
                'customer_id' => $customer->id,
                'order_number' => ShopOrder::generateOrderNumber(),
                'status' => 'pending',
                'payment_status' => 'pending',
                'total_amount' => $totalAmount,
                'shipping_amount' => $shippingAmount,
                'tax_amount' => 0,
                'discount_amount' => $discountAmount,
                'final_amount' => $finalAmount,
                'coupon_id' => $coupon?->id,
                'payment_method_id' => $validated['payment_method_id'],
                'shipping_method_id' => $validated['shipping_method_id'],
                'shipping_address' => $validated['address'],
                'shipping_city' => $validated['city'],
                'shipping_postal_code' => $validated['postal_code'],
                'shipping_country' => $validated['country'],
                'notes' => $validated['notes'] ?? null,
            ]);

            $discountFactor = $totalAmount > 0 ? ($totalAmount - $discountAmount) / $totalAmount : 1;
            $totalTax = 0;

            foreach ($validated['items'] as $itemData) {
                $quantity = (int)$itemData['quantity'];
                $product = ShopProduct::findOrFail($itemData['product_id']);

                $variantName = null;
                $vatRate = $itemData['vat_rate'] ?? $product->vat_rate ?? 21;

                if (!empty($itemData['product_variant_id'])) {
                    $variant = ShopProductVariant::lockForUpdate()->findOrFail($itemData['product_variant_id']);

                    if ($variant->stock_quantity < $quantity) {
                        DB::rollBack();
                        return response()->json([
                            'message' => "The product '{$product->name} ({$variant->variant_name})' was sold out in the meantime. Available quantity: {$variant->stock_quantity} pcs."
                        ], 422);
                    }

                    $variant->decrement('stock_quantity', $quantity);
                    $variantName = $variant->variant_name;
                    if (isset($variant->vat_rate)) {
                        $vatRate = $variant->vat_rate;
                    }
                    ShopProductVariant::forceSyncParentStock($product->id);

                    Cache::forget("product_stock_{$product->id}_v{$variant->id}");
                } else {
                    $product->lockForUpdate();

                    if ($product->stock_quantity < $quantity) {
                        DB::rollBack();
                        return response()->json([
                            'message' => "The product '{$product->name}' was sold out in the meantime. Available quantity: {$product->stock_quantity} pcs."
                        ], 422);
                    }

                    $product->decrement('stock_quantity', $quantity);
                }

                Cache::forget("product_stock_{$product->id}");

                $linePrice = $quantity * (float)$itemData['unit_price'];
                $linePriceAfterDiscount = $linePrice * $discountFactor;
                $itemTax = $linePriceAfterDiscount * ($vatRate / (100 + $vatRate));
                $totalTax += $itemTax;

                ShopOrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'product_variant_id' => $itemData['product_variant_id'] ?? null,
                    'product_name' => $product->name,
                    'variant_name' => $variantName,
                    'quantity' => $quantity,
                    'unit_price' => $itemData['unit_price'],
                    'total_price' => $linePrice,
                    'vat_rate' => $vatRate,
                ]);
            }

            $order->update(['tax_amount' => $totalTax]);

            if ($coupon) {
                $coupon->increment('usage_count');
            }

            DB::commit();

            if ($customer) {
                $customer->recalculateTotalSpent();
            }

            $order->load(['customer', 'paymentMethod', 'shippingMethod', 'coupon', 'items']);

            $this->logAction($request, ShopLog::class, 'create', 'ShopOrder (Checkout)', "Created order: {$order->order_number}", $order->id, 'ShopOrder');

            return response()->json(new ShopOrderResource($order), 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Checkout createOrder error: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder (Checkout)', "Error creating order: " . $e->getMessage());
            return response()->json(['message' => 'Error creating order: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Provides a secure stock check mechanism for public UI, utilizing cache to mitigate scraping risk.
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
     * Validates a coupon code against business rules (expiration, usage limits, minimum order amounts).
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
            return response()->json(['message' => 'The coupon does not exist or is not active.'], 404);
        }

        $now = now();

        if ($coupon->valid_from && $now->lt($coupon->valid_from)) {
            return response()->json(['message' => 'The coupon is not valid yet.'], 422);
        }

        if ($coupon->valid_until && $now->gt($coupon->valid_until)) {
            return response()->json(['message' => 'The coupon has expired.'], 422);
        }

        if ($coupon->max_usage > 0 && $coupon->usage_count >= $coupon->max_usage) {
            return response()->json(['message' => 'The coupon has been exhausted.'], 422);
        }

        if ($coupon->min_order_amount > 0 && $validated['order_amount'] < (float)$coupon->min_order_amount) {
            return response()->json([
                'message' => "The minimum order amount is " . number_format($coupon->min_order_amount, 2) . " CZK."
            ], 422);
        }

        return response()->json([
            'coupon' => $coupon,
            'is_valid' => true
        ]);
    }

    /**
     * Simulates a payment gateway response for testing purposes.
     */
    public function simulatePayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => 'required|integer|exists:shop_orders,id'
        ]);

        try {
            $order = ShopOrder::findOrFail($validated['order_id']);
            $success = rand(1, 100) <= 90;

            if ($success) {
                $order->update([
                    'payment_status' => 'paid',
                    'status' => 'confirmed',
                    'paid_at' => now()
                ]);

                $this->logAction($request, ShopLog::class, 'payment', 'ShopOrder (Checkout)', "Payment simulated: {$order->order_number}", $order->id, 'ShopOrder');

                return response()->json([
                    'success' => true,
                    'message' => 'Payment was successfully processed',
                    'order' => new ShopOrderResource($order)
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Payment was declined (simulation)'
                ], 402);
            }
        } catch (\Exception $e) {
            Log::error("Payment simulation error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder (Checkout)', "Error during payment simulation: " . $e->getMessage());
            return response()->json(['message' => 'Error during payment simulation'], 500);
        }
    }
}