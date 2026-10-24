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
 *
 * @bugfix-note (2026-10-23) Found by the API tests:
 * - SECURITY (IDOR): `delete_items` and `items[].id` of `update()` were not limited to the
 *   edited order - saving order A could delete or rewrite the items of order B. Now scoped
 *   to the order in the URL; foreign ids are ignored.
 * - SECURITY: the 500 answers of store / update contained the exception text → generic.
 * - `restore()` always failed with 500: it called `restore()` on the items, which are not
 *   soft-deletable (BadMethodCallException). Items are never soft-deleted with the order,
 *   so only the order is restored.
 * - Cancelling / returning an order through `update()` never returned the pieces to stock
 *   (the stock logic lived in `updateStatus()`, which has no route) and a later permanent
 *   delete skipped them because the status was already 'canceled' → stock was lost for good.
 *   `update()` now restores the stock on active → canceled / returned and deducts it again
 *   on canceled / returned → active. The unreachable `updateStatus()` was removed.
 * - `$product->lockForUpdate()` on a model locks nothing → the product row is loaded with
 *   the lock.
 * - unknown id → 500 instead of 404 (findOrFail inside try) in update, destroy, restore.
 * @bugfix-note (2026-10-23) `sort_by` / `sort_direction` went straight into `orderBy()` - an
 *   unknown column or direction answered 500 (open finding #5). Sorting now goes through
 *   AppliesSafeSorting (real table columns only, asc / desc only, default otherwise).
 * @bugfix-note (2026-10-23) Open findings #21 / #22 / #23 / #24:
 * - VAT: the item rate is stored (`shop_order_items.vat_rate`) and taken from the catalogue
 *   (variant price, else product price; the form value only when the catalogue has none) -
 *   `$product->vat_rate` does not exist, so every admin order was taxed at 21 %.
 * - Buyer contact: the order keeps its own contact snapshot (`customer_*` columns, set on
 *   create, changed by the order edit). The edit no longer rewrites the customer master data
 *   - an old order corrected by the admin must not rename the customer everywhere.
 * - Stock: adding, changing the quantity of or deleting items of an order that holds stock
 *   (pending … delivered) moves the difference in / out of stock. Before only status changes
 *   did, so stock drifted after every item edit.
 * @refactor-note (2026-10-24) Open finding #6: success answers go through `respond()` /
 *   `respondPaginated()` - one envelope `{data, meta?}` (App\Traits\RespondsWithData).
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
use App\Traits\AppliesSafeSorting;

/**
 * @description Controller responsible for administrative order management.
 * @note Integrates with inventory systems and customer records to maintain data consistency across orders.
 */
class ShopOrderController extends Controller
{
    use LogsActivity, AppliesSafeSorting;

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
                  ->orWhere('customer_email', 'like', "%$s%")
                  ->orWhere('customer_last_name', 'like', "%$s%")
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

        $this->applySorting($query, $request, 'created_at', 'desc');

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        $data = $noPagination ? $query->get() : $query->paginate($perPage);

        if ($noPagination) {
            return $this->respond(ShopOrderResource::collection($data));
        }

        return $this->respondPaginated($data, ShopOrderResource::class);
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
            if (!$coupon) { return response()->json(['message' => 'The selected coupon does not exist.'], 422); }
            if (!$coupon->is_active) { return response()->json(['message' => 'This coupon is not active.'], 422); }

            $now = now();
            if ($coupon->valid_from && $now->lt($coupon->valid_from)) { return response()->json(['message' => 'The validity of this coupon has not started yet.'], 422); }
            if ($coupon->valid_until && $now->gt($coupon->valid_until)) { return response()->json(['message' => 'The validity of this coupon has already expired.'], 422); }
            if ($coupon->max_usage > 0 && $coupon->usage_count >= $coupon->max_usage) { return response()->json(['message' => 'This coupon has already been exhausted.'], 422); }
            if ($coupon->min_order_amount > 0 && $totalAmount < (float)$coupon->min_order_amount) {
                return response()->json(['message' => "The minimum order amount for this coupon is " . number_format($coupon->min_order_amount, 2) . " EUR."], 422);
            }

            $discountAmount = ($coupon->discount_type === 'percent')
                ? ($totalAmount * (float)$coupon->discount_value) / 100
                : (float)$coupon->discount_value;
        }

        try {
            DB::beginTransaction();

            // An existing customer (also a trashed one - the e-mail is unique) is only linked:
            // the order keeps its own contact snapshot, the master data stay untouched.
            $customer = ShopCustomer::withTrashed()->where('email', $validated['email'])->first()
                ?? ShopCustomer::create([
                    'email'       => $validated['email'],
                    'first_name'  => $validated['first_name'],
                    'last_name'   => $validated['last_name'],
                    'phone'       => $validated['phone'],
                    'company'     => $validated['company'] ?? null,
                    'is_active'   => true,
                    'address'     => $validated['shipping_address'],
                    'city'        => $validated['shipping_city'],
                    'postal_code' => $validated['shipping_postal_code'],
                    'country'     => $validated['shipping_country'],
                ]);

            $shippingAmount = 0;
            if (!empty($validated['shipping_method_id'])) {
                $shippingMethod = \App\Models\Shop\ShopShippingMethod::find($validated['shipping_method_id']);
                $shippingAmount = $shippingMethod ? (float)$shippingMethod->base_price : 0;
            }

            if ($coupon) { $coupon->increment('usage_count'); }

            $discountFactor = $totalAmount > 0 ? ($totalAmount - $discountAmount) / $totalAmount : 1;
            $totalTax = 0;
            $finalAmount = max(0, $totalAmount + $shippingAmount - $discountAmount);

            $order = ShopOrder::create(ShopOrder::contactSnapshot($validated) + [
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
                $product = ShopProduct::lockForUpdate()->findOrFail($itemData['product_id']);
                $variantName = null;
                $vatRate = ShopOrderItem::catalogueVatRate($product->id, $itemData['product_variant_id'] ?? null, $itemData['vat_rate'] ?? null);

                if (!empty($itemData['product_variant_id'])) {
                    $variant = ShopProductVariant::lockForUpdate()->findOrFail($itemData['product_variant_id']);
                    $variant->decrement('stock_quantity', $quantity);
                    $variantName = $variant->variant_name;
                    ShopProductVariant::forceSyncParentStock($product->id);
                } else {
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
            $this->logAction($request, ShopLog::class, 'create', 'ShopOrder', "Created order: {$order->order_number}.", $order->id, 'ShopOrder');

            return $this->respond(new ShopOrderResource($order), 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("ShopOrder creation error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder', "Order creation failed: " . $e->getMessage());
            return response()->json(['message' => 'Order creation failed.'], 500);
        }
    }

    /**
     * Retrieves full order details including relations.
     */
    public function show($id): JsonResponse
    {
        $order = ShopOrder::with(['customer', 'paymentMethod', 'shippingMethod', 'coupon', 'items'])->findOrFail($id);
        return $this->respond(new ShopOrderResource($order));
    }

    /**
     * Updates an existing order, including customer details, items, and recalculates totals.
     */
    public function update(UpdateShopOrderRequest $request, $id): JsonResponse
    {
        $order = ShopOrder::findOrFail($id);

        try {
            DB::beginTransaction();
            $validated = $request->validated();
            $oldStatus = $order->status;

            // Contact fields change this order's snapshot only, not the customer master data.
            $updateData = collect($validated)->except(['items', 'delete_items', 'first_name', 'last_name', 'email', 'phone', 'company'])->toArray();
            $order->update(ShopOrder::contactSnapshot($validated) + $updateData);

            // Item edits move stock only while the order (still in its old status) holds it;
            // a status change below then moves the whole - already edited - item set.
            $holdsStock = in_array($oldStatus, ShopOrder::STOCK_HOLDING_STATUSES, true);

            if ($request->has('delete_items')) {
                $deleted = $order->items()->whereIn('id', $request->input('delete_items'))->get();
                foreach ($deleted as $item) {
                    if ($holdsStock) { $item->adjustStock($item->quantity); }
                    $item->delete();
                }
            }

            if ($request->has('items')) {
                $this->updateOrderItems($order, $request->input('items'), $holdsStock);
            }

            $order->load('items');
            $this->moveStockOnStatusChange($order, $oldStatus, $order->status);
            $this->recalculateOrderTotals($order);
            DB::commit();

            if ($order->customer) { $order->customer->recalculateTotalSpent(); }

            $order->load(['customer', 'paymentMethod', 'shippingMethod', 'coupon', 'items']);
            $this->logAction($request, ShopLog::class, 'update', 'ShopOrder', "Updated order: {$order->order_number}", $order->id, 'ShopOrder');

            return $this->respond(new ShopOrderResource($order));
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("ShopOrder update error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder', "Update failed for ID {$id}: " . $e->getMessage(), (int) $id, 'ShopOrder');
            return response()->json(['message' => 'Update failed.'], 500);
        }
    }

    /**
     * @description Returns the pieces to stock when an active order is cancelled /
     *   returned, and takes them out again when such an order is reopened.
     * @param ShopOrder $order Order with loaded items.
     * @param string $oldStatus Status before the update.
     * @param string $newStatus Status after the update.
     * @return void
     */
    private function moveStockOnStatusChange(ShopOrder $order, string $oldStatus, string $newStatus): void
    {
        $wasHolding = in_array($oldStatus, ShopOrder::STOCK_HOLDING_STATUSES, true);
        $isHolding  = in_array($newStatus, ShopOrder::STOCK_HOLDING_STATUSES, true);

        if ($wasHolding && in_array($newStatus, ShopOrder::STOCK_RELEASED_STATUSES, true)) {
            $order->restoreStock();
        } elseif (!$wasHolding && $isHolding) {
            $order->deductStock();
        }
    }

    /**
     * Performs a soft or hard delete of an order, restoring stock if required.
     */
    public function destroy(Request $request, $id)
    {
        $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
        $order = ShopOrder::withTrashed()->with(['items', 'customer'])->findOrFail($id);

        try {
            DB::beginTransaction();

            if ($forceDelete) {
                if (!in_array($order->status, ShopOrder::STOCK_RELEASED_STATUSES, true)) { $order->restoreStock(); }
                $order->items()->forceDelete();
                $order->forceDelete();
            } else {
                $order->delete();
            }

            DB::commit();
            if ($order->customer) { $order->customer->recalculateTotalSpent(); }

            $this->logAction($request, ShopLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'ShopOrder', "Deleted order ID: $id", (int) $id, 'ShopOrder');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("ShopOrder delete error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder', "Deletion failed for ID {$id}: " . $e->getMessage(), (int) $id, 'ShopOrder');
            return response()->json(['message' => 'Deletion failed.'], 500);
        }
    }

    /**
     * Restores a soft-deleted order.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $order = ShopOrder::withTrashed()->findOrFail($id);

        try {
            $order->restore();

            $order->load(['customer', 'paymentMethod', 'shippingMethod', 'coupon', 'items']);
            $this->logAction($request, ShopLog::class, 'restore', 'ShopOrder', "Restored order ID: $id", (int) $id, 'ShopOrder');

            return $this->respond(new ShopOrderResource($order));
        } catch (\Exception $e) {
            Log::error("ShopOrder restore error: " . $e->getMessage());
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder', "Restoration failed for ID {$id}: " . $e->getMessage(), (int) $id, 'ShopOrder');
            return response()->json(['message' => 'Order restoration failed.'], 500);
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
                if (!in_array($order->status, ShopOrder::STOCK_RELEASED_STATUSES, true)) { $order->restoreStock(); }
                $order->items()->forceDelete();
                $order->forceDelete();
            }

            DB::commit();
            $this->logAction($request, ShopLog::class, 'force_delete_all', 'ShopOrder', "Purged trashed orders. Count: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, ShopLog::class, 'error', 'ShopOrder', "Error purging trash: " . $e->getMessage());
            return response()->json(['message' => 'Error purging trash.'], 500);
        }
    }

    /**
     * @description Updates or adds order items during an order update.
     * @param ShopOrder $order The edited order.
     * @param array<int, array<string, mixed>> $items Validated items (with `id` = existing line).
     * @param bool $holdsStock Whether the order holds stock (quantity changes / new lines move it).
     * @return void
     * @note An existing line keeps its stored VAT rate (rate of the sale); a new line gets the
     *   catalogue rate (finding #21).
     */
    private function updateOrderItems(ShopOrder $order, array $items, bool $holdsStock): void
    {
        foreach ($items as $itemData) {
            $quantity = (int) $itemData['quantity'];

            if (isset($itemData['id']) && $itemData['id'] > 0) {
                // Only items of THIS order (IDOR, see header) - a foreign id is ignored.
                $item = $order->items()->find($itemData['id']);
                if ($item) {
                    if ($holdsStock) { $item->adjustStock($item->quantity - $quantity); }
                    $item->update([
                        'quantity' => $quantity,
                        'unit_price' => $itemData['unit_price'],
                        'total_price' => $quantity * $itemData['unit_price'],
                    ]);
                }
            } else {
                $product = ShopProduct::find($itemData['product_id']);
                $variantId = !empty($itemData['product_variant_id']) ? (int) $itemData['product_variant_id'] : null;
                $variant = $variantId ? ShopProductVariant::find($variantId) : null;

                $item = ShopOrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $itemData['product_id'],
                    'product_variant_id' => $variantId,
                    'product_name' => $product->name,
                    'variant_name' => $variant?->variant_name,
                    'quantity' => $quantity,
                    'unit_price' => $itemData['unit_price'],
                    'total_price' => $quantity * $itemData['unit_price'],
                    'vat_rate' => ShopOrderItem::catalogueVatRate($product->id, $variantId, $itemData['vat_rate'] ?? null),
                ]);
                if ($holdsStock) { $item->adjustStock(-$quantity); }
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