<?php
/**
 * @file WebNewsController.php
 * @path app/Http/Controllers/Api/Web/WebNewsController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages news article lifecycle, including categorization, content management, and soft-delete administrative workflows.
 *
 * @refactor-note (2026-08-6) LOGGING MIGRATION to shared `LogsActivity` trait instead
 * of local duplicate logAction(). Domain unchanged (WebLog::class).
 *
 * @bugfix-note (2026-08-15) CRITICAL FILTER FIX: `index()` did not process
 * filters `id` and `title` at all, despite `NEWS_FILTER_COLUMNS` (frontend) offering
 * them. Added `id` (exact match) and `title` (partial match via LIKE, consistent
 * with `author`).
 *
 * @refactor-note (2026-08-23a) BULK DELETION IN A SINGLE REQUEST: added `bulkDestroy()`
 * - see TableBuilderComponent.onBulkDeleteClick() on frontend (calls
 * POST web/news/bulk-delete). `destroy()` has no side effects on files/other
 * tables (no attachments) - the only difference from generic `Model::destroy($ids)` is
 * the need to explicitly call `forceDelete()` for the `force_delete=true` branch.
 *
 * @refactor-note (2026-08-23b) BULK IMPORT (importTemplate/importValidate/
 * importCommit) - SIMPLEST case so far: `store()` has no file upload,
 * no automated logic - it's a pure `WebNews::create($request->validated())`.
 * `IMPORTABLE_COLUMNS` corresponds 1:1 to ALL fields in `StoreWebNewsRequest::rules()`.
 *
 * @refactor-note (2026-08-31) BACKLOG "orphaned import files": import
 * validate/commit flow rewritten to shared `HandlesImportBatches` trait - previously
 * missing `Storage::delete($batch->temp_path)` in `catch` branch of `importCommit()`
 * (even after failed import, temporary file remained on disk forever), now
 * guaranteed by `try/finally` inside `runImportCommit()`, not manual deletion here.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebNews;
use App\Models\Web\WebLog;
use App\Http\Resources\Web\WebNewsResource;
use App\Http\Requests\Web\WebNews\StoreWebNewsRequest;
use App\Http\Requests\Web\WebNews\UpdateWebNewsRequest;
use App\Services\Import\ImportFileParser;
use App\Services\Import\ImportRowValidator;
use App\Traits\HandlesImportBatches;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class WebNewsController extends Controller
{
    use LogsActivity;
    use HandlesImportBatches;

    /**
     * @description Columns permitted from the import file - corresponds 1:1 to
     * StoreWebNewsRequest::rules() (no extra fields, no missing ones).
     */
    private const IMPORTABLE_COLUMNS = [
        'title', 'thema', 'author', 'message', 'bullet_1', 'bullet_2', 'bullet_3', 'bullet_4',
    ];

    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebNews::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('title', 'like', "%$s%")
                ->orWhere('author', 'like', "%$s%")
                ->orWhere('message', 'like', "%$s%"));
        }

        if ($request->filled('id')) {
            $query->where('id', $request->input('id'));
        }
        if ($request->filled('title')) {
            $query->where('title', 'like', '%' . $request->input('title') . '%');
        }

        if ($request->filled('thema')) {
            $query->where('thema', $request->thema);
        }

        if ($request->filled('author')) {
            $query->where('author', 'like', '%' . $request->author . '%');
        }

        $sortBy = $request->input('sort_by', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        $data = $noPagination ? $query->get() : $query->paginate($perPage);

        if ($noPagination) {
            return WebNewsResource::collection($data);
        }

        return response()->json([
            'data'         => WebNewsResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    public function store(StoreWebNewsRequest $request): JsonResponse
    {
        try {
            $news = WebNews::create($request->validated());

            $this->logAction($request, WebLog::class, 'create', 'WebNews', "News item created: {$news->title}", $news->id, 'WebNews');

            return response()->json(new WebNewsResource($news), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Error creating news item: " . $e->getMessage());
            return response()->json(['message' => 'News creation failed.'], 500);
        }
    }

    public function show($id): JsonResponse
    {
        $news = WebNews::withTrashed()->findOrFail($id);
        return response()->json(new WebNewsResource($news));
    }

    public function update(UpdateWebNewsRequest $request, $id): JsonResponse
    {
        try {
            $news = WebNews::findOrFail($id);

            $news->update($request->validated());

            $this->logAction($request, WebLog::class, 'update', 'WebNews', "News item updated: {$news->title}", $news->id, 'WebNews');

            return response()->json(new WebNewsResource($news));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Error updating news item ID {$id}: " . $e->getMessage(), (int) $id, 'WebNews');
            return response()->json(['message' => 'News update failed.'], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $news = WebNews::withTrashed()->findOrFail($id);
            $title = $news->title;

            $forceDelete ? $news->forceDelete() : $news->delete();

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebNews', "Deleted news item: $title", (int) $id, 'WebNews');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Error deleting news item ID $id: " . $e->getMessage(), (int) $id, 'WebNews');
            return response()->json(['message' => 'News deletion failed.'], 500);
        }
    }

    /**
     * @description Bulk deletes selected news items in a single request - see
     * TableBuilderComponent.onBulkDeleteClick() on frontend (calls
     * POST web/news/bulk-delete).
     * @param Request $request Body contains { ids: number[], force_delete?: boolean }.
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
                $items = WebNews::withTrashed()->whereIn('id', $ids)->get();

                foreach ($items as $item) {
                    $forceDelete ? $item->forceDelete() : $item->delete();
                    $deletedCount++;
                }
            });
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Error during bulk deletion of news items: " . $e->getMessage());
            return response()->json(['message' => 'Bulk deletion failed.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebNews',
            'Bulk ' . ($forceDelete ? 'permanent ' : '') . "deletion of {$deletedCount} news items (requested {$requestedCount}, IDs: {$idsPreview}).",
            null,
            'WebNews'
        );
        return response()->json(['data' => [
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]]);
    }

    /**
     * @description Downloads an empty import template (CSV/TXT/JSON) with columns
     * from IMPORTABLE_COLUMNS.
     */
    public function importTemplate(Request $request)
    {
        $format = (string) $request->query('format', 'csv');
        if (!in_array($format, ['csv', 'json', 'txt'], true)) {
            return response()->json(['message' => 'Unsupported template format.'], 422);
        }

        $columns = self::IMPORTABLE_COLUMNS;
        $baseFilename = 'import-template-web-news';

        if ($format === 'csv' || $format === 'txt') {
            $delimiter = $format === 'txt' ? "\t" : ';';
            $mime = $format === 'txt' ? 'text/plain' : 'text/csv';
            return response(implode($delimiter, $columns) . "\n", 200, [
                'Content-Type'        => "{$mime}; charset=UTF-8",
                'Content-Disposition' => "attachment; filename=\"{$baseFilename}.{$format}\"",
            ]);
        }

        $example = array_fill_keys($columns, '');
        return response(json_encode([$example], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), 200, [
            'Content-Type'        => 'application/json; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$baseFilename}.json\"",
        ]);
    }

    /**
     * @description Dry-run validation of the import file - DOES NOT write anything to DB.
     * @refactor-note (2026-08-31) File storage + creation of CoreImportBatch now goes
     * through `startImportBatch()` (HandlesImportBatches trait) instead of manual
     * `Storage::put()`/`CoreImportBatch::create()`.
     */
    public function importValidate(
        Request $request,
        ImportFileParser $parser,
        ImportRowValidator $rowValidator
    ): JsonResponse {
        $validated = $request->validate([
            'format' => ['required', 'string', 'in:csv,json,txt'],
            'file'   => ['required', 'file', 'max:10240'],
        ]);

        try {
            $parsed = $parser->parse($request->file('file'), $validated['format'], self::IMPORTABLE_COLUMNS, 20000);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $rules = $rowValidator->buildRules(StoreWebNewsRequest::class, self::IMPORTABLE_COLUMNS);

        $validRows = [];
        $invalidCount = 0;
        $errors = [];
        foreach ($parsed['rows'] as $i => $row) {
            $rowErrors = $rowValidator->validateRow($row, $rules);
            if ($rowErrors === null) {
                $validRows[$i] = $row;
            } else {
                $invalidCount++;
                if (count($errors) < 200) {
                    $errors[] = ['row' => $i + 2, 'errors' => $rowErrors];
                }
            }
        }

        $batch = $this->startImportBatch(
            $request,
            'web/news',
            $validated['format'],
            count($parsed['rows']),
            count($validRows),
            $invalidCount,
            $errors
        );

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
     * @description Confirms and executes the actual import write. Re-parses and validates
     * the file (never trusts dry-run result without verification).
     * @refactor-note (2026-08-31) Rewritten to `findPendingImportBatch()` +
     * `runImportCommit()` (HandlesImportBatches trait) - temporary file is now deleted
     * ALWAYS (even on failure), see trait header. `catch` block here remains only for
     * handling HTTP response (error message/status code), NOT for file deletion -
     * that is ensured by `finally` inside `runimportCommit()` regardless of whether
     * we reach here at all.
     */
    public function importCommit(
        Request $request,
        ImportFileParser $parser,
        ImportRowValidator $rowValidator
    ): JsonResponse {
        $validated = $request->validate(['import_token' => ['required', 'integer']]);
        $batch = $this->findPendingImportBatch($request, $validated['import_token']);

        if ($batch === null) {
            return response()->json(['message' => 'Import not found or already processed.'], 404);
        }

        try {
            $result = $this->runImportCommit($batch, function ($uploadedFile) use ($parser, $rowValidator, $batch) {
                $parsed = $parser->parse($uploadedFile, $batch->format, self::IMPORTABLE_COLUMNS, 20000);
                $rules = $rowValidator->buildRules(StoreWebNewsRequest::class, self::IMPORTABLE_COLUMNS);

                $imported = 0;
                DB::transaction(function () use ($parsed, $rules, $rowValidator, &$imported) {
                    foreach ($parsed['rows'] as $row) {
                        if ($rowValidator->validateRow($row, $rules) !== null) {
                            continue;
                        }
                        WebNews::create(array_intersect_key($row, array_flip(self::IMPORTABLE_COLUMNS)));
                        $imported++;
                    }
                });

                return [
                    'imported_count' => $imported,
                    'skipped_count'  => count($parsed['rows']) - $imported,
                ];
            });

            $this->logAction(
                $request,
                WebLog::class,
                'import',
                'WebNews',
                "Bulk import: added {$result['imported_count']} news items, skipped {$result['skipped_count']} (file '{$batch->original_filename}').",
                null,
                'WebNews'
            );

            return response()->json(['data' => [
                'queued'         => false,
                'imported_count' => $result['imported_count'],
                'skipped_count'  => $result['skipped_count'],
                'skip_reasons'   => [],
            ]]);
        } catch (\RuntimeException $e) {
            // Expired temporary file - see runImportCommit(), code 410.
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 500);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Error during import: " . $e->getMessage());
            return response()->json(['message' => 'Import failed.'], 500);
        }
    }

    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $news = WebNews::withTrashed()->findOrFail($id);
            $news->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebNews', "Restored news item: {$news->title}", $news->id, 'WebNews');

            return response()->json(new WebNewsResource($news));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Error restoring news item ID $id: " . $e->getMessage(), (int) $id, 'WebNews');
            return response()->json(['message' => 'News restoration failed.'], 500);
        }
    }

    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $count = WebNews::onlyTrashed()->count();
            WebNews::onlyTrashed()->forceDelete();

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebNews', "Emptied news trash. Count: $count");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Error emptying news trash: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }
}