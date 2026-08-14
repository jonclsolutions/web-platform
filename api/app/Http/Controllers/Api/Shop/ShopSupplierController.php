<?php
/**
 * @file ShopSupplierController.php
 * @path app/Http/Controllers/Api/Shop/ShopSupplierController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Controller managing supplier lifecycle, including search, filtering, CRUD operations, and administrative audit logging.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction(). Doménově beze změny (ShopLog::class).
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopSupplier;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopSupplierResource;
use App\Http\Requests\Shop\ShopSupplier\StoreShopSupplierRequest;
use App\Http\Requests\Shop\ShopSupplier\UpdateShopSupplierRequest;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

/**
 * @description Handles supplier management.
 * @note Provides flexible search/filter capabilities and supports soft-delete lifecycle.
 */
class ShopSupplierController extends Controller
{
    use LogsActivity;

    /**
     * Retrieves a paginated or full collection of suppliers based on filter criteria.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = ShopSupplier::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('name', 'like', "%$s%")
                ->orWhere('ico', 'like', "%$s%")
                ->orWhere('email', 'like', "%$s%")
                ->orWhere('contact_person', 'like', "%$s%")
                ->orWhere('city', 'like', "%$s%"));
        }

        foreach (['id', 'is_active'] as $f) {
            if ($request->filled($f)) {
                $query->where($f, $request->input($f));
            }
        }

        $likeFields = ['name', 'ico', 'email', 'phone', 'contact_person', 'city', 'country', 'payment_terms'];
        foreach ($likeFields as $f) {
            if ($request->filled($f)) {
                $query->where($f, 'like', '%' . $request->input($f) . '%');
            }
        }

        if ($request->filled('created_at')) {
            $query->whereDate('created_at', $request->created_at);
        }

        $sortBy = $request->input('sort_by', 'id');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        $data = $noPagination ? $query->get() : $query->paginate($perPage);

        if ($noPagination) {
            return response()->json(ShopSupplierResource::collection($data));
        }

        return response()->json([
            'data'         => ShopSupplierResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Stores a new supplier entity.
     */
    public function store(StoreShopSupplierRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $supplier = ShopSupplier::create($validated);
            $this->logAction($request, ShopLog::class, 'create', 'ShopSupplier', "Vytvořen dodavatel: {$supplier->name}", $supplier->id, 'ShopSupplier');
            return response()->json(new ShopSupplierResource($supplier), 201);
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Chyba při vytváření dodavatele: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření dodavatele selhalo.'], 500);
        }
    }

    /**
     * Displays a specific supplier by ID.
     */
    public function show($id): JsonResponse
    {
        $supplier = ShopSupplier::withTrashed()->findOrFail($id);
        return response()->json(new ShopSupplierResource($supplier));
    }

    /**
     * Updates an existing supplier.
     */
    public function update(UpdateShopSupplierRequest $request, $id): JsonResponse
    {
        try {
            $supplier = ShopSupplier::withTrashed()->findOrFail($id);
            $supplier->update($request->validated());
            $this->logAction($request, ShopLog::class, 'update', 'ShopSupplier', "Aktualizace dodavatele ID: {$supplier->id}", $supplier->id, 'ShopSupplier');
            return response()->json(new ShopSupplierResource($supplier));
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Chyba při aktualizaci dodavatele ID {$id}: " . $e->getMessage(), (int) $id, 'ShopSupplier');
            return response()->json(['message' => 'Aktualizace dodavatele selhala.'], 500);
        }
    }

    /**
     * Deletes a supplier (Soft or Hard).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = ShopSupplier::withTrashed()->findOrFail($id);
            $forceDelete ? $item->forceDelete() : $item->delete();
            $this->logAction($request, ShopLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'ShopSupplier', "Smazání dodavatele ID: $id", (int) $id, 'ShopSupplier');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Chyba při mazání dodavatele ID $id: " . $e->getMessage(), (int) $id, 'ShopSupplier');
            return response()->json(['message' => 'Smazání dodavatele selhalo.'], 500);
        }
    }

    /**
     * Restores a soft-deleted supplier.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = ShopSupplier::withTrashed()->findOrFail($id);
            $item->restore();
            $this->logAction($request, ShopLog::class, 'restore', 'ShopSupplier', "Obnova dodavatele ID: $id", (int) $id, 'ShopSupplier');
            return response()->json(new ShopSupplierResource($item));
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Chyba při obnově dodavatele ID $id: " . $e->getMessage(), (int) $id, 'ShopSupplier');
            return response()->json(['message' => 'Obnova dodavatele selhala.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted suppliers.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $count = ShopSupplier::onlyTrashed()->count();
            ShopSupplier::onlyTrashed()->forceDelete();
            $this->logAction($request, ShopLog::class, 'force_delete_all', 'ShopSupplier', "Hromadné smazání koše dodavatelů. Počet: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Chyba při vyprazdňování koše dodavatelů: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }
}