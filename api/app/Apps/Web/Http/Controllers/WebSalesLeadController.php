<?php
/**
 * @file WebSalesLeadController.php
 * @path app/Apps/Web/Http/Controllers/WebSalesLeadController.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Controller responsible for managing sales lead lifecycle, including filtering, lifecycle state management (soft-delete), and comprehensive administrative audit logging.
 */

namespace App\Apps\Web\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\Web\Models\WebSalesLead;
use App\Apps\Web\Models\WebLog;
use App\Models\Core\CoreSecurityEvent;
use App\Traits\HandlesImportBatches;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Apps\Web\Http\Requests\WebSalesLead\StoreWebSalesLeadRequest;
use App\Apps\Web\Http\Requests\WebSalesLead\UpdateWebSalesLeadRequest;
use App\Apps\Web\Http\Resources\WebSalesLeadResource;
use App\Services\Import\ImportFileParser;
use App\Services\Import\ImportRowValidator;
use Illuminate\Support\Facades\DB;
use App\Traits\AppliesSafeSorting;

/**
 * @description Manages sales lead data operations within the CRM subsystem.
 * @note Implements logging for all data mutations and export operations to ensure accountability.
 */
class WebSalesLeadController extends Controller
{
    use LogsActivity, AppliesSafeSorting;
    use HandlesImportBatches;

    /**
     * @description Columns allowed to come from the import file - all fields from
     * StoreWebSalesLeadRequest EXCEPT `user_id`.
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

        $this->applySorting($query, $request, 'created_at', 'desc');

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, WebLog::class, 'export', 'WebSalesLead', "Bulk export of sales leads.");
            $data = $query->get();
            return $this->respond(WebSalesLeadResource::collection($data));
        }

        $data = $query->paginate($perPage);

        return $this->respondPaginated($data, WebSalesLeadResource::class);
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

            return $this->respond(new WebSalesLeadResource($lead), 201);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
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
        return $this->respond(new WebSalesLeadResource($lead));
    }

    /**
     * Updates an existing sales lead record.
     */
    public function update(UpdateWebSalesLeadRequest $request, $id): JsonResponse
    {
        $lead = WebSalesLead::findOrFail($id);

        try {
            $lead->update($request->validated());

            $this->logAction($request, WebLog::class, 'update', 'WebSalesLead', "Updated lead ID: {$lead->id} ({$lead->subject_name})", $lead->id, 'WebSalesLead');

            return $this->respond(new WebSalesLeadResource($lead));
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error updating lead ID {$id}: " . $e->getMessage(), (int) $id, 'WebSalesLead');
            return response()->json(['message' => 'Lead update failed.'], 500);
        }
    }

    /**
     * Deletes a lead (Soft or Hard).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $item = WebSalesLead::withTrashed()->findOrFail($id);

        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);

            $forceDelete ? $item->forceDelete() : $item->delete();

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSalesLead', "Deleted lead ID: $id", (int) $id, 'WebSalesLead');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
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
            report($e); // full detail (class, file, trace) to the core log
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

        return $this->respond([
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]);
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

        return $this->respond([
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

            return $this->respond([
                'queued'         => false,
                'imported_count' => $result['imported_count'],
                'skipped_count'  => $result['skipped_count'],
                'skip_reasons'   => [],
            ]);
        } catch (\Exception $e) {
            // Expired temporary file - see runImportCommit(), code 410.
            if ($e instanceof \RuntimeException && $e->getCode() === 410) {
                return response()->json(['message' => $e->getMessage()], 410);
            }
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error during import: " . $e->getMessage());
            return response()->json(['message' => 'Import failed.'], 500);
        }
    }

    /**
     * Restores a soft-deleted lead.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $item = WebSalesLead::withTrashed()->findOrFail($id);

        try {
            $item->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebSalesLead', "Restored lead ID: $id", (int) $id, 'WebSalesLead');

            return $this->respond(new WebSalesLeadResource($item));
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
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
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error emptying lead trash: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }

    /**
     * @description Generates (or returns existing) public_token for the given lead and builds
     *              the full public URL for the order form from it. Every call starts the validity
     *              of an unused link again (WebSalesLead::PUBLIC_TOKEN_TTL_DAYS).
     * @note ADMIN endpoint - must remain behind AuthGuard/Sanctum middleware in routes/api.php.
     */
    public function generateLink(Request $request, $id): JsonResponse
    {
        $lead = WebSalesLead::findOrFail($id);

        try {
            $token = $lead->getOrCreatePublicToken();

            $this->logAction($request, WebLog::class, 'generate_link', 'WebSalesLead', "Generated order form link for lead ID: {$lead->id}", $lead->id, 'WebSalesLead');

            return $this->respond([
                    'token'      => $token,
                    'url'        => rtrim(config('app.frontend_url', $request->getSchemeAndHttpHost()), '/') . "/order_form/{$token}",
                    'expires_at' => $lead->public_token_used_at ? null : $lead->public_token_expires_at?->toIso8601String(),
                ]);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Error generating link for lead ID {$id}: " . $e->getMessage(), (int) $id, 'WebSalesLead');
            return response()->json(['message' => 'Link generation failed.'], 500);
        }
    }

    /**
     * @description PUBLIC method (without auth) to load a lead by public_token -
     *              used by OrderFormComponent on the frontend to prefill the order
     *              form. Returns only a narrow, secure subset of fields.
     * @note Must be registered in routes/api.php OUTSIDE the auth middleware group.
     * @note Returns 410 Gone if the link has already been used once, and 410 with error_code
     *       LINK_EXPIRED after its validity (WebSalesLead::PUBLIC_TOKEN_TTL_DAYS).
     * @security No internal `id` in the answer (the form is bound to the lead by the token only)
     * and the route is throttled (30 / minute per IP).
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

        if ($lead->publicTokenExpired()) {
            CoreSecurityEvent::record(
                'sales_lead_token_invalid',
                'info',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['reason' => 'expired', 'lead_id' => $lead->id])
            );

            return response()->json(['message' => 'The link has expired.', 'error_code' => 'LINK_EXPIRED'], 410);
        }

        return $this->respond([
            'subject_name'   => $lead->subject_name,
            'contact_person' => $lead->contact_person,
            'contact_email'  => $lead->contact_email,
            'contact_phone'  => $lead->contact_phone,
        ]);
    }
}