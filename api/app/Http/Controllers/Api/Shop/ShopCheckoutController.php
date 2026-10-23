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
 *
 * @bugfix-note (2026-10-23) SECURITY - prices came from the customer: `createOrder()`
 * calculated the order (items, total, tax, coupon minimum) from the `unit_price` /
 * `vat_rate` the browser sent, so anyone could order any product for 0.01 EUR with a
 * crafted request. The price and VAT rate are now always read from the catalogue
 * (`shop_product_prices` of the variant, else of the product); the client values are
 * accepted for backward compatibility but ignored. Also fixed in the same method:
 * - inactive / trashed products could be ordered (`exists` accepts them) → 422;
 * - a variant of a different product could be combined with any product id → 422;
 * - `$product->lockForUpdate()` on a model instance locks nothing (it only builds a new
 *   query) → the product row is now loaded with `lockForUpdate()`, so two parallel
 *   checkouts can no longer both take the last piece;
 * - the 500 answer contained the exception text (SQL details) → generic message, the
 *   detail stays in the audit log;
 * - the coupon minimum was reported in CZK although all prices are EUR;
 * - no length limits on the customer / address fields → a long value passed validation and
 *   failed in MySQL strict mode ("Data too long") with 500; now limited to the column sizes.
 *
 * @refactor-note (2026-10-23) Removed `checkStock()` and `validateCoupon()`: the public
 * routes point to the identical methods of ShopPublicController, these copies were
 * unreachable. Removed the unreachable non-duplicate branch of the customer insert
 * race handling (a failed insert now always re-reads the customer; if it still does
 * not exist the checkout fails with the generic error as before).
 *
 * @bugfix-note (2026-10-23) Open findings #21 / #23:
 * - the VAT rate of every line is stored on the order item (was dropped → 21 % everywhere);
 * - an anonymous checkout with the e-mail of an existing customer overwrote that customer's
 *   stored name / phone / address and restored a trashed (possibly erased) customer. Now the
 *   order is only linked to the existing record (only EMPTY master fields are filled in, a
 *   trashed customer stays trashed) and the order keeps the contact given at checkout in
 *   its own snapshot columns (`customer_*`).
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
use App\Models\Shop\ShopShippingMethod;
use App\Http\Resources\Shop\ShopOrderResource;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Lottery;

/**
 * @description Controller responsible for processing customer checkouts.
 * @note Uses database transactions and row-level locking to prevent race conditions during inventory decrementation.
 */
class ShopCheckoutController extends Controller
{
    use LogsActivity;

    /**
     * @description Orchestrates the order creation process: customer identification,
     *   catalogue prices, coupon, stock decrement under row locks, tax calculation.
     * @param Request $request Checkout form (customer, address, methods, coupon_code, items).
     * @return JsonResponse 201 order | 422 validation / coupon / availability | 500 error.
     */
    public function createOrder(Request $request): JsonResponse
    {
        // Lengths = column sizes of shop_customers / shop_orders (see header bugfix-note).
        $validated = $request->validate([
            'email' => 'required|email|max:150',
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'phone' => 'required|string|max:20',
            'company' => 'nullable|string|max:150',
            'address' => 'required|string|max:255',
            'city' => 'required|string|max:100',
            'postal_code' => 'required|string|max:10',
            'country' => 'required|string|max:50',
            'payment_method_id' => 'required|integer|exists:shop_payment_methods,id',
            'shipping_method_id' => 'required|integer|exists:shop_shipping_methods,id',
            'coupon_code' => 'nullable|string',
            'notes' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1|max:100',
            'items.*.product_id' => 'required|integer|exists:shop_products,id',
            'items.*.product_variant_id' => 'nullable|integer|exists:shop_product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            // Sent by the storefront, never trusted - see bugfix-note (2026-10-23).
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.vat_rate' => 'nullable|integer|between:0,100'
        ]);

        try {
            DB::beginTransaction();

            $customer = $this->resolveCustomer($validated);

            // Lock and price every line from the catalogue BEFORE anything else is written.
            $lines = [];
            $totalAmount = 0;
            foreach ($validated['items'] as $itemData) {
                $line = $this->lockAndPriceLine($itemData);
                if (is_string($line)) {
                    DB::rollBack();
                    return response()->json(['message' => $line], 422);
                }
                $lines[] = $line;
                $totalAmount += $line['line_price'];
            }

            $coupon = null;
            $discountAmount = 0;

            if (!empty($validated['coupon_code'])) {
                $coupon = ShopCoupon::where('code', $validated['coupon_code'])->first();
                $couponError = $this->couponError($coupon, $totalAmount);
                if ($couponError !== null) {
                    DB::rollBack();
                    return response()->json(['message' => $couponError], 422);
                }

                $discountAmount = ($coupon->discount_type === 'percent')
                    ? ($totalAmount * (float)$coupon->discount_value) / 100
                    : (float)$coupon->discount_value;
            }

            $shippingAmount = (float) ShopShippingMethod::whereKey($validated['shipping_method_id'])->value('base_price');
            $finalAmount = max(0, $totalAmount + $shippingAmount - $discountAmount);

            $order = ShopOrder::create(ShopOrder::contactSnapshot($validated) + [
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

            foreach ($lines as $line) {
                /** @var ShopProduct $product */
                $product = $line['product'];
                /** @var ShopProductVariant|null $variant */
                $variant = $line['variant'];

                if ($variant) {
                    $variant->decrement('stock_quantity', $line['quantity']);
                    ShopProductVariant::forceSyncParentStock($product->id);
                    Cache::forget("product_stock_{$product->id}_v{$variant->id}");
                } else {
                    $product->decrement('stock_quantity', $line['quantity']);
                }
                Cache::forget("product_stock_{$product->id}");

                $vatRate = $line['vat_rate'];
                $totalTax += $line['line_price'] * $discountFactor * ($vatRate / (100 + $vatRate));

                ShopOrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'product_name' => $product->name,
                    'variant_name' => $variant?->variant_name,
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'total_price' => $line['line_price'],
                    'vat_rate' => $vatRate,
                ]);
            }

            $order->update(['tax_amount' => $totalTax]);

            if ($coupon) {
                $coupon->increment('usage_count');
            }

            DB::commit();

            $customer->recalculateTotalSpent();

            $order->load(['customer', 'paymentMethod', 'shippingMethod', 'coupon', 'items']);

            $this->logAction($request, ShopLog::class, 'create', 'ShopOrder (Checkout)', "Created order: {$order->order_number}", $order->id, 'ShopOrder');

            return response()->json(new ShopOrderResource($order), 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Checkout createOrder error: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder (Checkout)', "Error creating order: " . $e->getMessage());
            return response()->json(['message' => 'Error creating order.'], 500);
        }
    }

    /**
     * @description Finds the customer by e-mail or creates it. An existing customer's master
     *   data are not overwritten (only empty fields are filled in) and a trashed customer is
     *   not restored - the order carries its own contact snapshot (finding #23). A parallel
     *   insert of the same e-mail is answered by re-reading the row.
     * @param array $validated Validated checkout data.
     * @return ShopCustomer
     * @throws \Exception When the customer can neither be found nor created.
     */
    private function resolveCustomer(array $validated): ShopCustomer
    {
        $email = trim(strtolower($validated['email']));
        $data = [
            'first_name'  => $validated['first_name'],
            'last_name'   => $validated['last_name'],
            'phone'       => $validated['phone'],
            'company'     => $validated['company'] ?? null,
            'address'     => $validated['address'],
            'city'        => $validated['city'],
            'postal_code' => $validated['postal_code'],
            'country'     => $validated['country'],
        ];

        $customer = ShopCustomer::withTrashed()->where('email', $email)->first();

        if (!$customer) {
            try {
                return ShopCustomer::create($data + ['email' => $email, 'is_active' => true]);
            } catch (\Illuminate\Database\QueryException $e) {
                // Parallel checkout with the same e-mail inserted it first - use that row.
                $customer = ShopCustomer::withTrashed()->where('email', $email)->first();
                if (!$customer) {
                    throw new \Exception("Failed to initialize customer with email {$email}: " . $e->getMessage());
                }
            }
        }

        if (!$customer->trashed()) {
            $missing = array_filter($data, fn ($value, $field) => $value !== null && $value !== ''
                && ($customer->{$field} === null || $customer->{$field} === ''), ARRAY_FILTER_USE_BOTH);
            if ($missing) {
                $customer->update($missing);
            }
        }

        return $customer;
    }

    /**
     * @description Loads the product (and variant) of one cart line with a row lock and
     *   prices it from the catalogue.
     * @param array $itemData Validated cart line {product_id, product_variant_id?, quantity}.
     * @return array|string Line {product, variant, quantity, unit_price, line_price, vat_rate}
     *   or the customer-facing reason why the line cannot be ordered.
     */
    private function lockAndPriceLine(array $itemData): array|string
    {
        $quantity = (int) $itemData['quantity'];
        $product = ShopProduct::active()->with('prices')->lockForUpdate()->find($itemData['product_id']);

        if (!$product) {
            return 'One of the products is no longer available.';
        }

        $variant = null;
        $price = $product->prices;

        if (!empty($itemData['product_variant_id'])) {
            $variant = ShopProductVariant::with('prices')->lockForUpdate()
                ->where('product_id', $product->id)
                ->find($itemData['product_variant_id']);

            if (!$variant) {
                return "The selected variant of '{$product->name}' is not available.";
            }
            if ($variant->stock_quantity < $quantity) {
                return "The product '{$product->name} ({$variant->variant_name})' was sold out in the meantime. Available quantity: {$variant->stock_quantity} pcs.";
            }
            $price = $variant->prices ?? $price;
        } elseif ($product->stock_quantity < $quantity) {
            return "The product '{$product->name}' was sold out in the meantime. Available quantity: {$product->stock_quantity} pcs.";
        }

        if (!$price || $price->price_eur_with_vat === null) {
            return "The product '{$product->name}' has no price and cannot be ordered.";
        }

        $unitPrice = (float) $price->price_eur_with_vat;

        return [
            'product'    => $product,
            'variant'    => $variant,
            'quantity'   => $quantity,
            'unit_price' => $unitPrice,
            'line_price' => $quantity * $unitPrice,
            'vat_rate'   => (float) $price->vat_rate,
        ];
    }

    /**
     * @description Checks a coupon against the checkout rules.
     * @param ShopCoupon|null $coupon Coupon found by code.
     * @param float $totalAmount Order total before discount (EUR).
     * @return string|null Customer-facing reason, or null when the coupon applies.
     */
    private function couponError(?ShopCoupon $coupon, float $totalAmount): ?string
    {
        if (!$coupon || !$coupon->is_active) {
            return 'The coupon is invalid or inactive.';
        }
        if ($coupon->valid_from && now()->lt($coupon->valid_from)) {
            return 'The coupon is not valid yet.';
        }
        if ($coupon->valid_until && now()->gt($coupon->valid_until)) {
            return 'The coupon has already expired.';
        }
        if ($coupon->max_usage > 0 && $coupon->usage_count >= $coupon->max_usage) {
            return 'The coupon has been exhausted.';
        }
        if ($coupon->min_order_amount > 0 && $totalAmount < (float)$coupon->min_order_amount) {
            return 'The minimum order amount is ' . number_format($coupon->min_order_amount, 2) . ' EUR.';
        }

        return null;
    }

    /**
     * @description Simulates a payment gateway response (90 % success) - dev / test
     *   systems only, see config `services.shop.payment_simulation`.
     * @bugfix-note (2026-10-23) SECURITY - this public endpoint marked ANY order as paid
     *   (also already paid, cancelled or foreign ones). Now: 404 when the simulation is
     *   switched off (production default), 409 for an order that is not waiting for payment.
 *   The 90 % odds use Laravel's Lottery (tests force win / loss).
     * @param Request $request {order_id}.
     * @return JsonResponse 200 paid | 402 declined | 404 disabled | 409 not payable | 422 | 500.
     */
    public function simulatePayment(Request $request): JsonResponse
    {
        if (!config('services.shop.payment_simulation')) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $validated = $request->validate([
            'order_id' => 'required|integer|exists:shop_orders,id'
        ]);

        try {
            $order = ShopOrder::findOrFail($validated['order_id']);

            if ($order->payment_status !== 'pending' || $order->status !== 'pending') {
                return response()->json(['success' => false, 'message' => 'This order is not waiting for payment.'], 409);
            }

            if (!Lottery::odds(9, 10)->choose()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Payment was declined (simulation)'
                ], 402);
            }

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
        } catch (\Exception $e) {
            Log::error("Payment simulation error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder (Checkout)', "Error during payment simulation: " . $e->getMessage());
            return response()->json(['message' => 'Error during payment simulation'], 500);
        }
    }
}
