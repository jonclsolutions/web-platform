<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopProduct;
use App\Models\Shop\ShopProductImage;
use App\Models\Shop\ShopProductVariant;
use App\Models\Shop\ShopProductPrice;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopProductResource;
use App\Http\Requests\Shop\ShopProduct\StoreShopProductRequest;
use App\Http\Requests\Shop\ShopProduct\UpdateShopProductRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ShopProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage     = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = ShopProduct::with([
            'category', 'categories', 'supplier', 'primaryImage', 'prices',
            'variants' => fn($q) => $q->with(['images', 'prices']),
        ]);

        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q
                ->where('name',        'like', "%$s%")
                ->orWhere('name_en',     'like', "%$s%")
                ->orWhere('slug',        'like', "%$s%")
                ->orWhere('sku',         'like', "%$s%")
                ->orWhere('description', 'like', "%$s%")
            );
        }

        if ($request->filled('category_id')) {
            $query->inCategory((int) $request->input('category_id'));
        }
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->input('supplier_id'));
        }
        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }
        if ($request->filled('is_featured')) {
            $query->where('is_featured', $request->boolean('is_featured'));
        }
        if ($request->boolean('low_stock')) {
            $query->lowStock();
        }
        if ($request->filled('price_from')) {
            $query->whereHas('prices', fn($q) => $q->where('price_czk_with_vat', '>=', $request->input('price_from')));
        }
        if ($request->filled('price_to')) {
            $query->whereHas('prices', fn($q) => $q->where('price_czk_with_vat', '<=', $request->input('price_to')));
        }

        $query->orderBy($request->input('sort_by', 'created_at'), $request->input('sort_direction', 'desc'));

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        $data         = $noPagination ? $query->get() : $query->paginate($perPage);

        if ($noPagination) {
            return response()->json(ShopProductResource::collection($data));
        }

        return response()->json([
            'data'         => ShopProductResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    public function store(StoreShopProductRequest $request): JsonResponse
    {
        Log::info('ShopProduct Store started');

        try {
            $validated   = $request->validated();
            $productData = collect($validated)->except(['prices', 'variants', 'images', 'category_ids'])->toArray();

            if (empty($productData['category_id'])) {
                $productData['is_active'] = false;
            }

            $product = ShopProduct::create($productData);

            $primaryId   = isset($productData['category_id']) ? (int) $productData['category_id'] : null;
            $categoryIds = $this->resolveCategoryIds($request, $primaryId);
            $product->syncCategories($categoryIds, $primaryId);

            if ($request->has('prices')) {
                $product->prices()->create($this->filterPriceData($request->input('prices')));
            }
            if ($request->has('images')) {
                $this->storeImages($product, $request->input('images', []), $request, 'images');
            }
            if ($request->has('variants')) {
                $this->storeVariants($product, $request->input('variants', []), $request);
                $this->syncProductStock($product);
            }

            $product->load($this->defaultRelations());
            $this->logAction($request, 'create', 'ShopProduct', "Vytvořen produkt: {$product->name}", $product->id);

            return response()->json(new ShopProductResource($product), 201);

        } catch (\Exception $e) {
            Log::error('ShopProduct creation error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Vytvoření produktu selhalo: ' . $e->getMessage()], 500);
        }
    }

    public function show($id): JsonResponse
    {
        $product = ShopProduct::with($this->defaultRelations())->findOrFail($id);
        return response()->json(new ShopProductResource($product));
    }

    public function update(UpdateShopProductRequest $request, $id): JsonResponse
    {
        Log::info('ShopProduct Update started', ['id' => $id]);

        try {
            $product    = ShopProduct::findOrFail($id);
            $validated  = $request->validated();
            $updateData = collect($validated)
                ->except(['prices', 'images', 'variants', 'delete_images', 'delete_variants', 'category_ids'])
                ->toArray();

            if (empty($updateData['category_id'])) {
                $updateData['is_active'] = false;
            }

            $product->update($updateData);

            $primaryId   = isset($updateData['category_id']) ? (int) $updateData['category_id'] : null;
            $categoryIds = $this->resolveCategoryIds($request, $primaryId);
            $product->syncCategories($categoryIds, $primaryId);

            if ($request->has('prices')) {
                $product->prices()->updateOrCreate(
                    ['product_id' => $product->id, 'variant_id' => null],
                    $this->filterPriceData($request->input('prices'))
                );
            }

            if ($request->has('delete_images')) {
                $this->deleteImages($request->input('delete_images'));
            }
            if ($request->has('images')) {
                $this->storeImages($product, $request->input('images', []), $request, 'images');
            }
            if ($request->has('delete_variants')) {
                $variantsToDelete = ShopProductVariant::whereIn('id', $request->delete_variants)->get();
                foreach ($variantsToDelete as $variant) {
                    $variant->prices()->delete();
                    $variant->delete();
                }
            }
            if ($request->has('variants')) {
                $this->updateVariants($product, $request->input('variants', []), $request);
            }

            $this->syncProductStock($product);
            $this->clearProductCache($product);

            $product->load($this->defaultRelations());
            $this->logAction($request, 'update', 'ShopProduct', "Aktualizace produktu: {$product->name}", $product->id);

            return response()->json(new ShopProductResource($product));

        } catch (\Exception $e) {
            Log::error('ShopProduct update error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Aktualizace selhala: ' . $e->getMessage()], 500);
        }
    }

    public function updateCategory(Request $request, $id): JsonResponse
    {
        $request->validate([
            'category_id'    => 'nullable|integer|exists:shop_categories,id',
            'category_ids'   => 'nullable|array',
            'category_ids.*' => 'integer|exists:shop_categories,id',
        ]);

        try {
            $product     = ShopProduct::findOrFail($id);
            $primaryId   = $request->input('category_id') ? (int) $request->input('category_id') : null;
            $categoryIds = $this->resolveCategoryIds($request, $primaryId);

            $product->syncCategories($categoryIds, $primaryId);
            $this->clearProductCache($product);

            $this->logAction($request, 'update', 'ShopProduct', "Rychlá změna kategorií produktu", $product->id);

            $product->load($this->defaultRelations());
            return response()->json(new ShopProductResource($product));

        } catch (\Exception $e) {
            Log::error('ShopProduct quick category update error: ' . $e->getMessage());
            return response()->json(['message' => 'Aktualizace kategorie selhala.'], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $product     = ShopProduct::withTrashed()->findOrFail($id);

            if ($forceDelete) {
                foreach ($product->images as $image) {
                    Storage::disk('public')->delete('products/' . $image->image_path);
                }
                foreach ($product->variants as $variant) {
                    foreach ($variant->images as $image) {
                        Storage::disk('public')->delete('products/' . $image->image_path);
                    }
                    $variant->prices()->delete();
                }
                $product->prices()->delete();
                $product->forceDelete();
            } else {
                $product->delete();
            }

            $this->logAction($request, $forceDelete ? 'hard_delete' : 'soft_delete', 'ShopProduct', "Smazání produktu ID: $id", $id);
            return response()->json(null, 204);

        } catch (\Exception $e) {
            Log::error('ShopProduct delete error: ' . $e->getMessage());
            return response()->json(['message' => 'Smazání produktu selhalo: ' . $e->getMessage()], 500);
        }
    }

    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $product = ShopProduct::withTrashed()->findOrFail($id);
            $product->restore();
            $product->load($this->defaultRelations());
            $this->logAction($request, 'restore', 'ShopProduct', "Obnova produktu ID: $id", $id);
            return response()->json(new ShopProductResource($product));
        } catch (\Exception $e) {
            Log::error('ShopProduct restore error: ' . $e->getMessage());
            return response()->json(['message' => 'Obnova produktu selhala.'], 500);
        }
    }

    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashedProducts = ShopProduct::onlyTrashed()->with(['variants', 'images'])->get();
            foreach ($trashedProducts as $product) {
                foreach ($product->images as $image) {
                    Storage::disk('public')->delete('products/' . $image->image_path);
                }
                foreach ($product->variants as $variant) {
                    foreach ($variant->images as $image) {
                        Storage::disk('public')->delete('products/' . $image->image_path);
                    }
                    $variant->prices()->delete();
                }
                $product->prices()->delete();
                $product->forceDelete();
            }
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('ShopProduct force delete all error: ' . $e->getMessage());
            return response()->json(['message' => 'Vyprázdnění koše selhalo: ' . $e->getMessage()], 500);
        }
    }

    public function publicIndex(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 20);
        $query   = ShopProduct::active()->with(['primaryImage', 'category', 'categories', 'prices']);

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('name', 'like', "%$s%")->orWhere('name_en', 'like', "%$s%")->orWhere('description', 'like', "%$s%"));
        }
        if ($request->filled('category_id')) {
            $query->inCategory((int) $request->input('category_id'));
        }
        if ($request->filled('price_from')) {
            $query->whereHas('prices', fn($q) => $q->where('price_czk_with_vat', '>=', $request->input('price_from')));
        }
        if ($request->filled('price_to')) {
            $query->whereHas('prices', fn($q) => $q->where('price_czk_with_vat', '<=', $request->input('price_to')));
        }

        $query->orderBy($request->input('sort_by', 'created_at'), $request->input('sort_direction', 'desc'));
        $products = $query->paginate($perPage);

        return response()->json([
            'data'         => ShopProductResource::collection($products->items()),
            'total'        => $products->total(),
            'per_page'     => $products->perPage(),
            'current_page' => $products->currentPage(),
            'last_page'    => $products->lastPage(),
        ]);
    }

    public function publicShow($slugOrId): JsonResponse
    {
        $query = ShopProduct::active()->with([
            'category', 'categories', 'prices',
            'images'   => fn($q) => $q->orderBy('sort_order'),
            'variants' => fn($q) => $q->with(['images', 'prices']),
        ]);

        $product = is_numeric($slugOrId) ? $query->find($slugOrId) : $query->where('slug', $slugOrId)->first();

        if (! $product) {
            return response()->json(['message' => 'Produkt nebyl nalezen nebo není aktivní.'], 404);
        }

        return response()->json(new ShopProductResource($product));
    }

    // =========================================================
    // PRIVATE HELPERS
    // =========================================================

    private function defaultRelations(): array
    {
        return [
            'category', 'categories', 'supplier', 'primaryImage', 'images', 'prices',
            'variants' => fn($q) => $q->with(['images', 'prices']),
        ];
    }

    private function resolveCategoryIds(Request $request, ?int $primaryId): array
    {
        if ($request->has('category_ids')) {
            $ids = array_map('intval', (array) $request->input('category_ids', []));
            if ($primaryId && ! in_array($primaryId, $ids, true)) {
                $ids[] = $primaryId;
            }
            return array_values(array_unique(array_filter($ids)));
        }

        $productId   = $request->route('product') ?: $request->route('id');
        $existingIds = [];

        if ($productId) {
            $existingIds = DB::table('shop_product_categories')
                ->where('product_id', $productId)
                ->pluck('category_id')
                ->map(fn($id) => (int) $id)
                ->toArray();
        }

        if ($primaryId) {
            $existingIds[] = $primaryId;
        }

        return array_values(array_unique(array_filter($existingIds)));
    }

    private function filterPriceData(array $prices): array
    {
        return $prices;
    }

    private function clearProductCache(ShopProduct $product): void
    {
        \Illuminate\Support\Facades\Cache::forget("product_stock_{$product->id}");
        foreach ($product->variants as $variant) {
            \Illuminate\Support\Facades\Cache::forget("product_stock_{$product->id}_v{$variant->id}");
        }
    }

    private function storeImages(ShopProduct $product, array $images, Request $request, string $prefix = 'images'): void
    {
        foreach ($images as $index => $imageData) {
            if (! empty($imageData['id']) && ! $request->hasFile("{$prefix}.{$index}.file")) {
                continue;
            }
            $file = $request->file("{$prefix}.{$index}.file");
            if (! $file || ! $file->isValid()) {
                continue;
            }
            $fileName = Str::uuid() . '.' . $file->getClientOriginalExtension();
            $file->storeAs('products', $fileName, 'public');

            if (! empty($imageData['id'])) {
                $oldImage = ShopProductImage::find($imageData['id']);
                if ($oldImage) {
                    Storage::disk('public')->delete('products/' . $oldImage->image_path);
                    $oldImage->update([
                        'image_path' => $fileName,
                        'alt_text'   => $imageData['alt_text']   ?? $product->name,
                        'sort_order' => $imageData['sort_order'] ?? $index,
                        'is_primary' => filter_var($imageData['is_primary'] ?? false, FILTER_VALIDATE_BOOLEAN),
                    ]);
                }
            } else {
                ShopProductImage::create([
                    'product_id' => $product->id,
                    'variant_id' => $imageData['variant_id'] ?? null,
                    'image_path' => $fileName,
                    'alt_text'   => $imageData['alt_text']   ?? $product->name,
                    'is_primary' => filter_var($imageData['is_primary'] ?? false, FILTER_VALIDATE_BOOLEAN),
                    'sort_order' => $imageData['sort_order'] ?? $index,
                ]);
            }
        }
    }

    private function deleteImages(array $imageIds): void
    {
        $images = ShopProductImage::whereIn('id', $imageIds)->get();
        foreach ($images as $image) {
            if (Storage::disk('public')->exists('products/' . $image->image_path)) {
                Storage::disk('public')->delete('products/' . $image->image_path);
            }
            $image->delete();
        }
    }

    private function storeVariants(ShopProduct $product, array $variants, ?Request $request = null): void
    {
        foreach ($variants as $idx => $variantData) {
            $variant = ShopProductVariant::create([
                'product_id'        => $product->id,
                'variant_name'      => $variantData['variant_name'],
                'attribute_1_name'  => $variantData['attribute_1_name']  ?? null,
                'attribute_1_value' => $variantData['attribute_1_value'] ?? null,
                'attribute_2_name'  => $variantData['attribute_2_name']  ?? null,
                'attribute_2_value' => $variantData['attribute_2_value'] ?? null,
                'sku_variant'       => $variantData['sku_variant']       ?? null,
                'stock_quantity'    => $variantData['stock_quantity']    ?? 0,
            ]);

            if (isset($variantData['prices']) && is_array($variantData['prices'])) {
                $prices = $this->filterPriceData($variantData['prices']);
                $variant->prices()->create(array_merge($prices, ['product_id' => $product->id]));
            }

            if (isset($variantData['images']) && is_array($variantData['images']) && $request) {
                $variantImages = array_map(fn($img) => array_merge($img, ['variant_id' => $variant->id]), $variantData['images']);
                $this->storeImages($product, $variantImages, $request, "variants.{$idx}.images");
            }
        }
    }

    private function updateVariants(ShopProduct $product, array $variants, Request $request): void
    {
        foreach ($variants as $idx => $variantData) {
            if (isset($variantData['id']) && $variantData['id'] > 0) {
                $variant = ShopProductVariant::findOrFail($variantData['id']);
                $variant->update([
                    'variant_name'      => $variantData['variant_name'],
                    'attribute_1_name'  => $variantData['attribute_1_name']  ?? null,
                    'attribute_1_value' => $variantData['attribute_1_value'] ?? null,
                    'attribute_2_name'  => $variantData['attribute_2_name']  ?? null,
                    'attribute_2_value' => $variantData['attribute_2_value'] ?? null,
                    'sku_variant'       => $variantData['sku_variant']       ?? null,
                    'stock_quantity'    => $variantData['stock_quantity']    ?? 0,
                ]);

                if (isset($variantData['prices']) && is_array($variantData['prices'])) {
                    $prices = $this->filterPriceData($variantData['prices']);
                    $variant->prices()->updateOrCreate(
                        ['variant_id' => $variant->id],
                        array_merge($prices, ['product_id' => $product->id])
                    );
                }

                if (isset($variantData['delete_images']) && is_array($variantData['delete_images'])) {
                    $this->deleteImages($variantData['delete_images']);
                }

                if (isset($variantData['images']) && is_array($variantData['images'])) {
                    $variantImages = array_map(fn($img) => array_merge($img, ['variant_id' => $variant->id]), $variantData['images']);
                    $this->storeImages($product, $variantImages, $request, "variants.{$idx}.images");
                }
            } else {
                $this->storeVariants($product, [$variantData], $request);
            }
        }
    }

    private function syncProductStock(ShopProduct $product): void
    {
        $totalStock = ShopProductVariant::where('product_id', $product->id)
            ->whereNull('deleted_at')
            ->sum('stock_quantity');
        $product->update(['stock_quantity' => $totalStock]);
    }

    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null): void
    {
        try {
            $user = $request->user() ?? auth('sanctum')->user();
            ShopLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => $description,
                'affected_entity_type' => 'ShopProduct',
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string) ($user?->id ?? '0'),
                'user_plain'           => $user ? ($user->full_name ?? $user->user_email) : 'Systém',
            ]);
        } catch (\Exception $e) {
            Log::error('Log action error: ' . $e->getMessage());
        }
    }
}