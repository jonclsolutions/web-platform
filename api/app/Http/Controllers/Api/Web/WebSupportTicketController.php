<?php
/**
 * @file WebSupportTicketController.php
 * @path app/Http/Controllers/Api/Web/WebSupportTicketController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manages the support ticket lifecycle, including creation, status tracking, file attachment management, and audit logging.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebSupportTicket;
use App\Models\Web\WebLog;
use App\Http\Requests\Web\WebSupportTicket\StoreWebSupportTicketRequest;
use App\Http\Requests\Web\WebSupportTicket\UpdateWebSupportTicketRequest;
use App\Http\Resources\Web\WebSupportTicketResource;
use App\Services\Import\ImportFileParser;
use App\Services\Import\ImportRowValidator;
use App\Traits\HandlesAttachments;
use App\Traits\HandlesImportBatches;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Traits\AppliesSafeSorting;

/**
 * @description Controller responsible for processing customer support tickets.
 * @note Supports soft-delete operations and persistent file storage (via HandlesAttachments) for ticket attachments.
 */
class WebSupportTicketController extends Controller
{
    use HandlesAttachments, AppliesSafeSorting;
    use HandlesImportBatches;
    use LogsActivity;

    /**
     * Storage folder for ticket attachments within the private disk.
     */
    private const ATTACHMENT_FOLDER = 'web/tickets';

    /**
     * @description Columns an import file may contain. `attachment` (a file) and `user_id` (a
     * real account link) are left out on purpose.
     */
    private const IMPORTABLE_COLUMNS = [
        'user_name_plain', 'user_plain', 'category', 'subject', 'description', 'priority', 'state',
    ];

    /**
     * Retrieves a paginated list of support tickets based on filters and sorting criteria.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebSupportTicket::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('subject', 'like', "%$s%")
                ->orWhere('description', 'like', "%$s%")
                ->orWhere('user_plain', 'like', "%$s%"));
        }

        foreach (['id', 'priority', 'category'] as $f) {
            if ($request->filled($f)) {
                $query->where($f, $request->input($f));
            }
        }
        if ($request->filled('status')) {
            $query->where('state', $request->input('status'));
        }
        $this->applySorting($query, $request, 'created_at', 'desc');

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, WebLog::class, 'export', 'WebSupportTicket', "Bulk export of support tickets.");
            $data = $query->get();
            return $this->respond(WebSupportTicketResource::collection($data));
        }

        $data = $query->paginate($perPage);

        return $this->respondPaginated($data, WebSupportTicketResource::class);
    }

    /**
     * Stores a new support ticket and handles the optional file attachment.
     */
    public function store(StoreWebSupportTicketRequest $request): JsonResponse
    {
        try {
            $data = $request->validated();
            unset($data['attachment']);

            $user = $request->user() ?? auth('sanctum')->user();

            if ($user) {
                $data['user_id'] = $user->id;
                $data['user_name_plain'] = $data['user_name_plain'] ?? ($user->full_name ?? $user->user_email);
                $data['user_plain'] = $data['user_plain'] ?? $user->user_email;
            }

            $ticket = WebSupportTicket::create($data);

            $this->storeSingleAttachment($request, $ticket, self::ATTACHMENT_FOLDER, 'attachment');

            $this->logAction($request, WebLog::class, 'create', 'WebSupportTicket', "New ticket: {$ticket->subject}", $ticket->id, 'WebSupportTicket');

            return $this->respond(new WebSupportTicketResource($ticket->load('attachments')), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Error creating ticket: " . $e->getMessage());
            return response()->json(['message' => 'Ticket creation failed.'], 500);
        }
    }

    /**
     * Retrieves a single support ticket by ID, including soft-deleted items.
     */
    public function show($id): JsonResponse
    {
        $supportTicket = WebSupportTicket::withTrashed()->with('attachments')->findOrFail($id);
        return $this->respond(new WebSupportTicketResource($supportTicket));
    }

    /**
     * Updates an existing support ticket and manages attachment replacement.
     */
    public function update(UpdateWebSupportTicketRequest $request, $id): JsonResponse
    {
        $ticket = WebSupportTicket::withTrashed()->findOrFail($id);

        try {
            $validated = $request->validated();
            unset($validated['attachment']);

            $ticket->update($validated);

            $this->storeSingleAttachment($request, $ticket, self::ATTACHMENT_FOLDER, 'attachment');

            $this->logAction($request, WebLog::class, 'update', 'WebSupportTicket', "Update ticket ID: {$id}", (int) $id, 'WebSupportTicket');

            return $this->respond(new WebSupportTicketResource($ticket->fresh()->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Error updating ticket ID {$id}: " . $e->getMessage(), (int) $id, 'WebSupportTicket');
            return response()->json(['message' => 'Ticket update failed.'], 500);
        }
    }

    /**
     * Deletes a support ticket (Soft or Hard).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $item = WebSupportTicket::withTrashed()->with('attachments')->findOrFail($id);

        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);

            if ($forceDelete) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSupportTicket', "Delete ticket ID: $id", (int) $id, 'WebSupportTicket');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Error deleting ticket ID $id: " . $e->getMessage(), (int) $id, 'WebSupportTicket');
            return response()->json(['message' => 'Ticket deletion failed.'], 500);
        }
    }

    /**
     * @description Deletes the selected tickets in ONE request (TableBuilderComponent
     * onBulkDeleteClick() → POST web/support_tickets/bulk-delete). Repeats the logic of
     * destroy() (attachment removed from the disk on force_delete=true) instead of a generic
     * Model::destroy($ids), which would leave orphaned files.
     * @param Request $request Body `{ ids: number[], force_delete?: boolean }`.
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
                $items = WebSupportTicket::withTrashed()->with('attachments')->whereIn('id', $ids)->get();

                foreach ($items as $item) {
                    if ($forceDelete) {
                        $this->deleteAllAttachments($item);
                        $item->forceDelete();
                    } else {
                        $item->delete();
                    }
                    $deletedCount++;
                }
            });
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Error during bulk deletion of tickets: " . $e->getMessage());
            return response()->json(['message' => 'Bulk deletion failed.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebSupportTicket',
            'Bulk ' . ($forceDelete ? 'permanent ' : '') . "deletion of {$deletedCount} tickets (requested {$requestedCount}, IDs: {$idsPreview}).",
            null,
            'WebSupportTicket'
        );

        return $this->respond([
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]);
    }

    /**
     * @description Downloads an empty import template (CSV / TXT / JSON) with the columns of
     * IMPORTABLE_COLUMNS. CSV / TXT use the same separator as TableBuilderComponent
     * downloadCsv() / downloadTxt() (semicolon / tab).
     */
    public function importTemplate(Request $request)
    {
        $format = (string) $request->query('format', 'csv');
        if (!in_array($format, ['csv', 'json', 'txt'], true)) {
            return response()->json(['message' => 'Unsupported template format.'], 422);
        }

        $columns = self::IMPORTABLE_COLUMNS;
        $baseFilename = 'import-template-web-support_tickets';

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
     * @description Import validation rules: the rules of the Store request (ImportRowValidator)
     * PLUS a rule for `state`, which the Store request does not know.
     */
    private function buildImportRules(ImportRowValidator $rowValidator): array
    {
        $rules = $rowValidator->buildRules(StoreWebSupportTicketRequest::class, self::IMPORTABLE_COLUMNS);
        $rules['state'] = ['sometimes', 'nullable', 'string', 'in:new,open,closed'];
        return $rules;
    }

    /**
     * @description Dry-run validation of an import file - writes NOTHING to the database.
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

        $rules = $this->buildImportRules($rowValidator);

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
            'web/support_tickets',
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
     * @description Confirms and writes the import. Does NOT call store(): no automatic
     * assignment to the logged-in admin, no attachment; `state` defaults to 'new' when the file
     * has none (same as the database default of a normal create).
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
                $rules = $this->buildImportRules($rowValidator);

                $imported = 0;
                DB::transaction(function () use ($parsed, $rules, $rowValidator, &$imported) {
                    foreach ($parsed['rows'] as $row) {
                        if ($rowValidator->validateRow($row, $rules) !== null) {
                            continue;
                        }

                        $safeData = array_intersect_key($row, array_flip(self::IMPORTABLE_COLUMNS));
                        // Empty / missing 'state' -> 'new', same as the database default of a normal store()
                        // (which never sends 'state').
                        if (empty($safeData['state'])) {
                            $safeData['state'] = 'new';
                        }

                        WebSupportTicket::create($safeData);
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
                'WebSupportTicket',
                "Bulk import: added {$result['imported_count']} tickets, skipped {$result['skipped_count']} (file '{$batch->original_filename}').",
                null,
                'WebSupportTicket'
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
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Error during import: " . $e->getMessage());
            return response()->json(['message' => 'Import failed.'], 500);
        }
    }

    /**
     * Restores a soft-deleted support ticket.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $item = WebSupportTicket::withTrashed()->findOrFail($id);

        try {
            $item->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebSupportTicket', "Restore ticket ID: $id", (int) $id, 'WebSupportTicket');
            return $this->respond(new WebSupportTicketResource($item->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Error restoring ticket ID $id: " . $e->getMessage(), (int) $id, 'WebSupportTicket');
            return response()->json(['message' => 'Ticket restoration failed.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted tickets and associated files.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashed = WebSupportTicket::onlyTrashed()->with('attachments')->get();
            $count = $trashed->count();

            foreach ($trashed as $ticket) {
                $this->deleteAllAttachments($ticket);
                $ticket->forceDelete();
            }

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebSupportTicket', "Bulk delete of ticket trash. Count: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Error emptying ticket trash: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }
}