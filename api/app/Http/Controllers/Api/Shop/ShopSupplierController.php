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
 *
 * @bugfix-note (2026-10-23) The routes `suppliers/bulk-delete` and `suppliers/import/{template,
 * validate,commit}` (used by the admin suppliers page: bulk delete + "Import data") pointed to
 * methods that did not exist → every call answered 500. Implemented `bulkDestroy()`,
 * `importTemplate()`, `importValidate()` and `importCommit()` with the same contract as the web
 * imports (HandlesImportBatches, ImportFileParser / ImportRowValidator, StoreShopSupplierRequest
 * rules per row). Empty cells are stored as NULL (an empty `ico` would otherwise collide with
 * the unique index on the second empty row).
 *
 * @bugfix-note (2026-10-23) unknown id → 500 instead of 404 in update / destroy / restore (findOrFail inside try).
 */

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Shop\ShopSupplier;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Shop\ShopSupplierResource;
use App\Http\Requests\Shop\ShopSupplier\StoreShopSupplierRequest;
use App\Http\Requests\Shop\ShopSupplier\UpdateShopSupplierRequest;
use App\Services\Import\ImportFileParser;
use App\Services\Import\ImportRowValidator;
use App\Traits\HandlesImportBatches;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * @description Handles supplier management.
 * @note Provides flexible search/filter capabilities and supports soft-delete lifecycle.
 */
class ShopSupplierController extends Controller
{
    use LogsActivity;
    use HandlesImportBatches;

    /** @var string[] Columns of the import file = fields of StoreShopSupplierRequest::rules(). */
    private const IMPORTABLE_COLUMNS = [
        'name', 'ico', 'contact_person', 'email', 'phone', 'address', 'city', 'postal_code',
        'country', 'payment_terms', 'is_active', 'notes',
    ];

    /**
     * Retrieves a paginated or full collection of suppliers based on filter criteria.
     */
/**
     * @refactor-note (2026-08-25) BACKLOG "hledat napříč vším": `search` rozšířen o
     * `phone`, `country`, `payment_terms` - tyhle 3 sloupce už byly dostupné jako
     * jednotlivé filtry v `$likeFields` níže, ale v globálním `search` chyběly. Teď
     * `search` pokrývá STEJNOU množinu textových sloupců jako jednotlivé filtry
     * dohromady, konzistentně s ostatními kontrolery v projektu.
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
                ->orWhere('city', 'like', "%$s%")
                ->orWhere('phone', 'like', "%$s%")
                ->orWhere('country', 'like', "%$s%")
                ->orWhere('payment_terms', 'like', "%$s%"));
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
            $this->logAction($request, ShopLog::class, 'create', 'ShopSupplier', "Created supplier: {$supplier->name}", $supplier->id, 'ShopSupplier');
            return response()->json(new ShopSupplierResource($supplier), 201);
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Error creating supplier: " . $e->getMessage());
            return response()->json(['message' => 'Supplier creation failed.'], 500);
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
        $supplier = ShopSupplier::withTrashed()->findOrFail($id);

        try {
            $supplier->update($request->validated());
            $this->logAction($request, ShopLog::class, 'update', 'ShopSupplier', "Updated supplier ID: {$supplier->id}", $supplier->id, 'ShopSupplier');
            return response()->json(new ShopSupplierResource($supplier));
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Error updating supplier ID {$id}: " . $e->getMessage(), (int) $id, 'ShopSupplier');
            return response()->json(['message' => 'Supplier update failed.'], 500);
        }
    }

    /**
     * Deletes a supplier (Soft or Hard).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
        $item = ShopSupplier::withTrashed()->findOrFail($id);

        try {
            $forceDelete ? $item->forceDelete() : $item->delete();
            $this->logAction($request, ShopLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'ShopSupplier', "Deleted supplier ID: $id", (int) $id, 'ShopSupplier');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Error deleting supplier ID $id: " . $e->getMessage(), (int) $id, 'ShopSupplier');
            return response()->json(['message' => 'Supplier deletion failed.'], 500);
        }
    }

    /**
     * Restores a soft-deleted supplier.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $item = ShopSupplier::withTrashed()->findOrFail($id);

        try {
            $item->restore();
            $this->logAction($request, ShopLog::class, 'restore', 'ShopSupplier', "Restored supplier ID: $id", (int) $id, 'ShopSupplier');
            return response()->json(new ShopSupplierResource($item));
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Error restoring supplier ID $id: " . $e->getMessage(), (int) $id, 'ShopSupplier');
            return response()->json(['message' => 'Supplier restoration failed.'], 500);
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
            $this->logAction($request, ShopLog::class, 'force_delete_all', 'ShopSupplier', "Bulk deleted supplier trash. Count: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Error emptying supplier trash: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }

    /**
     * @description Deletes the selected suppliers in one request (soft or permanent) - see
     *   `TableBuilderComponent.onBulkDeleteClick()` in the admin.
     * @param Request $request `{ ids: number[], force_delete?: boolean }`.
     * @return JsonResponse {data: {deleted_count, skipped_count, requested}} | 422 | 500.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids'          => ['required', 'array', 'min:1', 'max:1000'],
            'ids.*'        => ['integer'],
            'force_delete' => ['sometimes', 'boolean'],
        ]);

        $ids = array_values(array_unique(array_map('intval', $validated['ids'])));
        $forceDelete = filter_var($validated['force_delete'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $requestedCount = count($ids);
        $deletedCount = 0;

        try {
            DB::transaction(function () use ($ids, $forceDelete, &$deletedCount) {
                foreach (ShopSupplier::withTrashed()->whereIn('id', $ids)->get() as $item) {
                    $forceDelete ? $item->forceDelete() : $item->delete();
                    $deletedCount++;
                }
            });
        } catch (\Exception $e) {
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Error during bulk deletion of suppliers: " . $e->getMessage());
            return response()->json(['message' => 'Bulk deletion failed.'], 500);
        }

        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');
        $this->logAction(
            $request,
            ShopLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'ShopSupplier',
            'Bulk ' . ($forceDelete ? 'permanent ' : '') . "deletion of {$deletedCount} suppliers (requested {$requestedCount}, IDs: {$idsPreview}).",
            null,
            'ShopSupplier'
        );

        return response()->json(['data' => [
            'deleted_count' => $deletedCount,
            'skipped_count' => $requestedCount - $deletedCount,
            'requested'     => $requestedCount,
        ]]);
    }

    /**
     * @description Downloads an empty import template (CSV `;` / TXT tab / JSON) with the
     *   IMPORTABLE_COLUMNS.
     * @param Request $request `?format=csv|txt|json` (default csv).
     * @return \Illuminate\Http\Response|JsonResponse File download | 422 unknown format.
     */
    public function importTemplate(Request $request)
    {
        $format = (string) $request->query('format', 'csv');
        if (!in_array($format, ['csv', 'json', 'txt'], true)) {
            return response()->json(['message' => 'Unsupported template format.'], 422);
        }

        $baseFilename = 'import-template-shop-suppliers';

        if ($format === 'json') {
            return response(json_encode([array_fill_keys(self::IMPORTABLE_COLUMNS, '')], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), 200, [
                'Content-Type'        => 'application/json; charset=UTF-8',
                'Content-Disposition' => "attachment; filename=\"{$baseFilename}.json\"",
            ]);
        }

        $delimiter = $format === 'txt' ? "\t" : ';';
        $mime = $format === 'txt' ? 'text/plain' : 'text/csv';

        return response(implode($delimiter, self::IMPORTABLE_COLUMNS) . "\n", 200, [
            'Content-Type'        => "{$mime}; charset=UTF-8",
            'Content-Disposition' => "attachment; filename=\"{$baseFilename}.{$format}\"",
        ]);
    }

    /**
     * @description Dry run of an import file - validates every row, stores the file as a
     *   pending import batch, writes nothing into shop_suppliers.
     * @param Request $request {format: csv|json|txt, file}.
     * @param ImportFileParser $parser
     * @param ImportRowValidator $rowValidator
     * @return JsonResponse {import_token, total_rows, valid_rows, invalid_rows, errors, can_commit} | 422.
     */
    public function importValidate(Request $request, ImportFileParser $parser, ImportRowValidator $rowValidator): JsonResponse
    {
        $validated = $request->validate([
            'format' => ['required', 'string', 'in:csv,json,txt'],
            'file'   => ['required', 'file', 'max:10240'],
        ]);

        try {
            $parsed = $parser->parse($request->file('file'), $validated['format'], self::IMPORTABLE_COLUMNS, 20000);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $rules = $rowValidator->buildRules(StoreShopSupplierRequest::class, self::IMPORTABLE_COLUMNS);
        $validCount = 0;
        $errors = [];
        foreach ($parsed['rows'] as $i => $row) {
            $rowErrors = $rowValidator->validateRow($row, $rules);
            if ($rowErrors === null) {
                $validCount++;
            } elseif (count($errors) < 200) {
                $errors[] = ['row' => $i + 2, 'errors' => $rowErrors];
            }
        }

        $total = count($parsed['rows']);
        $batch = $this->startImportBatch($request, 'shop/suppliers', $validated['format'], $total, $validCount, $total - $validCount, $errors);

        return response()->json([
            'import_token' => $batch->id,
            'total_rows'   => $batch->total_rows,
            'valid_rows'   => $batch->valid_rows,
            'invalid_rows' => $batch->invalid_rows,
            'errors'       => $errors,
            'can_commit'   => $batch->valid_rows > 0,
        ]);
    }

    /**
     * @description Executes a validated import: re-parses and re-validates the stored file
     *   row by row (a row that became invalid meanwhile, e.g. duplicate ico, is skipped).
     * @param Request $request {import_token}.
     * @param ImportFileParser $parser
     * @param ImportRowValidator $rowValidator
     * @return JsonResponse {data: {queued, imported_count, skipped_count, skip_reasons}} | 404 | 410 | 500.
     */
    public function importCommit(Request $request, ImportFileParser $parser, ImportRowValidator $rowValidator): JsonResponse
    {
        $validated = $request->validate(['import_token' => ['required', 'integer']]);
        $batch = $this->findPendingImportBatch($request, $validated['import_token']);

        if ($batch === null) {
            return response()->json(['message' => 'Import not found or already processed.'], 404);
        }

        try {
            $result = $this->runImportCommit($batch, function ($uploadedFile) use ($parser, $rowValidator, $batch) {
                $parsed = $parser->parse($uploadedFile, $batch->format, self::IMPORTABLE_COLUMNS, 20000);
                $rules = $rowValidator->buildRules(StoreShopSupplierRequest::class, self::IMPORTABLE_COLUMNS);

                $imported = 0;
                DB::transaction(function () use ($parsed, $rules, $rowValidator, &$imported) {
                    foreach ($parsed['rows'] as $row) {
                        if ($rowValidator->validateRow($row, $rules) !== null) {
                            continue;
                        }
                        $data = array_intersect_key($row, array_flip(self::IMPORTABLE_COLUMNS));
                        ShopSupplier::create(array_map(fn ($value) => $value === '' ? null : $value, $data));
                        $imported++;
                    }
                });

                return ['imported_count' => $imported, 'skipped_count' => count($parsed['rows']) - $imported];
            });

            $this->logAction(
                $request,
                ShopLog::class,
                'import',
                'ShopSupplier',
                "Bulk import: added {$result['imported_count']} suppliers, skipped {$result['skipped_count']} (file '{$batch->original_filename}').",
                null,
                'ShopSupplier'
            );

            return response()->json(['data' => [
                'queued'         => false,
                'imported_count' => $result['imported_count'],
                'skipped_count'  => $result['skipped_count'],
                'skip_reasons'   => [],
            ]]);
        } catch (\Exception $e) {
            // Expired temporary file (runImportCommit, code 410) - everything else is logged + 500.
            if ($e instanceof \RuntimeException && $e->getCode() === 410) {
                return response()->json(['message' => $e->getMessage()], 410);
            }
            $this->logAction($request, ShopLog::class, 'error', 'ShopSupplier', "Error during import: " . $e->getMessage());
            return response()->json(['message' => 'Import failed.'], 500);
        }
    }
}
