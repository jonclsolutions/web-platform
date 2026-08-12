<?php
/**
 * @file WebJobApplicationController.php
 * @path app/Http/Controllers/Api/Web/WebJobApplicationController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages the lifecycle of job applications, including document handling (CVs), status updates, and soft-delete administrative workflows.
 * @refactor-note (2026-08) store()/update() capture the client's original CV file name
 *      into `cv_original_name` via HandlesFileUploads::storeUploadedFile().
 * @refactor-note (2026-08-2) SUPERSEDES the note above - CV storage moved from the
 *      single `cv_path`/`cv_original_name` columns to the polymorphic `web_attachments`
 *      table (HandlesAttachments::storeSingleAttachment()), same system already used by
 *      WebSalesOrder/WebRawRequestCommission. Reason: unifies download/preview handling
 *      behind one mechanism (PublicFileDownloadController already looks up
 *      WebAttachment::path first) instead of maintaining two parallel systems.
 *      `cv_path`/`cv_original_name` columns are NOT dropped - old applications uploaded
 *      before this change keep their CV accessible via that legacy path (see
 *      PublicFileDownloadController's FOLDER_MAP fallback), but new uploads only ever
 *      create a WebAttachment row now.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebJobApplication;
use App\Models\Web\WebLog;
use App\Http\Resources\Web\WebJobApplicationResource;
use App\Http\Requests\Web\WebJobApplication\StoreWebJobApplicationRequest;
use App\Http\Requests\Web\WebJobApplication\UpdateWebJobApplicationRequest;
use App\Traits\HandlesAttachments;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller responsible for processing incoming job applications and managing applicant records.
 * @note Implements file storage logic for CV uploads (via HandlesAttachments) and integrates with the central logging system.
 */
class WebJobApplicationController extends Controller
{
    use HandlesAttachments;

    /**
     * Storage folder for CV uploads within the public disk.
     */
    private const CV_FOLDER = 'cv_files';

    /**
     * Retrieves a paginated list of job applications with optional search and filtering.
     *
     * @param Request $request Incoming request containing filters and pagination settings.
     * @return JsonResponse|mixed Returns paginated data or a collection if no_pagination is set.
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
                ->orWhere('position_name', 'like', "%$s%"));
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
     *
     * @param StoreWebJobApplicationRequest $request Validated applicant data.
     * @return JsonResponse Returns the created resource.
     * @throws \Exception On file system or database failure.
     */
    public function store(StoreWebJobApplicationRequest $request): JsonResponse
    {
        try {
            $validatedData = $request->validated();
            // 'cv_file' je jen v $request (UploadedFile), ne sloupec v DB - viz
            // storeSingleAttachment() níže, které ho ukládá do web_attachments.
            unset($validatedData['cv_file']);

            $application = WebJobApplication::create($validatedData);

            $this->storeSingleAttachment($request, $application, self::CV_FOLDER, 'cv_file');

            $this->logAction($request, 'create', 'WebJobApplication', "Nová reakce na pozici: {$application->position_name} ({$application->first_name} {$application->last_name})", $application->id);
            
            return response()->json(new WebJobApplicationResource($application->load('attachments')), 201);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebJobApplication', "Chyba při vytváření uchazeče: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření se nezdařilo.'], 500);
        }
    }

    /**
     * Retrieves the details of a single job application by ID, including soft-deleted ones.
     *
     * @param int $id Application identifier.
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $jobApplication = WebJobApplication::withTrashed()->with('attachments')->findOrFail($id);
        
        return response()->json(new WebJobApplicationResource($jobApplication));
    }

    /**
     * Updates an existing application and replaces the CV file if a new one is provided.
     *
     * @param UpdateWebJobApplicationRequest $request Validated update data.
     * @param int $id Application identifier.
     * @return JsonResponse Returns the updated resource.
     * @throws \Exception On update failure.
     */
    public function update(UpdateWebJobApplicationRequest $request, $id): JsonResponse
    {
        try {
            $jobApplication = WebJobApplication::withTrashed()->findOrFail($id);

            $validated = $request->validated();
            unset($validated['cv_file']);

            $jobApplication->update($validated);

            // storeSingleAttachment() sama smaže dřívější přílohu (disk i DB), pokud
            // requestu dorazil nový 'cv_file' - jinak beze změny.
            $this->storeSingleAttachment($request, $jobApplication, self::CV_FOLDER, 'cv_file');
            
            $this->logAction(
                $request, 
                'update', 
                'WebJobApplication', 
                "Aktualizace uchazeče ID: {$id}. Stav: " . ($validated['state'] ?? 'beze změny'), 
                $id
            );
            
            return response()->json(new WebJobApplicationResource($jobApplication->fresh()->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction(
                $request, 
                'error', 
                'WebJobApplication', 
                "Chyba při aktualizaci uchazeče ID: {$id}. Chyba: " . $e->getMessage(), 
                $id
            );
            return response()->json(['message' => 'Aktualizace se nezdařila.'], 500);
        }
    }

    /**
     * Deletes an application, optionally performing a hard delete to remove associated files.
     *
     * @param Request $request Flags for force deletion.
     * @param int $id Application identifier.
     * @return JsonResponse
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

            $this->logAction($request, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebJobApplication', "Smazání uchazeče ID: $id", $id);
            
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebJobApplication', "Chyba při mazání uchazeče ID: $id. Chyba: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Smazání se nezdařilo.'], 500);
        }
    }

    /**
     * Restores a soft-deleted application.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebJobApplication::withTrashed()->findOrFail($id);
            $item->restore();
            
            $this->logAction($request, 'restore', 'WebJobApplication', "Obnova uchazeče ID: $id", $id);
            
            return response()->json(new WebJobApplicationResource($item->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebJobApplication', "Chyba při obnově uchazeče ID: $id. Chyba: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Obnova se nezdařila.'], 500);
        }
    }

    /**
     * Permanently deletes all trashed applications and their associated files.
     *
     * @param Request $request
     * @return JsonResponse
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

            $this->logAction($request, 'force_delete_all', 'WebJobApplication', "Vysypání koše uchazečů. Počet: $count");
            
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebJobApplication', "Chyba při vysypávání koše uchazečů. Chyba: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše se nezdařilo.'], 500);
        }
    }

    /**
     * Logs administrative or public actions to the audit log table.
     *
     * @param Request $request Request context.
     * @param string $eventType Operation type (create, update, delete, etc.).
     * @param string $module Module context.
     * @param string $description Detailed audit message.
     * @param int|null $affectedId Entity identifier.
     * @return void
     */
    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null)
    {
        try {
            $user = $request->user();
            WebLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => $description,
                'affected_entity_type' => 'WebJobApplication',
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => json_encode($request->except(['cv_file']), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'Veřejný web (Uchazeč)'
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (WebJobApplication): " . $e->getMessage());
        }
    }
}