<?php
/**
 * @file WebProjectController.php
 * @path app/Http/Controllers/Api/Web/WebProjectController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Admin CRUD for customer projects, plus password regeneration and
 * nested checkpoint management.
 *
 * @bugfix-note (2026-08-29b) CRITICAL BUG - "Cannot read properties of undefined
 * (reading 'id')" in checkpoint @for loop. `show()`/`update()`/`restore()`/
 * `storeCheckpoint()`/`updateCheckpoint()` returned `response()->json(new XResource(...))`
 * WITHOUT manual wrapping in `['data' => ...]`. Laravel does NOT automatically wrap
 * a JsonResource passed to `response()->json()` (that mechanism - `ResourceResponse::wrap()`
 * - only runs when a Resource is returned directly from a route, not when passed as an argument
 * to `response()->json()`, which instead calls `jsonSerialize()`, performing no wrapping).
 * Frontend `DataHandler.post()/put()/getOne()` (data-handler.service.ts)
 * always does `map(response => response.data)` - without the wrapper, it receives `undefined`.
 * `store()`/`regeneratePassword()` did NOT have this bug because they already explicitly
 * returned `['data' => ...]`. Now ALL methods returning a single record do so uniformly.
 * `index()` (collection) and `bulkDestroy()`/`forceDeleteAllTrashed()` unchanged -
 * `index()` has its own pagination shape, `WebProjectResource::collection()` inside
 * `WebProjectResource::collection($data->items())` is handled differently (frontend reads
 * the whole response object, not `.data` of a single item).
 *
 * @note SECURITY (consultation note 3): regeneratePassword() invalidates ALL existing
 * customer sessions for the project and returns the new PLAINTEXT password exactly
 * once - it is never recoverable again after this response.
 * @note SECURITY (consultation note 2): checkpoint mutations verify
 * `$checkpoint->project_id === $project->id` explicitly (IDOR guard).
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Web\WebProject\{StoreWebProjectRequest, UpdateWebProjectRequest, StoreProjectCheckpointRequest, UpdateProjectCheckpointRequest};
use App\Http\Resources\Web\{WebProjectResource, WebProjectCheckpointResource};
use App\Models\Web\{WebProject, WebProjectCheckpoint, WebProjectSession};
use App\Models\Web\WebLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class WebProjectController extends Controller
{
    use LogsActivity;

    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebProject::query()->withCount('checkpoints')->with(['lead', 'order']);
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('name', 'like', "%$s%")
                ->orWhere('project_lead', 'like', "%$s%")
                ->orWhere('contact_email', 'like', "%$s%"));
        }

        foreach (['id', 'visibility', 'status', 'platform'] as $f)  {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        if ($request->filled('created_at')) $query->whereDate('created_at', $request->created_at);

        $sortBy = $request->input('sort_by', 'id');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        if ($noPagination) {
            return response()->json(WebProjectResource::collection($query->get()));
        }

        $data = $query->paginate($perPage);

        return response()->json([
            'data'         => WebProjectResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * @description Creates a project - store() itself doesn't care whether it came
     * from "Založit projekt" (sales order, `order_id` present) or a fully standalone
     * "Nový projekt" (both fields absent). Generates the permanent access token AND
     * the initial password in one step, returning the plaintext password exactly once.
     */
    public function store(StoreWebProjectRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $validated['access_token'] = WebProject::generateAccessToken();
            $validated['access_password_hash'] = 'pending'; // overwritten right below by regeneratePassword()

            $project = new WebProject($validated);
            $project->status = $validated['status'] ?? 'new';
            $project->access_token = $validated['access_token'];
            $project->access_password_hash = $validated['access_password_hash'];
            $project->save();

            $plaintextPassword = $project->regeneratePassword();

            $this->logAction($request, WebLog::class, 'create', 'WebProject', "Project created: {$project->name}", $project->id, 'WebProject');

            $response = (new WebProjectResource($project))->resolve();
            $response['generated_password'] = $plaintextPassword;

            return response()->json(['data' => $response], 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebProject', "Error creating project: " . $e->getMessage());
            return response()->json(['message' => 'Project creation failed.'], 500);
        }
    }

    public function show($id): JsonResponse
    {
        $project = WebProject::withTrashed()->with(['lead', 'order', 'checkpoints'])->findOrFail($id);
        return response()->json(['data' => (new WebProjectResource($project))->resolve()]);
    }

    public function update(UpdateWebProjectRequest $request, $id): JsonResponse
    {
        try {
            $project = WebProject::findOrFail($id);
            $project->update($request->validated());

            $this->logAction($request, WebLog::class, 'update', 'WebProject', "Updated project ID: {$project->id}", $project->id, 'WebProject');

            $fresh = $project->fresh()->load(['lead', 'order', 'checkpoints']);
            return response()->json(['data' => (new WebProjectResource($fresh))->resolve()]);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebProject', "Error updating project ID {$id}: " . $e->getMessage(), (int) $id, 'WebProject');
            return response()->json(['message' => 'Project update failed.'], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebProject::withTrashed()->findOrFail($id);

            $forceDelete ? $item->forceDelete() : $item->delete();

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebProject', "Deleted project ID: $id", (int) $id, 'WebProject');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebProject', "Error deleting project ID $id: " . $e->getMessage(), (int) $id, 'WebProject');
            return response()->json(['message' => 'Project deletion failed.'], 500);
        }
    }

    public function bulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids'          => ['required', 'array', 'min:1', 'max:1000'],
            'ids.*'        => ['integer'],
            'force_delete' => ['sometimes', 'boolean'],
        ]);

        $ids = array_values(array_unique(array_map('intval', $validated['ids'])));
        $forceDelete = filter_var($validated['force_delete'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $deletedCount = 0;

        DB::transaction(function () use ($ids, $forceDelete, &$deletedCount) {
            foreach (WebProject::withTrashed()->whereIn('id', $ids)->get() as $item) {
                $forceDelete ? $item->forceDelete() : $item->delete();
                $deletedCount++;
            }
        });

        $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk', 'WebProject', "Bulk deletion of {$deletedCount} projects.");

        return response()->json(['data' => ['deleted_count' => $deletedCount, 'requested' => count($ids)]]);
    }

    public function restore(Request $request, $id): JsonResponse
    {
        $item = WebProject::withTrashed()->findOrFail($id);
        $item->restore();
        $this->logAction($request, WebLog::class, 'restore', 'WebProject', "Restored project ID: $id", (int) $id, 'WebProject');
        return response()->json(['data' => (new WebProjectResource($item))->resolve()]);
    }

    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        $count = WebProject::onlyTrashed()->count();
        WebProject::onlyTrashed()->forceDelete();
        $this->logAction($request, WebLog::class, 'force_delete_all', 'WebProject', "Emptied project trash. Count: $count");
        return response()->json(null, 204);
    }

    /**
     * @description Generates a new password (overwriting the old one, which expires
     * immediately) and invalidates ALL active sessions for the given project. Returns the plaintext
     * password exactly once.
     */
    public function regeneratePassword(Request $request, $id): JsonResponse
    {
        $project = WebProject::findOrFail($id);

        $plaintext = $project->regeneratePassword();
        $invalidatedSessions = WebProjectSession::where('project_id', $project->id)->delete();

        $this->logAction(
            $request,
            WebLog::class,
            'regenerate_password',
            'WebProject',
            "Generated new password for project ID: {$project->id} (invalidated {$invalidatedSessions} active sessions).",
            $project->id,
            'WebProject'
        );

        return response()->json(['data' => ['generated_password' => $plaintext]]);
    }

    // ── Checkpoints (nested under project) ───────────────────────────────────

    public function storeCheckpoint(StoreProjectCheckpointRequest $request, $projectId): JsonResponse
    {
        $project = WebProject::findOrFail($projectId);
        $validated = $request->validated();
        $validated['sort_order'] = $validated['sort_order'] ?? (($project->checkpoints()->max('sort_order') ?? -1) + 1);
        $validated['status'] = $validated['status'] ?? 'new';

        $checkpoint = $project->checkpoints()->create($validated);

        $this->logAction($request, WebLog::class, 'create', 'WebProjectCheckpoint', "Added checkpoint '{$checkpoint->label}' to project ID: {$project->id}", $project->id, 'WebProject');

        return response()->json(['data' => (new WebProjectCheckpointResource($checkpoint))->resolve()], 201);
    }

    public function updateCheckpoint(UpdateProjectCheckpointRequest $request, $projectId, $checkpointId): JsonResponse
    {
        $checkpoint = WebProjectCheckpoint::findOrFail($checkpointId);

        // IDOR guard - checkpoint MUST belong to the project from the URL, not any other.
        if ((int) $checkpoint->project_id !== (int) $projectId) {
            return response()->json(['message' => 'Checkpoint does not belong to this project.'], 404);
        }

        $validated = $request->validated();
        if (isset($validated['status']) && $validated['status'] !== $checkpoint->status) {
            $checkpoint->setStatus($validated['status']);
            unset($validated['status']);
        }
        if (!empty($validated)) {
            $checkpoint->update($validated);
        }

        $this->logAction($request, WebLog::class, 'update', 'WebProjectCheckpoint', "Updated checkpoint ID: {$checkpoint->id} (project ID: {$projectId})", (int) $projectId, 'WebProject');

        return response()->json(['data' => (new WebProjectCheckpointResource($checkpoint->fresh()))->resolve()]);
    }

    public function destroyCheckpoint(Request $request, $projectId, $checkpointId): JsonResponse
    {
        $checkpoint = WebProjectCheckpoint::findOrFail($checkpointId);

        if ((int) $checkpoint->project_id !== (int) $projectId) {
            return response()->json(['message' => 'Checkpoint does not belong to this project.'], 404);
        }

        $checkpoint->delete();

        $this->logAction($request, WebLog::class, 'hard_delete', 'WebProjectCheckpoint', "Deleted checkpoint ID: {$checkpointId} (project ID: {$projectId})", (int) $projectId, 'WebProject');

        return response()->json(null, 204);
    }
}