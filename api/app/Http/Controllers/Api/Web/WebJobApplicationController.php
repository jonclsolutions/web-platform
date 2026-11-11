<?php
/**
 * @file WebJobApplicationController.php
 * @path app/Http/Controllers/Api/Web/WebJobApplicationController.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages the lifecycle of job applications, including document handling (CVs), status updates, and soft-delete administrative workflows.
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
use App\Traits\AppliesSafeSorting;

/**
 * @description Controller responsible for processing incoming job applications and managing applicant records.
 * @note Implements file storage logic for CV uploads (via HandlesAttachments) and integrates with the central logging system.
 */
class WebJobApplicationController extends Controller
{
    use HandlesAttachments, AppliesSafeSorting;
    use LogsActivity;

    /**
     * @description Storage folder of the CV uploads on the private disk (default of storeSingleAttachment()).
     */
    private const CV_FOLDER = 'web/cv_files';

    /**
     * Retrieves a paginated list of job applications with optional search and filtering.
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

        // Exact match - the ID is numeric, LIKE makes no sense here.
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

        $this->applySorting($query, $request, 'id', 'desc');

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        $data = $noPagination ? $query->get() : $query->paginate($perPage);

        if ($noPagination) {
            return $this->respond(WebJobApplicationResource::collection($data));
        }

        return $this->respondPaginated($data, WebJobApplicationResource::class);
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

            $this->logAction($request, WebLog::class, 'create', 'WebJobApplication', "New job application for position: {$application->position_name} ({$application->first_name} {$application->last_name})", $application->id, 'WebJobApplication');

            return $this->respond(new WebJobApplicationResource($application->load('attachments')), 201);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebJobApplication', "Error creating job application: " . $e->getMessage());
            return response()->json(['message' => 'Creation failed.'], 500);
        }
    }

    /**
     * Retrieves the details of a single job application by ID, including soft-deleted ones.
     */
    public function show($id): JsonResponse
    {
        $jobApplication = WebJobApplication::withTrashed()->with('attachments')->findOrFail($id);
        return $this->respond(new WebJobApplicationResource($jobApplication));
    }

    /**
     * Updates an existing application and replaces the CV file if a new one is provided.
     */
    public function update(UpdateWebJobApplicationRequest $request, $id): JsonResponse
    {
        $jobApplication = WebJobApplication::withTrashed()->findOrFail($id);

        try {
            $validated = $request->validated();
            unset($validated['cv_file']);

            $jobApplication->update($validated);

            $this->storeSingleAttachment($request, $jobApplication, self::CV_FOLDER, 'cv_file');

            $this->logAction(
                $request,
                WebLog::class,
                'update',
                'WebJobApplication',
                "Updated job application ID: {$id}. State: " . ($validated['state'] ?? 'unchanged'),
                (int) $id,
                'WebJobApplication'
            );

            return $this->respond(new WebJobApplicationResource($jobApplication->fresh()->load('attachments')));
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction(
                $request,
                WebLog::class,
                'error',
                'WebJobApplication',
                "Error updating job application ID: {$id}. Error: " . $e->getMessage(),
                (int) $id,
                'WebJobApplication'
            );
            return response()->json(['message' => 'Update failed.'], 500);
        }
    }

    /**
     * Deletes an application, optionally performing a hard delete to remove associated files.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $item = WebJobApplication::withTrashed()->with('attachments')->findOrFail($id);

        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);

            if ($forceDelete) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebJobApplication', "Deleted job application ID: $id", (int) $id, 'WebJobApplication');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebJobApplication', "Error deleting job application ID: $id. Error: " . $e->getMessage(), (int) $id, 'WebJobApplication');
            return response()->json(['message' => 'Deletion failed.'], 500);
        }
    }

    /**
     * @description Deletes the selected applicants in ONE request (TableBuilderComponent
     * onBulkDeleteClick() → POST web/job_applications/bulk-delete).
     * @note Repeats the logic of `destroy()` on purpose instead of a generic
     * `Model::destroy($ids)`, which would skip deleting the attachments
     * (`deleteAllAttachments()`) on `force_delete=true` and leave orphaned CV files.
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
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebJobApplication', "Error during bulk deletion of job applications: " . $e->getMessage());
            return response()->json(['message' => 'Bulk deletion failed.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebJobApplication',
            'Bulk ' . ($forceDelete ? 'permanent ' : '') . "deletion of {$deletedCount} job applications (requested {$requestedCount}, IDs: {$idsPreview}).",
            null,
            'WebJobApplication'
        );

        return $this->respond([
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]);
    }

    /**
     * Restores a soft-deleted application.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $item = WebJobApplication::withTrashed()->findOrFail($id);

        try {
            $item->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebJobApplication', "Restored job application ID: $id", (int) $id, 'WebJobApplication');

            return $this->respond(new WebJobApplicationResource($item->load('attachments')));
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebJobApplication', "Error restoring job application ID: $id. Error: " . $e->getMessage(), (int) $id, 'WebJobApplication');
            return response()->json(['message' => 'Restoration failed.'], 500);
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

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebJobApplication', "Emptied job application trash. Count: $count");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebJobApplication', "Error emptying job application trash. Error: " . $e->getMessage());
            return response()->json(['message' => 'Emptying trash failed.'], 500);
        }
    }
}