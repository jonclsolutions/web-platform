<?php
/**
 * @file WebSalesLeadController.php
 * @path app/Http/Controllers/Api/Web/WebSalesLeadController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Controller responsible for managing sales lead lifecycle, including filtering, lifecycle state management (soft-delete), and comprehensive administrative audit logging.
 * @refactor-note (2026) Přidány generateLink() a showByToken().
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený LogsActivity trait.
 *
 * @refactor-note (2026-08-23a) HROMADNÉ MAZÁNÍ V JEDNOM REQUESTU: přidána bulkDestroy().
 *
 * @refactor-note (2026-08-23b) HROMADNÝ IMPORT - dvě záměrné odchylky od store():
 * 1) `user_id` NENÍ importovatelné pole - vždy zůstává `null` u importovaných leadů.
 * 2) `salesman_name` se PŘEBÍRÁ ZE SOUBORU beze změny.
 * `public_token`/`public_token_used_at` zůstávají MIMO import.
 *
 * @bugfix-note (2026-08-24) `showByToken()` teď zapisuje `sales_lead_token_invalid`
 * do core_security_events pro neplatný i už použitý token.
 *
 * @refactor-note (2026-08-31) BACKLOG "osiřelé importní soubory": import
 * validate/commit flow přepsán na sdílený `HandlesImportBatches` trait - dřív
 * chyběl `Storage::delete($batch->temp_path)` v `catch` větvi importCommit()
 * (i po neúspěšném importu zůstal dočasný soubor navždy na disku), teď to
 * garantuje `try/finally` uvnitř `runImportCommit()`, ne ruční mazání zde.
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
     * @description Sloupce, které smí přijít z importního souboru - všechna pole ze
     * StoreWebSalesLeadRequest KROMĚ `user_id` (viz refactor-note v hlavičce třídy).
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
     * @refactor-note (2026-08-25) BACKLOG "hledat napříč vším": `search` rozšířen o
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
            $this->logAction($request, WebLog::class, 'export', 'WebSalesLead', "Hromadný export obchodních leadů.");
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

            $this->logAction($request, WebLog::class, 'create', 'WebSalesLead', "Vytvořen nový lead: {$lead->subject_name}", $lead->id, 'WebSalesLead');

            return response()->json(new WebSalesLeadResource($lead), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Chyba při vytváření leadu: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření leadu selhalo.'], 500);
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

            $this->logAction($request, WebLog::class, 'update', 'WebSalesLead', "Aktualizace leadu ID: {$lead->id} ({$lead->subject_name})", $lead->id, 'WebSalesLead');

            return response()->json(new WebSalesLeadResource($lead));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Chyba při aktualizaci leadu ID {$id}: " . $e->getMessage(), (int) $id, 'WebSalesLead');
            return response()->json(['message' => 'Aktualizace leadu selhala.'], 500);
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

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSalesLead', "Smazání leadu ID: $id", (int) $id, 'WebSalesLead');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Chyba při mazání leadu ID $id: " . $e->getMessage(), (int) $id, 'WebSalesLead');
            return response()->json(['message' => 'Smazání leadu selhalo.'], 500);
        }
    }

    /**
     * @description Hromadně smaže vybrané leady JEDNÍM requestem.
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
                $items = WebSalesLead::withTrashed()->whereIn('id', $ids)->get();

                foreach ($items as $item) {
                    $forceDelete ? $item->forceDelete() : $item->delete();
                    $deletedCount++;
                }
            });
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Chyba při hromadném mazání leadů: " . $e->getMessage());
            return response()->json(['message' => 'Hromadné mazání selhalo.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebSalesLead',
            'Hromadné ' . ($forceDelete ? 'trvalé ' : '') . "smazání {$deletedCount} leadů (požadováno {$requestedCount}, ID: {$idsPreview}).",
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
        $baseFilename = 'import-sablona-web-sales_leads';

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
     * @description Dry-run validace importního souboru - NEZAPISUJE nic do DB.
     * @refactor-note (2026-08-31) Uložení souboru + vytvoření CoreImportBatch teď jde
     * přes `startImportBatch()` (HandlesImportBatches trait).
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
     * @description Potvrdí a provede skutečný zápis importu. NEVOLÁ store() - žádné
     * automatické přiřazení user_id/salesman_name podle přihlášeného admina.
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
                $rules = $rowValidator->buildRules(StoreWebSalesLeadRequest::class, self::IMPORTABLE_COLUMNS);

                $imported = 0;
                DB::transaction(function () use ($parsed, $rules, $rowValidator, &$imported) {
                    foreach ($parsed['rows'] as $row) {
                        if ($rowValidator->validateRow($row, $rules) !== null) {
                            continue;
                        }
                        // user_id ZÁMĚRNĚ chybí z IMPORTABLE_COLUMNS - array_intersect_key
                        // ho tak z $row nikdy nevezme.
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
                "Hromadný import: přidáno {$result['imported_count']} leadů, přeskočeno {$result['skipped_count']} (soubor '{$batch->original_filename}').",
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
            // Vypršelý dočasný soubor - viz runImportCommit(), kód 410.
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 500);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Chyba při importu: " . $e->getMessage());
            return response()->json(['message' => 'Import selhal.'], 500);
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

            $this->logAction($request, WebLog::class, 'restore', 'WebSalesLead', "Obnova leadu ID: $id", (int) $id, 'WebSalesLead');

            return response()->json(new WebSalesLeadResource($item));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Chyba při obnově leadu ID $id: " . $e->getMessage(), (int) $id, 'WebSalesLead');
            return response()->json(['message' => 'Obnova leadu selhala.'], 500);
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

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebSalesLead', "Hromadné smazání koše leadů. Počet: $count");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Chyba při vyprazdňování koše leadů: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }

    /**
     * @description Vygeneruje (nebo vrátí existující) public_token pro daný lead a sestaví
     *              z něj plnou veřejnou URL na objednávkový formulář.
     * @note ADMIN endpoint - musí zůstat za AuthGuard/Sanctum middlewarem v routes/api.php.
     */
    public function generateLink(Request $request, $id): JsonResponse
    {
        try {
            $lead = WebSalesLead::findOrFail($id);
            $token = $lead->getOrCreatePublicToken();

            $this->logAction($request, WebLog::class, 'generate_link', 'WebSalesLead', "Vygenerován odkaz na objednávkový formulář pro lead ID: {$lead->id}", $lead->id, 'WebSalesLead');

            return response()->json([
                'data' => [
                    'token' => $token,
                    'url'   => rtrim(config('app.frontend_url', $request->getSchemeAndHttpHost()), '/') . "/order_form/{$token}",
                ],
            ]);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSalesLead', "Chyba při generování odkazu pro lead ID {$id}: " . $e->getMessage(), (int) $id, 'WebSalesLead');
            return response()->json(['message' => 'Vygenerování odkazu selhalo.'], 500);
        }
    }

    /**
     * @description VEŘEJNÁ metoda (bez auth) pro načtení leadu podle public_token -
     *              slouží OrderFormComponent na frontendu k předvyplnění objednávkového
     *              formuláře. Vrací jen úzkou, bezpečnou podmnožinu polí.
     * @note Musí být zaregistrována v routes/api.php MIMO auth middleware skupinu.
     * @note Vrací 410 Gone, pokud byl odkaz už jednou použit.
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

            return response()->json(['message' => 'Odkaz je neplatný nebo již expiroval.'], 404);
        }

        if ($lead->public_token_used_at) {
            CoreSecurityEvent::record(
                'sales_lead_token_invalid',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['reason' => 'already_used', 'lead_id' => $lead->id])
            );

            return response()->json(['message' => 'Tento formulář již byl jednou odeslán a odkaz není možné použít znovu.'], 410);
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