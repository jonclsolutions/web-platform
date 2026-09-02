<?php
/**
 * @file WebNewsController.php
 * @path app/Http/Controllers/Api/Web/WebNewsController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages news article lifecycle, including categorization, content management, and soft-delete administrative workflows.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVANI na sdileny LogsActivity trait misto
 * lokalni duplicitni logAction(). Domenove beze zmeny (WebLog::class).
 *
 * @bugfix-note (2026-08-15) KRITICKA OPRAVA FILTRU: index() vubec nezpracovaval
 * filtry id a title, prestoze NEWS_FILTER_COLUMNS (frontend) je nabizi. Doplneno
 * id (presna shoda) a title (castecna shoda pres LIKE, konzistentne s author).
 *
 * @refactor-note (2026-08-23a) HROMADNE MAZANI V JEDNOM REQUESTU: pridana bulkDestroy()
 * - viz TableBuilderComponent.onBulkDeleteClick() na frontendu (vola
 * POST web/news/bulk-delete). destroy() nema zadny vedlejsi efekt na soubory/jine
 * tabulky (zadne prilohy) - jediny rozdil oproti generickemu Model::destroy($ids) je
 * nutnost explicitne zavolat forceDelete() pro force_delete=true vetev.
 *
 * @refactor-note (2026-08-23b) HROMADNY IMPORT (importTemplate/importValidate/
 * importCommit) - NEJJEDNODUSSI dosavadni pripad: store() nema zadny upload souboru,
 * zadnou automatickou logiku - je to cisty `WebNews::create($request->validated())`.
 * IMPORTABLE_COLUMNS odpovida 1:1 VSEM polim ve StoreWebNewsRequest::rules().
 *
 * @refactor-note (2026-08-31) BACKLOG "osiřelé importní soubory": import
 * validate/commit flow přepsán na sdílený `HandlesImportBatches` trait - dřív
 * chyběl `Storage::delete($batch->temp_path)` v `catch` větvi importCommit()
 * (i po neúspěšném importu zůstal dočasný soubor navždy na disku), teď to
 * garantuje `try/finally` uvnitř `runImportCommit()`, ne ruční mazání zde.
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
     * @description Sloupce, které smí přijít z importního souboru - odpovídá 1:1
     * StoreWebNewsRequest::rules() (žádné pole tam navíc, žádné chybějící).
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

            $this->logAction($request, WebLog::class, 'create', 'WebNews', "Vytvořena novinka: {$news->title}", $news->id, 'WebNews');

            return response()->json(new WebNewsResource($news), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při vytváření novinky: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření novinky selhalo.'], 500);
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

            $this->logAction($request, WebLog::class, 'update', 'WebNews', "Aktualizace novinky: {$news->title}", $news->id, 'WebNews');

            return response()->json(new WebNewsResource($news));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při aktualizaci novinky ID {$id}: " . $e->getMessage(), (int) $id, 'WebNews');
            return response()->json(['message' => 'Aktualizace novinky selhala.'], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $news = WebNews::withTrashed()->findOrFail($id);
            $title = $news->title;

            $forceDelete ? $news->forceDelete() : $news->delete();

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebNews', "Smazání novinky: $title", (int) $id, 'WebNews');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při mazání novinky ID $id: " . $e->getMessage(), (int) $id, 'WebNews');
            return response()->json(['message' => 'Smazání novinky selhalo.'], 500);
        }
    }

    /**
     * @description Hromadně smaže vybrané novinky JEDNÍM requestem - viz
     * TableBuilderComponent.onBulkDeleteClick() na frontendu (volá
     * POST web/news/bulk-delete).
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
                $items = WebNews::withTrashed()->whereIn('id', $ids)->get();

                foreach ($items as $item) {
                    $forceDelete ? $item->forceDelete() : $item->delete();
                    $deletedCount++;
                }
            });
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při hromadném mazání novinek: " . $e->getMessage());
            return response()->json(['message' => 'Hromadné mazání selhalo.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebNews',
            'Hromadné ' . ($forceDelete ? 'trvalé ' : '') . "smazání {$deletedCount} novinek (požadováno {$requestedCount}, ID: {$idsPreview}).",
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
        $baseFilename = 'import-sablona-web-news';

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
     * @description Potvrdí a provede skutečný zápis importu. Znovu parsuje a validuje
     * soubor (nikdy nedůvěřuje dry-run výsledku bez ověření).
     * @refactor-note (2026-08-31) Přepsáno na `findPendingImportBatch()` +
     * `runImportCommit()` (HandlesImportBatches trait) - dočasný soubor se teď maže
     * VŽDY (i při selhání), viz trait hlavička. `catch` blok tady zůstává jen pro
     * zpracování HTTP odpovědi (chybová zpráva/status kód), NE pro mazání souboru -
     * to zajišťuje `finally` uvnitř `runImportCommit()` bez ohledu na to, jestli sem
     * vůbec doběhneme.
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
                "Hromadný import: přidáno {$result['imported_count']} novinek, přeskočeno {$result['skipped_count']} (soubor '{$batch->original_filename}').",
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
            // Vypršelý dočasný soubor - viz runImportCommit(), kód 410.
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 500);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při importu: " . $e->getMessage());
            return response()->json(['message' => 'Import selhal.'], 500);
        }
    }

    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $news = WebNews::withTrashed()->findOrFail($id);
            $news->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebNews', "Obnovení novinky: {$news->title}", $news->id, 'WebNews');

            return response()->json(new WebNewsResource($news));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při obnově novinky ID $id: " . $e->getMessage(), (int) $id, 'WebNews');
            return response()->json(['message' => 'Obnova novinky selhala.'], 500);
        }
    }

    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $count = WebNews::onlyTrashed()->count();
            WebNews::onlyTrashed()->forceDelete();

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebNews', "Hromadné smazání koše novinek. Počet: $count");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při vyprazdňování koše novinek: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }
}