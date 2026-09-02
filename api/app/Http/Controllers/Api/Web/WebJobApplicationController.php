<?php
/**
 * @file WebJobApplicationController.php
 * @path app/Http/Controllers/Api/Web/WebJobApplicationController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages the lifecycle of job applications, including document handling (CVs), status updates, and soft-delete administrative workflows.
 * @refactor-note (2026-08-2) CV storage moved to the polymorphic `web_attachments` table
 *      (HandlesAttachments::storeSingleAttachment()). `cv_path`/`cv_original_name` columns
 *      NOT dropped - legacy fallback preserved for pre-migration applications, see
 *      PublicFileDownloadController's FOLDER_MAP fallback.
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction() - stejný důvod jako u ostatních Web kontrolerů (viz
 * WebRawRequestCommissionController hlavička). Doménově beze změny (WebLog::class).
 *
 * @bugfix-note (2026-08-15) KRITICKÁ OPRAVA FILTRŮ: `index()` zpracovával jen textové
 * filtry (`first_name`, `last_name`, `email`, `position_name`, `state`) přes LIKE, ale
 * `id` z `JOB_APPLICATION_FILTER_COLUMNS` (frontend) se nikde nezpracovával - stejný
 * symptom jako u WebNewsController (viz jeho bugfix-note stejné datum). `id` teď má
 * vlastní přesnou shodu (`where('id', ...)`), oddělenou od LIKE smyčky pro textová pole -
 * konzistentní s WebSalesLeadController/WebRawRequestCommissionController, které tenhle
 * vzor už měly správně.
 *
 * @refactor-note (2026-08-23) HROMADNÉ MAZÁNÍ V JEDNOM REQUESTU: přidána `bulkDestroy()`
 * - viz TableBuilderComponent.onBulkDeleteClick() na frontendu (volá `{apiEndpoint}/bulk-delete`).
 * ZÁMĚRNĚ NENÍ generický `Model::destroy($ids)` - `destroy()` u tohoto resource má
 * netriviální vedlejší efekt (`force_delete` maže i přílohy z disku přes
 * `deleteAllAttachments()`), který by generická zkratka potichu přeskočila a nechala by
 * osiřelé soubory na disku. `bulkDestroy()` proto replikuje STEJNOU logiku jako
 * `destroy()`, jen ve smyčce nad více záznamy v jedné transakci.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebJobApplication;
use App\Models\Web\WebLog;
use App\Http\Resources\Web\WebJobApplicationResource;
use App\Http\Requests\Web\WebJobApplication\StoreWebJobApplicationRequest;
use App\Http\Requests\Web\WebJobApplication\UpdateWebJobApplicationRequest;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * @description Controller responsible for processing incoming job applications and managing applicant records.
 * @note Implements file storage logic for CV uploads (via HandlesAttachments) and integrates with the central logging system.
 */
class WebJobApplicationController extends Controller
{
    use HandlesAttachments;
    use LogsActivity;

    /**
     * Storage folder for CV uploads within the public disk.
     */
    private const CV_FOLDER = 'web/cv_files';

    /**
     * Retrieves a paginated list of job applications with optional search and filtering.
     */
/**
     * @refactor-note (2026-08-25) BACKLOG "hledat napříč vším": `search` rozšířen o
     * `state` - tenhle sloupec byl už dřív dostupný jako individuální filtr (a to
     * přes LIKE, ne přesnou shodu - na rozdíl třeba od `WebSupportTicket.status`,
     * který je enum s exaktní shodou a proto do fulltextového search záměrně
     * NEPATŘÍ). `state` je tady fuzzy-filtrovatelné pole stejně jako ostatní, takže
     * patří i do globálního search pro konzistenci.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebJobApplication::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('first_name', 'like', "%$s%")
                ->orWhere('last_name', 'like', "%$s%")
                ->orWhere('email', 'like', "%$s%")
                ->orWhere('position_name', 'like', "%$s%")
                ->orWhere('state', 'like', "%$s%"));
        }

        // Přesná shoda - ID je číselný identifikátor, LIKE by tu nedávalo smysl.
        if ($request->filled('id')) {
            $query->where('id', $request->input('id'));
        }

        foreach (['first_name', 'last_name', 'email', 'position_name', 'state'] as $f) {
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
            return WebJobApplicationResource::collection($data);
        }

        return response()->json([
            'data'         => WebJobApplicationResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Persists a new job application and handles CV file storage.
     */
    public function store(StoreWebJobApplicationRequest $request): JsonResponse
    {
        try {
            $validatedData = $request->validated();
            unset($validatedData['cv_file']);

            $application = WebJobApplication::create($validatedData);

            $this->storeSingleAttachment($request, $application, self::CV_FOLDER, 'cv_file');

            $this->logAction($request, WebLog::class, 'create', 'WebJobApplication', "Nová reakce na pozici: {$application->position_name} ({$application->first_name} {$application->last_name})", $application->id, 'WebJobApplication');

            return response()->json(new WebJobApplicationResource($application->load('attachments')), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebJobApplication', "Chyba při vytváření uchazeče: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření se nezdařilo.'], 500);
        }
    }

    /**
     * Retrieves the details of a single job application by ID, including soft-deleted ones.
     */
    public function show($id): JsonResponse
    {
        $jobApplication = WebJobApplication::withTrashed()->with('attachments')->findOrFail($id);
        return response()->json(new WebJobApplicationResource($jobApplication));
    }

    /**
     * Updates an existing application and replaces the CV file if a new one is provided.
     */
    public function update(UpdateWebJobApplicationRequest $request, $id): JsonResponse
    {
        try {
            $jobApplication = WebJobApplication::withTrashed()->findOrFail($id);

            $validated = $request->validated();
            unset($validated['cv_file']);

            $jobApplication->update($validated);

            $this->storeSingleAttachment($request, $jobApplication, self::CV_FOLDER, 'cv_file');

            $this->logAction(
                $request,
                WebLog::class,
                'update',
                'WebJobApplication',
                "Aktualizace uchazeče ID: {$id}. Stav: " . ($validated['state'] ?? 'beze změny'),
                (int) $id,
                'WebJobApplication'
            );

            return response()->json(new WebJobApplicationResource($jobApplication->fresh()->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction(
                $request,
                WebLog::class,
                'error',
                'WebJobApplication',
                "Chyba při aktualizaci uchazeče ID: {$id}. Chyba: " . $e->getMessage(),
                (int) $id,
                'WebJobApplication'
            );
            return response()->json(['message' => 'Aktualizace se nezdařila.'], 500);
        }
    }

    /**
     * Deletes an application, optionally performing a hard delete to remove associated files.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebJobApplication::withTrashed()->with('attachments')->findOrFail($id);

            if ($forceDelete) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebJobApplication', "Smazání uchazeče ID: $id", (int) $id, 'WebJobApplication');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebJobApplication', "Chyba při mazání uchazeče ID: $id. Chyba: " . $e->getMessage(), (int) $id, 'WebJobApplication');
            return response()->json(['message' => 'Smazání se nezdařilo.'], 500);
        }
    }

    /**
     * @description Hromadně smaže vybrané uchazeče JEDNÍM requestem - viz
     * `TableBuilderComponent.onBulkDeleteClick()` na frontendu (volá
     * `POST web/job_applications/bulk-delete`).
     *
     * @note ZÁMĚRNĚ replikuje STEJNOU logiku jako `destroy()` (viz jeho refactor-note
     * v hlavičce třídy) - ne generický `Model::destroy($ids)`. Ten by u `force_delete=true`
     * potichu přeskočil úklid příloh z disku (`deleteAllAttachments()`) a nechal by
     * osiřelé CV soubory ve `storage/app/public/cv_files`.
     *
     * @param Request $request Tělo obsahuje `{ ids: number[], force_delete?: boolean }`.
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
                $items = WebJobApplication::withTrashed()->with('attachments')->whereIn('id', $ids)->get();

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
            $this->logAction($request, WebLog::class, 'error', 'WebJobApplication', "Chyba při hromadném mazání uchazečů: " . $e->getMessage());
            return response()->json(['message' => 'Hromadné mazání se nezdařilo.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebJobApplication',
            'Hromadné ' . ($forceDelete ? 'trvalé ' : '') . "smazání {$deletedCount} uchazečů (požadováno {$requestedCount}, ID: {$idsPreview}).",
            null,
            'WebJobApplication'
        );

        return response()->json(['data' => [
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]]);
    }

    /**
     * Restores a soft-deleted application.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebJobApplication::withTrashed()->findOrFail($id);
            $item->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebJobApplication', "Obnova uchazeče ID: $id", (int) $id, 'WebJobApplication');

            return response()->json(new WebJobApplicationResource($item->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebJobApplication', "Chyba při obnově uchazeče ID: $id. Chyba: " . $e->getMessage(), (int) $id, 'WebJobApplication');
            return response()->json(['message' => 'Obnova se nezdařila.'], 500);
        }
    }

    /**
     * Permanently deletes all trashed applications and their associated files.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashed = WebJobApplication::onlyTrashed()->with('attachments')->get();
            $count = $trashed->count();

            foreach ($trashed as $item) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            }

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebJobApplication', "Vysypání koše uchazečů. Počet: $count");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebJobApplication', "Chyba při vysypávání koše uchazečů. Chyba: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše se nezdařilo.'], 500);
        }
    }
}