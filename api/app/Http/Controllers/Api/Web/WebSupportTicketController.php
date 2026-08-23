<?php
/**
 * @file WebSupportTicketController.php
 * @path app/Http/Controllers/Api/Web/WebSupportTicketController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the support ticket lifecycle, including creation, status tracking, file attachment management, and audit logging.
 * @refactor-note (2026-08-2) Attachment storage moved to the polymorphic web_attachments table.
 * @refactor-note (2026-08-6) MIGRACE LOGOVANI na sdileny LogsActivity trait misto
 * lokalni duplicitni logAction(). Domenove beze zmeny (WebLog::class).
 *
 * @refactor-note (2026-08-23a) HROMADNE MAZANI V JEDNOM REQUESTU: pridana bulkDestroy() -
 * viz TableBuilderComponent.onBulkDeleteClick() (vola POST web/support_tickets/bulk-delete).
 * ZAMERNE replikuje STEJNOU logiku jako destroy() (uklid prilohy z disku pres
 * deleteAllAttachments() pri force_delete=true), ne genericky Model::destroy($ids).
 *
 * @refactor-note (2026-08-23b) HROMADNY IMPORT (importTemplate/importValidate/
 * importCommit) - stejny per-controller vzor jako WebRawRequestCommissionController.
 * Dve zamerne odchylky od store():
 * 1) `state` (stav tiketu) NENI vubec v StoreWebSupportTicketRequest::rules()
 *    (na store() se nikdy nenastavuje, DB defaultuje na 'new'), ale pro IMPORT
 *    historickych/archivnich ticketu dava smysl umet rovnou nastavit finalni stav
 *    (napr. hromadne naimportovat uz uzavrene stare tickety). Doplneno VLASTNI
 *    validacni pravidlo pro state navic k tomu, co vraci ImportRowValidator::buildRules()
 *    (ta bere jen pravidla, ktera uz Store request zna) - bez tohohle by state
 *    prosel do DB BEZ JAKEKOLIV validace (zadne pravidlo = Laravel ho tise preskoci).
 * 2) Import NEPRIRAZUJE user_id/user_name_plain/user_plain podle prihlaseneho
 *    admina (jak to dela store() pro logged-in uzivatele) - naopak ZACHOVAVA hodnoty
 *    user_name_plain/user_plain primo ze souboru (historicky zadatel), user_id
 *    zustava vzdy null (import nezna realne propojeni na existujici ucet).
 * attachment (upload souboru) neni a nemuze byt soucasti tabulkoveho importu.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebSupportTicket;
use App\Models\Web\WebLog;
use App\Models\Core\CoreImportBatch;
use App\Http\Requests\Web\WebSupportTicket\StoreWebSupportTicketRequest;
use App\Http\Requests\Web\WebSupportTicket\UpdateWebSupportTicketRequest;
use App\Http\Resources\Web\WebSupportTicketResource;
use App\Services\Import\ImportFileParser;
use App\Services\Import\ImportRowValidator;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * @description Controller responsible for processing customer support tickets.
 * @note Supports soft-delete operations and persistent file storage (via HandlesAttachments) for ticket attachments.
 */
class WebSupportTicketController extends Controller
{
    use HandlesAttachments;
    use LogsActivity;

    /**
     * Storage folder for ticket attachments within the public disk.
     */
    private const ATTACHMENT_FOLDER = 'tickets';

    /**
     * @description Sloupce, ktere smi prijit z importniho souboru. attachment (soubor)
     * a user_id (realne propojeni na ucet) jsou ZAMERNE mimo - viz refactor-note
     * v hlavicce tridy.
     */
    private const IMPORTABLE_COLUMNS = [
        'user_name_plain', 'user_plain', 'category', 'subject', 'description', 'priority', 'state',
    ];

    private const TEMP_DISK = 'local';

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
        $sortBy = $request->input('sort_by', 'created_at');
        $direction = strtolower($request->input('sort_direction', 'desc'));
        $sortDirection = in_array($direction, ['asc', 'desc']) ? $direction : 'desc';

        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, WebLog::class, 'export', 'WebSupportTicket', "Hromadný export support ticketů.");
            $data = $query->get();
            return response()->json(WebSupportTicketResource::collection($data));
        }

        $data = $query->paginate($perPage);

        return response()->json([
            'data'         => WebSupportTicketResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
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

            $this->logAction($request, WebLog::class, 'create', 'WebSupportTicket', "Nový ticket: {$ticket->subject}", $ticket->id, 'WebSupportTicket');

            return response()->json(new WebSupportTicketResource($ticket->load('attachments')), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při vytváření ticketu: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření ticketu selhalo.'], 500);
        }
    }

    /**
     * Retrieves a single support ticket by ID, including soft-deleted items.
     */
    public function show($id): JsonResponse
    {
        $supportTicket = WebSupportTicket::withTrashed()->with('attachments')->findOrFail($id);
        return response()->json(new WebSupportTicketResource($supportTicket));
    }

    /**
     * Updates an existing support ticket and manages attachment replacement.
     */
    public function update(UpdateWebSupportTicketRequest $request, $id): JsonResponse
    {
        try {
            $ticket = WebSupportTicket::withTrashed()->findOrFail($id);
            $validated = $request->validated();
            unset($validated['attachment']);

            $ticket->update($validated);

            $this->storeSingleAttachment($request, $ticket, self::ATTACHMENT_FOLDER, 'attachment');

            $this->logAction($request, WebLog::class, 'update', 'WebSupportTicket', "Aktualizace ticketu ID: {$id}", (int) $id, 'WebSupportTicket');

            return response()->json(new WebSupportTicketResource($ticket->fresh()->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při aktualizaci ticketu ID {$id}: " . $e->getMessage(), (int) $id, 'WebSupportTicket');
            return response()->json(['message' => 'Aktualizace ticketu selhala.'], 500);
        }
    }

    /**
     * Deletes a support ticket (Soft or Hard).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebSupportTicket::withTrashed()->with('attachments')->findOrFail($id);

            if ($forceDelete) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSupportTicket', "Smazání ticketu ID: $id", (int) $id, 'WebSupportTicket');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při mazání ticketu ID $id: " . $e->getMessage(), (int) $id, 'WebSupportTicket');
            return response()->json(['message' => 'Smazání ticketu selhalo.'], 500);
        }
    }

    /**
     * @description Hromadně smaže vybrané tickety JEDNÍM requestem - viz
     * TableBuilderComponent.onBulkDeleteClick() (volá POST web/support_tickets/bulk-delete).
     * Replikuje STEJNOU logiku jako destroy() (úklid přílohy z disku při
     * force_delete=true) - ne generický Model::destroy($ids), který by tenhle úklid
     * potichu přeskočil a nechal osiřelé soubory ve storage/app/public/tickets.
     * @param Request $request Tělo obsahuje { ids: number[], force_delete?: boolean }.
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
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při hromadném mazání ticketů: " . $e->getMessage());
            return response()->json(['message' => 'Hromadné mazání selhalo.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebSupportTicket',
            'Hromadné ' . ($forceDelete ? 'trvalé ' : '') . "smazání {$deletedCount} ticketů (požadováno {$requestedCount}, ID: {$idsPreview}).",
            null,
            'WebSupportTicket'
        );

        return response()->json(['data' => [
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]]);
    }

    /**
     * @description Stáhne prázdnou importní šablonu (CSV/TXT/JSON) se sloupci
     * z IMPORTABLE_COLUMNS. CSV/TXT používá STEJNÝ oddělovač jako
     * TableBuilderComponent.downloadCsv()/downloadTxt() (středník / tabulátor).
     */
    public function importTemplate(Request $request)
    {
        $format = (string) $request->query('format', 'csv');
        if (!in_array($format, ['csv', 'json', 'txt'], true)) {
            return response()->json(['message' => 'Nepodporovaný formát šablony.'], 422);
        }

        $columns = self::IMPORTABLE_COLUMNS;
        $baseFilename = 'import-sablona-web-support_tickets';

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
     * @description Sestaví validační pravidla pro import - Store request pravidla
     * (přes ImportRowValidator) PLUS vlastní pravidlo pro state, které Store request
     * vůbec nezná (viz refactor-note v hlavičce třídy).
     */
    private function buildImportRules(ImportRowValidator $rowValidator): array
    {
        $rules = $rowValidator->buildRules(StoreWebSupportTicketRequest::class, self::IMPORTABLE_COLUMNS);
        $rules['state'] = ['sometimes', 'nullable', 'string', 'in:new,open,closed'];
        return $rules;
    }

    /**
     * @description Dry-run validace importního souboru - NEZAPISUJE nic do DB.
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

        $tempPath = 'imports/' . Str::uuid() . '.' . $validated['format'];
        Storage::disk(self::TEMP_DISK)->put($tempPath, file_get_contents($request->file('file')->getRealPath()));

        $batch = CoreImportBatch::create([
            'resource'          => 'web/support_tickets',
            'user_id'           => $request->user()->id,
            'original_filename' => $request->file('file')->getClientOriginalName(),
            'format'            => $validated['format'],
            'temp_path'         => $tempPath,
            'status'            => 'validated',
            'total_rows'        => count($parsed['rows']),
            'valid_rows'        => count($validRows),
            'invalid_rows'      => $invalidCount,
            'error_summary'     => $errors,
        ]);

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
     * @description Potvrdí a provede skutečný zápis importu. NEVOLÁ store() - viz
     * refactor-note v hlavičce třídy (žádné automatické přiřazení přihlášenému
     * adminovi, žádná příloha; state defaultuje na 'new', pokud v souboru chybí,
     * stejně jako by to udělal DB default při běžném vytvoření).
     */
    public function importCommit(
        Request $request,
        ImportFileParser $parser,
        ImportRowValidator $rowValidator
    ): JsonResponse {
        $validated = $request->validate(['import_token' => ['required', 'integer']]);
        $batch = CoreImportBatch::find($validated['import_token']);

        if ($batch === null || $batch->user_id !== $request->user()->id || $batch->status !== 'validated') {
            return response()->json(['message' => 'Import nebyl nalezen nebo už byl zpracován.'], 404);
        }

        if (!Storage::disk(self::TEMP_DISK)->exists($batch->temp_path)) {
            return response()->json(['message' => 'Dočasný soubor importu vypršel. Nahrajte prosím soubor znovu.'], 410);
        }

        $batch->update(['status' => 'processing']);

        try {
            $realPath = Storage::disk(self::TEMP_DISK)->path($batch->temp_path);
            $uploadedFile = new UploadedFile($realPath, $batch->original_filename ?? 'import', null, null, true);
            $parsed = $parser->parse($uploadedFile, $batch->format, self::IMPORTABLE_COLUMNS, 20000);
            $rules = $this->buildImportRules($rowValidator);

            $imported = 0;
            DB::transaction(function () use ($parsed, $rules, $rowValidator, &$imported) {
                foreach ($parsed['rows'] as $row) {
                    if ($rowValidator->validateRow($row, $rules) !== null) {
                        continue;
                    }

                    $safeData = array_intersect_key($row, array_flip(self::IMPORTABLE_COLUMNS));
                    // 'state' prázdné/chybějící -> 'new', stejně jako DB default při
                    // běžném vytvoření přes store() (které 'state' vůbec neposílá).
                    if (empty($safeData['state'])) {
                        $safeData['state'] = 'new';
                    }

                    WebSupportTicket::create($safeData);
                    $imported++;
                }
            });

            $skipped = count($parsed['rows']) - $imported;

            $batch->update([
                'status'         => 'completed',
                'imported_count' => $imported,
                'skipped_count'  => $skipped,
                'completed_at'   => now(),
            ]);
            Storage::disk(self::TEMP_DISK)->delete($batch->temp_path);

            $this->logAction(
                $request,
                WebLog::class,
                'import',
                'WebSupportTicket',
                "Hromadný import: přidáno {$imported} ticketů, přeskočeno {$skipped} (soubor '{$batch->original_filename}').",
                null,
                'WebSupportTicket'
            );

            return response()->json(['data' => [
                'queued'         => false,
                'imported_count' => $imported,
                'skipped_count'  => $skipped,
                'skip_reasons'   => [],
            ]]);
        } catch (\Exception $e) {
            $batch->update(['status' => 'failed']);
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při importu: " . $e->getMessage());
            return response()->json(['message' => 'Import selhal.'], 500);
        }
    }

    /**
     * Restores a soft-deleted support ticket.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebSupportTicket::withTrashed()->findOrFail($id);
            $item->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebSupportTicket', "Obnova ticketu ID: $id", (int) $id, 'WebSupportTicket');
            return response()->json(new WebSupportTicketResource($item->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při obnově ticketu ID $id: " . $e->getMessage(), (int) $id, 'WebSupportTicket');
            return response()->json(['message' => 'Obnova ticketu selhala.'], 500);
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

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebSupportTicket', "Hromadné smazání koše ticketů. Počet: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při vyprazdňování koše ticketů: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }
}