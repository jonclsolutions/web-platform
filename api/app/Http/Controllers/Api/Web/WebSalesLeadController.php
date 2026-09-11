<?php
/**
 * @file WebSalesLeadController.php
 * @path app/Http/Controllers/Api/Web/WebSalesLeadController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Controller responsible for managing sales lead lifecycle, including filtering, lifecycle state management (soft-delete), and comprehensive administrative audit logging.
 * @refactor-note (2026) Added generateLink() and showByToken().
 * @refactor-note (2026-08-6) LOGGING MIGRATION to shared LogsActivity trait.
 *
 * @refactor-note (2026-08-23a) BULK DELETE IN A SINGLE REQUEST: added bulkDestroy().
 *
 * @refactor-note (2026-08-23b) BULK IMPORT - two intentional deviations from store():
 * 1) `user_id` is NOT an importable field - always remains `null` for imported leads.
 * 2) `salesman_name` is TAKEN FROM THE FILE unchanged.
 * `public_token`/`public_token_used_at` remain OUTSIDE the import.
 *
 * @bugfix-note (2026-08-24) `showByToken()` now writes `sales_lead_token_invalid`
 * to core_security_events for both invalid and already used tokens.
 *
 * @refactor-note (2026-08-31) BACKLOG "orphaned import files": import
 * validate/commit flow rewritten to shared `HandlesImportBatches` trait - previously
 * `Storage::delete($batch->temp_path)` was missing in the `catch` branch of importCommit()
 * (even after a failed import, the temporary file remained on disk forever), now this is
 * guaranteed by `try/finally` inside `runImportCommit()`, no manual deletion here.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebSalesLead;
use App\Models\Web\WebLog;
use App\Models\Core\CoreSecurityEvent;
use App\Traits\HandlesImportBatches;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Requests\Web\WebSalesLead\StoreWebSalesLeadRequest;
use App\Http\Resources\Web\WebSalesLeadResource;
use App\Services\Import\ImportFileParser;
use App\Services\Import\ImportRowValidator;
use Illuminate\Support\Facades\DB;

/**
 * @description Manages sales lead data operations within the CRM subsystem.
 * @note Implements logging for all data mutations and export operations to ensure accountability.
 */
class WebSalesLeadController extends Controller
{
    use LogsActivity;
    use HandlesImportBatches;

    /**
     * @description Columns allowed to come from the import file - all fields from
     * StoreWebSalesLeadRequest EXCEPT `user_id` (see refactor-note in class header).
     */
    private const IMPORTABLE_COLUMNS = [
        'subject_name', 'first_contact_date', 'source_channel', 'salesman_name',
        'contact_person', 'contact_email', 'contact_phone', 'contact_other',
        'location', 'source_url', 'description', 'priority', 'status',
        'last_contact_date', 'next_step', 'rejection_reason',
    ];

    /**
     * Retrieves a list of sales leads based on filtering and pagination criteria.
     */
    /**
     * @refactor-note (2026-08-25) BACKLOG "search across everything": `search` extended with
     * `contact_phone`, `location`, `salesman_name`.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebSalesLead::query();

        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('subject_name', 'like', "%$s%")
                ->orWhere('contact_person', 'like', "%$s%")
                ->orWhere('contact_email', 'like', "%$s%")
                ->orWhere('description', 'like', "%$s%")
                ->orWhere('contact_phone', 'like', "%$s%")
                ->orWhere('location', 'like', "%$s%")
                ->orWhere('salesman_name', 'like', "%$s%"));
        }

        foreach (['id', 'status', 'priority', 'source_channel'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        foreach (['subject_name', 'contact_person', 'contact_email', 'contact_phone', 'location', 'salesman_name'] as $f) {
            if ($request->filled($f)) $query->where($f, 'like', '%' . $request->input($f) . '%');
        }

        if ($request->filled('created_at')) $query->whereDate('created_at', $request->created_at);
        if ($request->filled('last_contact_date')) $query->whereDate('last_contact_date', $request->last_contact_date);

        $sortBy = $request->input('sort_by', 'created_at');
        $sortDirection = in_array(strtolower($request->input('sort_direction')), ['asc', 'desc'])
            ? $request->input('sort_direction')
            : 'desc';

        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, WebLog::class, 'export', 'WebSalesLead', "Bulk export of sales leads.");
            $data = $query->get();
            return response()->json(WebSalesLeadResource::collection($data));
        }

        $data = $query->paginate($perPage);

        return response()->json([
            'data'         => WebSalesLeadResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Persists a new sales lead, assigning default owner data if available.
     */
    public function store(StoreWebSalesLeadRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $user = $request->user() ?? auth('sanctum')->user();

            if (empty($validated['salesman_name']) && $user) {
                $validated['salesman_name'] = $user->full_name ?? $user->user_email;
            }

            if (empty($validated['user_id']) && $user) {
                $validated['user_id'] = $user->id;
            }

            $lead = WebSalesLead::create($validated);

            $this->logAction($request, WebLog::class, 'create', 'WebSalesLead', "Created new lead: {$lead->subject_name}", $lead->id, 'WebSalesLead');

            return response()->json(new WebSalesLeadResource($lead), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error creating lead: " . $e->getMessage());
            return response()->json(['message' => 'Lead creation failed.'], 500);
        }
    }

    /**
     * Retrieves the details of a single lead.
     */
    public function show($id): JsonResponse
    {
        $lead = WebSalesLead::withTrashed()->findOrFail($id);
        return response()->json(new WebSalesLeadResource($lead));
    }

    /**
     * Updates an existing sales lead record.
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $lead = WebSalesLead::findOrFail($id);
            $lead->update($request->all());

            $this->logAction($request, WebLog::class, 'update', 'WebSalesLead', "Updated lead ID: {$lead->id} ({$lead->subject_name})", $lead->id, 'WebSalesLead');

            return response()->json(new WebSalesLeadResource($lead));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error updating lead ID {$id}: " . $e->getMessage(), (int) $id, 'WebSalesLead');
            return response()->json(['message' => 'Lead update failed.'], 500);
        }
    }

    /**
     * Deletes a lead (Soft or Hard).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebSalesLead::withTrashed()->findOrFail($id);

            $forceDelete ? $item->forceDelete() : $item->delete();

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSalesLead', "Deleted lead ID: $id", (int) $id, 'WebSalesLead');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error deleting lead ID $id: " . $e->getMessage(), (int) $id, 'WebSalesLead');
            return response()->json(['message' => 'Lead deletion failed.'], 500);
        }
    }

    /**
     * @description Bulk deletes selected leads in a single request.
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
                $items = WebSalesLead::withTrashed()->whereIn('id', $ids)->get();

                foreach ($items as $item) {
                    $forceDelete ? $item->forceDelete() : $item->delete();
                    $deletedCount++;
                }
            });
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error during bulk deletion of leads: " . $e->getMessage());
            return response()->json(['message' => 'Bulk deletion failed.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebSalesLead',
            'Bulk ' . ($forceDelete ? 'permanent ' : '') . "deletion of {$deletedCount} leads (requested {$requestedCount}, IDs: {$idsPreview}).",
            null,
            'WebSalesLead'
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
        $baseFilename = 'import-template-web-sales_leads';

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
     * @refactor-note (2026-08-31) File storage + CoreImportBatch creation now goes
     * through `startImportBatch()` (HandlesImportBatches trait).
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

        $rules = $rowValidator->buildRules(StoreWebSalesLeadRequest::class, self::IMPORTABLE_COLUMNS);

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
            'web/sales_leads',
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
     * @description Confirms and executes the actual import write. DOES NOT CALL store() - no
     * automatic user_id/salesman_name assignment based on the logged-in admin.
     * @refactor-note (2026-08-31) Rewritten to `findPendingImportBatch()` +
     * `runImportCommit()` (HandlesImportBatches trait) - temporary file is now deleted
     * ALWAYS (even on failure), see trait header.
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
                $rules = $rowValidator->buildRules(StoreWebSalesLeadRequest::class, self::IMPORTABLE_COLUMNS);

                $imported = 0;
                DB::transaction(function () use ($parsed, $rules, $rowValidator, &$imported) {
                    foreach ($parsed['rows'] as $row) {
                        if ($rowValidator->validateRow($row, $rules) !== null) {
                            continue;
                        }
                        // user_id INTENTIONALLY missing from IMPORTABLE_COLUMNS - array_intersect_key
                        // will thus never take it from $row.
                        WebSalesLead::create(array_intersect_key($row, array_flip(self::IMPORTABLE_COLUMNS)));
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
                'WebSalesLead',
                "Bulk import: added {$result['imported_count']} leads, skipped {$result['skipped_count']} (file '{$batch->original_filename}').",
                null,
                'WebSalesLead'
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
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error during import: " . $e->getMessage());
            return response()->json(['message' => 'Import failed.'], 500);
        }
    }

    /**
     * Restores a soft-deleted lead.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebSalesLead::withTrashed()->findOrFail($id);
            $item->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebSalesLead', "Restored lead ID: $id", (int) $id, 'WebSalesLead');

            return response()->json(new WebSalesLeadResource($item));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error restoring lead ID $id: " . $e->getMessage(), (int) $id, 'WebSalesLead');
            return response()->json(['message' => 'Lead restoration failed.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted records.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $count = WebSalesLead::onlyTrashed()->count();
            WebSalesLead::onlyTrashed()->forceDelete();

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebSalesLead', "Emptied lead trash. Count: $count");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error emptying lead trash: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }

    /**
     * @description Generates (or returns existing) public_token for the given lead and builds
     *              the full public URL for the order form from it.
     * @note ADMIN endpoint - must remain behind AuthGuard/Sanctum middleware in routes/api.php.
     */
    public function generateLink(Request $request, $id): JsonResponse
    {
        try {
            $lead = WebSalesLead::findOrFail($id);
            $token = $lead->getOrCreatePublicToken();

            $this->logAction($request, WebLog::class, 'generate_link', 'WebSalesLead', "Generated order form link for lead ID: {$lead->id}", $lead->id, 'WebSalesLead');

            return response()->json([
                'data' => [
                    'token' => $token,
                    'url'   => rtrim(config('app.frontend_url', $request->getSchemeAndHttpHost()), '/') . "/order_form/{$token}",
                ],
            ]);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error generating link for lead ID {$id}: " . $e->getMessage(), (int) $id, 'WebSalesLead');
            return response()->json(['message' => 'Link generation failed.'], 500);
        }
    }

    /**
     * @description PUBLIC method (without auth) to load a lead by public_token -
     *              used by OrderFormComponent on the frontend to prefill the order
     *              form. Returns only a narrow, secure subset of fields.
     * @note Must be registered in routes/api.php OUTSIDE the auth middleware group.
     * @note Returns 410 Gone if the link has already been used once.
     */
    public function showByToken(Request $request, string $token): JsonResponse
    {
        $lead = WebSalesLead::where('public_token', $token)->first();

        if (!$lead) {
            CoreSecurityEvent::record(
                'sales_lead_token_invalid',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['reason' => 'not_found'])
            );

            return response()->json(['message' => 'The link is invalid or has expired.'], 404);
        }

        if ($lead->public_token_used_at) {
            CoreSecurityEvent::record(
                'sales_lead_token_invalid',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['reason' => 'already_used', 'lead_id' => $lead->id])
            );

            return response()->json(['message' => 'This form has already been submitted once and the link cannot be used again.'], 410);
        }

        return response()->json([
            'id'             => $lead->id,
            'subject_name'   => $lead->subject_name,
            'contact_person' => $lead->contact_person,
            'contact_email'  => $lead->contact_email,
            'contact_phone'  => $lead->contact_phone,
        ]);
    }
}