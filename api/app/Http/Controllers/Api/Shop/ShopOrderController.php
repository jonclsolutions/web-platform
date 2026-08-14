<?php
/**
 * @file ShopOrderController.php
 * @path app/Http/Controllers/Api/Shop/ShopOrderController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages comprehensive shop order lifecycle operations, including creation, status tracking, inventory synchronization, and complex financial recalculations.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction() - doménově beze změny (ShopLog::class). ODSTRANĚNY
 * ladicí `Log::info("...Store/Update started", ['payload' => $request->all()])` volání -
 * stejný důvod jako u ShopCheckoutController/ShopCustomerController: zbytečná duplikace
 * osobních/platebních údajů objednávky mimo řízený `shop_logs` audit trail.
 * `updateStatus()`, `destroy()`, `forceDeleteAllTrashed()` dosud NEMĚLY žádné auditní
 * volání do `shop_logs` (na rozdíl od store/update/restore) - doplněno, ať je změna
 * stavu objednávky a mazání stejně dohledatelné jako ostatní mutace.
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopOrder;
use App\Models\Shop\ShopOrderItem;
use App\Models\Shop\ShopProduct;
use App\Models\Shop\ShopProductVariant;
use App\Models\Shop\ShopCustomer;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopOrderResource;
use App\Http\Requests\Shop\ShopOrder\StoreShopOrderRequest;
use App\Http\Requests\Shop\ShopOrder\UpdateShopOrderRequest;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

/**
 * @description Controller responsible for administrative order management.
 * @note Integrates with inventory systems and customer records to maintain data consistency across orders.
 */
class ShopOrderController extends Controller
{
    use LogsActivity;

    /**
     * Retrieves a paginated list of orders with flexible filtering options.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = ShopOrder::with([
            'customer',
            'paymentMethod',
            'shippingMethod',
            'coupon',
            'items'
        ]);

        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) =>
                $q->where('id', $s)
                  ->orWhere('order_number', 'like', "%$s%")
                  ->orWhere('shipping_address', 'like', "%$s%")
                  ->orWhereHas('customer', fn($cq) =>
                      $cq->where('email', 'like', "%$s%")
                        ->orWhere('first_name', 'like', "%$s%")
                        ->orWhere('last_name', 'like', "%$s%")
                  )
            );
        }

        if ($request->filled('id')) { $query->where('id', $request->input('id')); }
        if ($request->filled('order_number')) { $query->where('order_number', 'like', '%' . $request->input('order_number') . '%'); }

        if ($request->filled('status')) {
            $statusValue = $request->input('status');
            if (is_string($statusValue) && str_contains($statusValue, ',')) {
                $query->whereIn('status', explode(',', $statusValue));
            } else {
                $query->where('status', $statusValue);
            }
        }

        if ($request->filled('payment_status')) { $query->where('payment_status', $request->input('payment_status')); }
        if ($request->filled('customer_id')) { $query->where('customer_id', $request->input('customer_id')); }
        if ($request->filled('amount_from')) { $query->where('final_amount', '>=', $request->input('amount_from')); }
        if ($request->filled('amount_to')) { $query->where('final_amount', '<=', $request->input('amount_to')); }
        if ($request->filled('date_from')) { $query->whereDate('created_at', '>=', $request->input('date_from')); }
        if ($request->filled('date_to')) { $query->whereDate('created_at', '<=', $request->input('date_to')); }

        $sortBy = $request->input('sort_by', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        if (str_contains($sortBy, '.')) { $sortBy = 'created_at'; }
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        $data = $noPagination ? $query->get() : $query->paginate($perPage);

        if ($noPagination) {
            return response()->json(ShopOrderResource::collection($data));
        }

        return response()->json([
            'data' => ShopOrderResource::collection($data->items()),
            'total' => $data->total(),
            'per_page' => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page' => $data->lastPage(),
        ]);
    }

    /**
     * Stores a new order and processes associated inventory and customer data.
     */
    public function store(StoreShopOrderRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $totalAmount = 0;
        foreach ($validated['items'] as $itemData) {
            $totalAmount += (float)$itemData['quantity'] * (float)$itemData['unit_price'];
        }

        $coupon = null;
        $discountAmount = 0;

        if (!empty($validated['coupon_id'])) {
            $coupon = \App\Models\Shop\ShopCoupon::find($validated['coupon_id']);
            if (!$coupon) { return response()->json(['message' => 'Vybraný kupón neexistuje.'], 422); }
            if (!$coupon->is_active) { return response()->json(['message' => 'Tento kupón není aktivní.'], 422); }

            $now = now();
            if ($coupon->valid_from && $now->lt($coupon->valid_from)) { return response()->json(['message' => 'Platnost tohoto kupónu ještě nezačala.'], 422); }
            if ($coupon->valid_until && $now->gt($coupon->valid_until)) { return response()->json(['message' => 'Platnost tohoto kupónu již vypršela.'], 422); }
            if ($coupon->max_usage > 0 && $coupon->usage_count >= $coupon->max_usage) { return response()->json(['message' => 'Tento kupón již byl vyčepan.'], 422); }
            if ($coupon->min_order_amount > 0 && $totalAmount < (float)$coupon->min_order_amount) {
                return response()->json(['message' => "Minimální hodnota objednávky pro tento kupón je " . number_format($coupon->min_order_amount, 2) . " EUR."], 422);
            }

            $discountAmount = ($coupon->discount_type === 'percent')
                ? ($totalAmount * (float)$coupon->discount_value) / 100
                : (float)$coupon->discount_value;
        }

        try {
            DB::beginTransaction();

            $customer = ShopCustomer::firstOrCreate(
                ['email' => $validated['email']],
                [
                    'first_name'  => $validated['first_name'],
                    'last_name'   => $validated['last_name'],
                    'phone'       => $validated['phone'],
                    'company'     => $validated['company'] ?? null,
                    'is_active'   => true,
                    'address'     => $validated['shipping_address'],
                    'city'        => $validated['shipping_city'],
                    'postal_code' => $validated['shipping_postal_code'],
                    'country'     => $validated['shipping_country'],
                ]
            );

            $shippingAmount = 0;
            if (!empty($validated['shipping_method_id'])) {
                $shippingMethod = \App\Models\Shop\ShopShippingMethod::find($validated['shipping_method_id']);
                $shippingAmount = $shippingMethod ? (float)$shippingMethod->base_price : 0;
            }

            if ($coupon) { $coupon->increment('usage_count'); }

            $discountFactor = $totalAmount > 0 ? ($totalAmount - $discountAmount) / $totalAmount : 1;
            $totalTax = 0;
            $finalAmount = max(0, $totalAmount + $shippingAmount - $discountAmount);

            $order = ShopOrder::create([
                'customer_id'          => $customer->id,
                'order_number'         => ShopOrder::generateOrderNumber(),
                'status'               => $validated['status'] ?? 'pending',
                'payment_status'       => $validated['payment_status'] ?? 'pending',
                'total_amount'         => $totalAmount,
                'shipping_amount'      => $shippingAmount,
                'tax_amount'           => 0,
                'discount_amount'      => $discountAmount,
                'final_amount'         => $finalAmount,
                'coupon_id'            => $validated['coupon_id'] ?? null,
                'payment_method_id'    => $validated['payment_method_id'],
                'shipping_method_id'   => $validated['shipping_method_id'],
                'shipping_address'     => $validated['shipping_address'],
                'shipping_city'        => $validated['shipping_city'],
                'shipping_postal_code' => $validated['shipping_postal_code'],
                'shipping_country'     => $validated['shipping_country'],
                'notes'                => $validated['notes'] ?? null,
                'paid_at'              => ($validated['payment_status'] ?? 'pending') === 'paid' ? now() : null,
            ]);

            foreach ($validated['items'] as $itemData) {
                $quantity = (int)$itemData['quantity'];
                $product = ShopProduct::findOrFail($itemData['product_id']);
                $variantName = null;
                $vatRate = $itemData['vat_rate'] ?? $product->vat_rate ?? 21;

                if (!empty($itemData['product_variant_id'])) {
                    $variant = ShopProductVariant::lockForUpdate()->findOrFail($itemData['product_variant_id']);
                    $variant->decrement('stock_quantity', $quantity);
                    $variantName = $variant->variant_name;
                    if (isset($variant->vat_rate)) { $vatRate = $variant->vat_rate; }
                    ShopProductVariant::forceSyncParentStock($product->id);
                } else {
                    $product->lockForUpdate();
                    $product->decrement('stock_quantity', $quantity);
                }

                $linePrice = $quantity * (float)$itemData['unit_price'];
                $linePriceAfterDiscount = $linePrice * $discountFactor;
                $itemTax = $linePriceAfterDiscount * ($vatRate / (100 + $vatRate));
                $totalTax += $itemTax;

                ShopOrderItem::create([
                    'order_id'           => $order->id,
                    'product_id'         => $product->id,
                    'product_variant_id' => $itemData['product_variant_id'] ?? null,
                    'product_name'       => $product->name,
                    'variant_name'       => $variantName,
                    'quantity'           => $quantity,
                    'unit_price'         => $itemData['unit_price'],
                    'total_price'        => $linePrice,
                    'vat_rate'           => $vatRate,
                ]);
            }

            $order->update(['tax_amount' => $totalTax]);
            DB::commit();

            if ($order->customer) { $order->customer->recalculateTotalSpent(); }

            $order->load(['customer', 'paymentMethod', 'shippingMethod', 'coupon', 'items']);
            $this->logAction($request, ShopLog::class, 'create', 'ShopOrder', "Vytvořena objednávka: {$order->order_number}.", $order->id, 'ShopOrder');

            return response()->json(new ShopOrderResource($order), 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("ShopOrder creation error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder', "Vytvoření objednávky selhalo: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření objednávky selhalo: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Retrieves full order details including relations.
     */
    public function show($id): JsonResponse
    {
        $order = ShopOrder::with(['customer', 'paymentMethod', 'shippingMethod', 'coupon', 'items'])->findOrFail($id);
        return response()->json(new ShopOrderResource($order));
    }

    /**
     * Updates an existing order, including customer details, items, and recalculates totals.
     */
    public function update(UpdateShopOrderRequest $request, $id): JsonResponse
    {
        try {
            DB::beginTransaction();
            $order = ShopOrder::findOrFail($id);
            $validated = $request->validated();

            if ($order->customer_id && $request->hasAny(['first_name', 'last_name', 'email', 'phone', 'company'])) {
                $customerData = collect($validated)->only(['first_name', 'last_name', 'email', 'phone', 'company'])->toArray();
                $order->customer->update($customerData);
            }

            $updateData = collect($validated)->except(['items', 'delete_items', 'first_name', 'last_name', 'email', 'phone', 'company'])->toArray();
            $order->update($updateData);

            if ($request->has('delete_items')) {
                ShopOrderItem::whereIn('id', $request->input('delete_items'))->delete();
            }

            if ($request->has('items')) {
                $this->updateOrderItems($order, $request->input('items'));
            }

            $this->recalculateOrderTotals($order);
            DB::commit();

            if ($order->customer) { $order->customer->recalculateTotalSpent(); }

            $order->load(['customer', 'paymentMethod', 'shippingMethod', 'coupon', 'items']);
            $this->logAction($request, ShopLog::class, 'update', 'ShopOrder', "Aktualizace objednávky: {$order->order_number}", $order->id, 'ShopOrder');

            return response()->json(new ShopOrderResource($order));
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("ShopOrder update error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder', "Aktualizace selhala ID {$id}: " . $e->getMessage(), (int) $id, 'ShopOrder');
            return response()->json(['message' => 'Aktualizace selhala: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Updates the status of an order and handles stock restoration if applicable.
     */
    public function updateStatus(Request $request, $id)
    {
        $order = ShopOrder::with(['items', 'customer'])->findOrFail($id);
        $oldStatus = $order->status;
        $newStatus = $request->input('status');

        DB::transaction(function () use ($order, $oldStatus, $newStatus) {
            $inventoryStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
            $restoringStatuses = ['canceled', 'returned'];

            if (in_array($oldStatus, $inventoryStatuses) && in_array($newStatus, $restoringStatuses)) {
                $order->restoreStock();
            }

            $order->update(['status' => $newStatus]);
            if ($order->customer) { $order->customer->recalculateTotalSpent(); }
        });

        $this->logAction($request, ShopLog::class, 'status_change', 'ShopOrder', "Změna stavu objednávky {$order->order_number}: {$oldStatus} -> {$newStatus}", $order->id, 'ShopOrder');

        return response()->json($order);
    }

    /**
     * Performs a soft or hard delete of an order, restoring stock if required.
     */
    public function destroy(Request $request, $id)
    {
        try {
            DB::beginTransaction();
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $order = ShopOrder::withTrashed()->with(['items', 'customer'])->findOrFail($id);
            $alreadyRestored = ['canceled', 'returned'];

            if ($forceDelete) {
                if (!in_array($order->status, $alreadyRestored)) { $order->restoreStock(); }
                $order->items()->forceDelete();
                $order->forceDelete();
            } else {
                $order->delete();
            }

            DB::commit();
            if ($order->customer) { $order->customer->recalculateTotalSpent(); }

            $this->logAction($request, ShopLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'ShopOrder', "Smazání objednávky ID: $id", (int) $id, 'ShopOrder');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("ShopOrder delete error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder', "Smazání selhalo ID {$id}: " . $e->getMessage(), (int) $id, 'ShopOrder');
            return response()->json(['message' => 'Smazání selhalo.'], 500);
        }
    }

    /**
     * Restores a soft-deleted order.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $order = ShopOrder::withTrashed()->findOrFail($id);
            $order->restore();
            $order->items()->restore();

            $order->load(['customer', 'paymentMethod', 'shippingMethod', 'coupon', 'items']);
            $this->logAction($request, ShopLog::class, 'restore', 'ShopOrder', "Obnova objednávky ID: $id", (int) $id, 'ShopOrder');

            return response()->json(new ShopOrderResource($order));
        } catch (\Exception $e) {
            Log::error("ShopOrder restore error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder', "Obnova selhala ID {$id}: " . $e->getMessage(), (int) $id, 'ShopOrder');
            return response()->json(['message' => 'Obnova objednávky selhala.'], 500);
        }
    }

    /**
     * Purges all soft-deleted orders.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashedOrders = ShopOrder::onlyTrashed()->with('items')->get();
            $count = $trashedOrders->count();
            DB::beginTransaction();

            foreach ($trashedOrders as $order) {
                $alreadyRestored = ['canceled', 'returned'];
                if (!in_array($order->status, $alreadyRestored)) { $order->restoreStock(); }
                $order->items()->forceDelete();
                $order->forceDelete();
            }

            DB::commit();
            $this->logAction($request, ShopLog::class, 'force_delete_all', 'ShopOrder', "Vysypání koše objednávek. Počet: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder', "Chyba při vyprazdňování koše: " . $e->getMessage());
            return response()->json(['message' => 'Chyba při vyprazdňování koše.'], 500);
        }
    }

    /**
     * Helper to update or add order items during an order update.
     */
    private function updateOrderItems(ShopOrder $order, array $items): void
    {
        foreach ($items as $itemData) {
            if (isset($itemData['id']) && $itemData['id'] > 0) {
                $item = ShopOrderItem::find($itemData['id']);
                if ($item) {
                    $item->update([
                        'quantity' => $itemData['quantity'],
                        'unit_price' => $itemData['unit_price'],
                        'total_price' => $itemData['quantity'] * $itemData['unit_price'],
                    ]);
                }
            } else {
                $product = ShopProduct::find($itemData['product_id']);
                $variant = !empty($itemData['product_variant_id']) ? ShopProductVariant::find($itemData['product_variant_id']) : null;

                ShopOrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $itemData['product_id'],
                    'product_variant_id' => $itemData['product_variant_id'] ?? null,
                    'product_name' => $product->name,
                    'variant_name' => $variant?->variant_name,
                    'quantity' => $itemData['quantity'],
                    'unit_price' => $itemData['unit_price'],
                    'total_price' => $itemData['quantity'] * $itemData['unit_price'],
                ]);
            }
        }
    }

    /**
     * Recalculates order financial totals based on items, coupons, and shipping.
     */
    private function recalculateOrderTotals(ShopOrder $order): void
    {
        $items = $order->items;
        $totalWithVatBeforeDiscount = (float)$items->sum('total_price');
        $discountAmount = 0;

        if ($order->coupon_id) {
            $coupon = \App\Models\Shop\ShopCoupon::find($order->coupon_id);
            if ($coupon) {
                $discountAmount = ($coupon->discount_type === 'percent')
                    ? ($totalWithVatBeforeDiscount * (float)$coupon->discount_value) / 100
                    : (float)$coupon->discount_value;
            }
        }

        $discountFactor = $totalWithVatBeforeDiscount > 0 ? ($totalWithVatBeforeDiscount - $discountAmount) / $totalWithVatBeforeDiscount : 1;
        $totalTax = 0;

        foreach ($items as $item) {
            $rate = $item->vat_rate ?? 21;
            $lineTotalAfterDiscount = $item->total_price * $discountFactor;
            $itemTax = $lineTotalAfterDiscount * ($rate / (100 + $rate));
            $totalTax += $itemTax;
        }

        $shippingAmount = $order->shippingMethod ? (float)$order->shippingMethod->base_price : 0;

        $order->update([
            'total_amount'    => $totalWithVatBeforeDiscount,
            'discount_amount' => $discountAmount,
            'tax_amount'      => $totalTax,
            'shipping_amount' => $shippingAmount,
            'final_amount'    => max(0, $totalWithVatBeforeDiscount + $shippingAmount - $discountAmount),
        ]);
    }
}