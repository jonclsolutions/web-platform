<?php
/**
 * @file WebRawRequestCommissionController.php
 * @path app/Http/Controllers/Api/Web/WebRawRequestCommissionController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages raw commission request submissions, supporting multiple file
 * attachments, status tracking, and administrative audit logging.
 *
 * @refactor-note (2026-08) Jednosouborove pole file_path KOMPLETNE ODSTRANENO (sloupec
 * smazan z DB) - nahrazeno polymorfnim web_attachments vztahem pres HandlesAttachments
 * trait, podporujicim az 10 priloh na jeden pozadavek.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVANI na sdileny LogsActivity trait misto
 * lokalni duplicitni logAction().
 *
 * @bugfix-note (2026-08-19) index() NEEAGER-LOADOVAL vztah attachments - doplneno
 * ->with('attachments').
 *
 * @bugfix-note (2026-08-19v2) ->send() PREPNUTO NA ->queue() - sjednoceno s
 * WebSalesOrderController::store().
 *
 * @refactor-note (2026-08-23a) HROMADNE MAZANI V JEDNOM REQUESTU: pridana bulkDestroy() -
 * viz TableBuilderComponent.onBulkDeleteClick() (vola POST web/raw_request_commissions/bulk-delete).
 * ZAMERNE replikuje STEJNOU logiku jako destroy() (uklid priloh z disku pres
 * deleteAllAttachments() pri force_delete=true), ne genericky Model::destroy($ids), ktery
 * by tenhle uklid potichu preskocil.
 *
 * @refactor-note (2026-08-23b) HROMADNY IMPORT PRIMO V KONTROLERU (importTemplate/
 * importValidate/importCommit) - nahrazuje driv testovanou centralni verzi pres
 * ImportController/importable_resources.php. importCommit() NEVOLA store()/Mail::queue() -
 * import zamerne neposila potvrzovaci e-mail (rozhodnuto drive v tasku - hromadny
 * import historickych/cizich dat nema rozesilat notifikace kontaktum ze souboru).
 * importCommit() proto NEVOLA store()/Mail::queue() primo, jen
 * WebRawRequestCommission::create() se stejnym whitelistem sloupcu jako store(), bez
 * emailu a bez prilohy (tabulkovy import neumi prenest soubor per radek).
 *
 * @refactor-note (2026-08-31) BACKLOG "privátní úložiště citlivých příloh": přílohy
 * teď jdou na disk 'private' (default v HandlesAttachments, žádná změna zdejšího
 * volání storeAttachments() nebyla potřeba) a do modulově prefixované složky
 * `web/raw_request_commissions` (viz ATTACHMENT_FOLDER) - viz AttachmentDownloadController
 * a WebAttachmentResource pro autorizovaný přístup přes krátkodobě podepsané URL.
 *
 * @refactor-note (2026-08-31v2) BACKLOG "osiřelé importní soubory": import
 * validate/commit flow přepsán na sdílený `HandlesImportBatches` trait - dřív
 * chyběl `Storage::delete($batch->temp_path)` v `catch` větvi importCommit()
 * (i po neúspěšném importu zůstal dočasný soubor navždy na disku), teď to
 * garantuje `try/finally` uvnitř `runImportCommit()`, ne ruční mazání zde.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebRawRequestCommission;
use App\Models\Web\WebLog;
use App\Traits\HandlesAttachments;
use App\Traits\HandlesImportBatches;
use App\Traits\LogsActivity;
use App\Http\Resources\Web\WebRawRequestCommissionResource;
use App\Http\Requests\Web\WebRawRequestCommission\StoreWebRawRequestCommissionRequest;
use App\Http\Requests\Web\WebRawRequestCommission\UpdateWebRawRequestCommissionRequest;
use App\Services\Import\ImportFileParser;
use App\Services\Import\ImportRowValidator;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Mail\Web\WebRawRequestCommissionReceived;
use Illuminate\Support\Facades\Mail;

/**
 * @description Controller responsible for processing raw commission inquiries submitted via the website.
 * @note Implements soft-delete functionality and managed file storage for request attachments.
 */
class WebRawRequestCommissionController extends Controller
{
    use HandlesAttachments;
    use HandlesImportBatches;
    use LogsActivity;

    /**
     * Storage folder for attachments within the private disk.
     */
    private const ATTACHMENT_FOLDER = 'web/raw_request_commissions';

    /**
     * @description Sloupce, které smí přijít z importního souboru - whitelist. `lang`
     * (defaultuje na 'cz') a `attachment` (soubor, tabulkový import ho nemůže nést)
     * jsou ZÁMĚRNĚ mimo, stejně jako u dřívější centrální verze.
     */
    private const IMPORTABLE_COLUMNS = [
        'thema', 'contact_email', 'contact_phone', 'order_description', 'status', 'priority', 'note',
    ];

    /**
     * Retrieves a paginated or full collection of commission requests with search and filtering.
     */
    /**
     * Retrieves a paginated or full collection of commission requests with search and filtering.
     * @refactor-note (2026-08-26) Přidán volitelný date-range filtr `date_from`/`date_to`
     * (whereDate na `created_at`, >= / <=) - slouží GraphBuilderComponent (admin
     * analytika/reporty), viz graph-builder.component.ts. Záměrně ODDĚLENÝ od
     * stávajícího jednodenního `created_at` filtru níže (tabulkový filtr UI) - obě
     * varianty tak spolu nekonfliktně koexistují, žádné jiné chování metody se nemění.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebRawRequestCommission::query()->with('attachments');
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('thema', 'like', "%$s%")
                ->orWhere('order_description', 'like', "%$s%")
                ->orWhere('contact_email', 'like', "%$s%")
                ->orWhere('contact_phone', 'like', "%$s%"));
        }

        foreach (['id', 'status', 'priority'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        foreach (['contact_email', 'contact_phone', 'thema', 'order_description'] as $f) {
            if ($request->filled($f)) $query->where($f, 'like', '%' . $request->input($f) . '%');
        }

        if ($request->filled('created_at')) $query->whereDate('created_at', $request->created_at);

        // GraphBuilderComponent date-range filter (admin analytics popup) - viz
        // refactor-note výše. Nezávislé na jednodenním 'created_at' filtru nad tímto
        // blokem, obě podmínky se mohou (ale nemusí) uplatnit zároveň.
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $sortBy = $request->input('sort_by', 'id');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        $data = $noPagination ? $query->get() : $query->paginate($perPage);

        if ($noPagination) {
            return WebRawRequestCommissionResource::collection($data);
        }

        return response()->json([
            'data'         => WebRawRequestCommissionResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Stores a new commission request, handling multiple optional file uploads.
     */
    public function store(StoreWebRawRequestCommissionRequest $request): JsonResponse
    {
        try {
            $data = $request->safe()->except(['attachments']);

            $commission = WebRawRequestCommission::create($data);

            $this->storeAttachments($request, $commission, self::ATTACHMENT_FOLDER);

            $this->logAction($request, WebLog::class, 'create', 'WebRawRequestCommission', "Vytvořen požadavek na provizi: {$commission->thema}", $commission->id, 'WebRawRequestCommission');

            try {
                Mail::to($commission->contact_email)
                    ->queue(new WebRawRequestCommissionReceived($commission));
            } catch (\Throwable $e) {
                $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Nepodařilo se odeslat potvrzovací e-mail: " . $e->getMessage(), $commission->id, 'WebRawRequestCommission');
            }

            return response()->json(new WebRawRequestCommissionResource($commission->load('attachments')), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při vytváření požadavku: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření požadavku selhalo.'], 500);
        }
    }

    /**
     * Retrieves a single commission request by ID, including trashed records and attachments.
     */
    public function show($id): JsonResponse
    {
        $rawRequestCommission = WebRawRequestCommission::withTrashed()->with('attachments')->findOrFail($id);
        return response()->json(new WebRawRequestCommissionResource($rawRequestCommission));
    }

    /**
     * Updates an existing request. Newly uploaded attachments are ADDED to the existing
     * set (not replaced).
     */
    public function update(UpdateWebRawRequestCommissionRequest $request, $id): JsonResponse
    {
        try {
            $rawRequestCommission = WebRawRequestCommission::findOrFail($id);

            $validated = $request->safe()->except(['attachments', 'attachments_removed_ids']);
            $rawRequestCommission->update($validated);

            $removedIds = $request->input('attachments_removed_ids', []);
            if (!empty($removedIds)) {
                $this->deleteAttachmentsByIds($rawRequestCommission, $removedIds);
            }

            $this->storeAttachments($request, $rawRequestCommission, self::ATTACHMENT_FOLDER);

            $this->logAction($request, WebLog::class, 'update', 'WebRawRequestCommission', "Aktualizace požadavku ID: {$rawRequestCommission->id}", $rawRequestCommission->id, 'WebRawRequestCommission');

            return response()->json(new WebRawRequestCommissionResource($rawRequestCommission->fresh()->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při aktualizaci požadavku ID {$id}: " . $e->getMessage(), (int) $id, 'WebRawRequestCommission');
            return response()->json(['message' => 'Aktualizace požadavku selhala.'], 500);
        }
    }

    /**
     * Deletes a request (Soft or Hard). On hard delete, all associated attachment files
     * and their DB records are removed too.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebRawRequestCommission::withTrashed()->with('attachments')->findOrFail($id);

            if ($forceDelete) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebRawRequestCommission', "Smazání požadavku na provizi ID: $id", (int) $id, 'WebRawRequestCommission');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při mazání požadavku ID $id: " . $e->getMessage(), (int) $id, 'WebRawRequestCommission');
            return response()->json(['message' => 'Smazání požadavku selhalo.'], 500);
        }
    }

    /**
     * @description Hromadně smaže vybrané požadavky JEDNÍM requestem - viz
     * TableBuilderComponent.onBulkDeleteClick() (volá POST
     * web/raw_request_commissions/bulk-delete). Replikuje STEJNOU logiku jako destroy()
     * (úklid příloh z disku při force_delete=true) - ne generický Model::destroy($ids),
     * který by tenhle úklid potichu přeskočil a nechal osiřelé soubory na disku.
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
                $items = WebRawRequestCommission::withTrashed()->with('attachments')->whereIn('id', $ids)->get();

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
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při hromadném mazání požadavků: " . $e->getMessage());
            return response()->json(['message' => 'Hromadné mazání selhalo.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebRawRequestCommission',
            'Hromadné ' . ($forceDelete ? 'trvalé ' : '') . "smazání {$deletedCount} požadavků (požadováno {$requestedCount}, ID: {$idsPreview}).",
            null,
            'WebRawRequestCommission'
        );

        return response()->json(['data' => [
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]]);
    }

    /**
     * @description Stáhne prázdnou importní šablonu (CSV/TXT/JSON) se sloupci
     * z IMPORTABLE_COLUMNS.
     */
    public function importTemplate(Request $request)
    {
        $format = (string) $request->query('format', 'csv');
        if (!in_array($format, ['csv', 'json', 'txt'], true)) {
            return response()->json(['message' => 'Nepodporovaný formát šablony.'], 422);
        }

        $columns = self::IMPORTABLE_COLUMNS;
        $baseFilename = 'import-sablona-web-raw_request_commissions';

        if ($format === 'csv' || $format === 'txt') {
            $delimiter = $format === 'txt' ? "\t" : ',';
            $mime = $format === 'txt' ? 'text/plain' : 'text/csv';
            return response(implode($delimiter, $columns) . "\n", 200, [
                'Content-Type'        => "{$mime}; charset=UTF-8",
                'Content-Disposition' => "attachment; filename=\"{$baseFilename}.{$format}\"",
            ]);
        }

        // json
        $example = array_fill_keys($columns, '');
        return response(json_encode([$example], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), 200, [
            'Content-Type'        => 'application/json; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$baseFilename}.json\"",
        ]);
    }

    /**
     * @description Dry-run validace importního souboru - NEZAPISUJE nic do DB. Uloží
     * soubor dočasně a vrátí import_token pro navazující importCommit().
     * @refactor-note (2026-08-31) Uložení souboru + vytvoření CoreImportBatch teď jde
     * přes `startImportBatch()` (HandlesImportBatches trait) místo ručního
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

        $rules = $rowValidator->buildRules(StoreWebRawRequestCommissionRequest::class, self::IMPORTABLE_COLUMNS);

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
            'web/raw_request_commissions',
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
     * @description Potvrdí a provede skutečný zápis importu. ZNOVU parsuje a validuje
     * soubor (nikdy nedůvěřuje dry-run výsledku bez ověření). NEVOLÁ store()/Mail::queue() -
     * import záměrně neposílá potvrzovací e-mail a neumí přenést přílohu.
     * @refactor-note (2026-08-31) Přepsáno na `findPendingImportBatch()` +
     * `runImportCommit()` (HandlesImportBatches trait) - dočasný soubor se teď maže
     * VŽDY (i při selhání), viz trait hlavička.
     */
    public function importCommit(
        Request $request,
        ImportFileParser $parser,
        ImportRowValidator $rowValidator
    ): JsonResponse {
        $validated = $request->validate(['import_token' => ['required', 'integer']]);
        $batch = $this->findPendingImportBatch($request, $validated['import_token']);

        if ($batch === null) {
            return response()->json(['message' => 'Import nebyl nalezen nebo už byl zpracován.'], 404);
        }

        try {
            $result = $this->runImportCommit($batch, function ($uploadedFile) use ($parser, $rowValidator, $batch) {
                $parsed = $parser->parse($uploadedFile, $batch->format, self::IMPORTABLE_COLUMNS, 20000);
                $rules = $rowValidator->buildRules(StoreWebRawRequestCommissionRequest::class, self::IMPORTABLE_COLUMNS);

                $imported = 0;
                DB::transaction(function () use ($parsed, $rules, $rowValidator, &$imported) {
                    foreach ($parsed['rows'] as $row) {
                        if ($rowValidator->validateRow($row, $rules) !== null) {
                            continue;
                        }
                        // Stejný whitelist sloupců jako store(), ale ZÁMĚRNĚ BEZ přílohy a
                        // BEZ Mail::queue() - viz refactor-note v hlavičce třídy.
                        WebRawRequestCommission::create(
                            array_intersect_key($row, array_flip(self::IMPORTABLE_COLUMNS))
                        );
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
                'WebRawRequestCommission',
                "Hromadný import: přidáno {$result['imported_count']} požadavků, přeskočeno {$result['skipped_count']} (soubor '{$batch->original_filename}').",
                null,
                'WebRawRequestCommission'
            );

            return response()->json(['data' => [
                'queued'         => false,
                'imported_count' => $result['imported_count'],
                'skipped_count'  => $result['skipped_count'],
                'skip_reasons'   => [],
            ]]);
        } catch (\RuntimeException $e) {
            // Vypršelý dočasný soubor - viz runImportCommit(), kód 410.
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 500);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při importu: " . $e->getMessage());
            return response()->json(['message' => 'Import selhal.'], 500);
        }
    }

    /**
     * Restores a soft-deleted request.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebRawRequestCommission::withTrashed()->findOrFail($id);
            $item->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebRawRequestCommission', "Obnova požadavku ID: $id", (int) $id, 'WebRawRequestCommission');

            return response()->json(new WebRawRequestCommissionResource($item->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při obnově požadavku ID $id: " . $e->getMessage(), (int) $id, 'WebRawRequestCommission');
            return response()->json(['message' => 'Obnova požadavku selhala.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted records and all their attachment files.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashed = WebRawRequestCommission::onlyTrashed()->with('attachments')->get();
            $count = $trashed->count();

            foreach ($trashed as $item) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            }

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebRawRequestCommission', "Hromadné smazání koše provizí. Počet: $count");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při vyprazdňování koše provizí: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }
}