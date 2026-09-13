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
 * (Earlier bugfix-note 2026-08-29b for the ['data' => ...] wrapping consistency is
 * unchanged - see version history.)
 *
 * @note SECURITY (consultation note 3): regeneratePassword() invalidates ALL existing
 * customer sessions for the project and returns the new PLAINTEXT password exactly
 * once - it is never recoverable again after this response.
 * @note SECURITY (consultation note 2): checkpoint mutations verify
 * `$checkpoint->project_id === $project->id` explicitly (IDOR guard).
 *
 * @bugfix-note (2026-09-11v7) BACKLOG "smazaný projekt zanechává osiřelá vlákna":
 * `destroy()`/`bulkDestroy()`/`forceDeleteAllTrashed()` nikdy neuklízely navázaná
 * `checkpoints`/`sessions`/`threads` (+ jejich `messages` + přílohy zpráv) při
 * TRVALÉM smazání (`forceDelete()`) - zůstávaly osiřelé v DB a přílohy fyzicky na
 * disku. Nová `cascadeDeleteProjectRelations()` metoda uklízí vše v jednom místě,
 * volaná ze všech tří force-delete cest. SOFT delete (`->delete()`) ZÁMĚRNĚ beze
 * změny - projekt lze obnovit, takže vlákna/checkpointy musí zůstat netknuté.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Web\WebProject\{StoreWebProjectRequest, UpdateWebProjectRequest, StoreProjectCheckpointRequest, UpdateProjectCheckpointRequest};
use App\Http\Resources\Web\{WebProjectResource, WebProjectCheckpointResource};
use App\Models\Web\{WebProject, WebProjectCheckpoint, WebProjectSession};
use App\Models\Web\WebLog;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class WebProjectController extends Controller
{
    use LogsActivity;
    use HandlesAttachments;

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

    /**
     * @bugfix-note (2026-09-11v7) `forceDelete` větev teď volá
     * `cascadeDeleteProjectRelations()` PŘED samotným smazáním projektu - viz
     * hlavička souboru.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebProject::withTrashed()->findOrFail($id);

            if ($forceDelete) {
                $this->cascadeDeleteProjectRelations($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebProject', "Deleted project ID: $id", (int) $id, 'WebProject');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebProject', "Error deleting project ID $id: " . $e->getMessage(), (int) $id, 'WebProject');
            return response()->json(['message' => 'Project deletion failed.'], 500);
        }
    }

    /**
     * @bugfix-note (2026-09-11v7) Stejná cascade cleanup logika jako `destroy()` -
     * viz hlavička souboru.
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
        $deletedCount = 0;

        DB::transaction(function () use ($ids, $forceDelete, &$deletedCount) {
            foreach (WebProject::withTrashed()->whereIn('id', $ids)->get() as $item) {
                if ($forceDelete) {
                    $this->cascadeDeleteProjectRelations($item);
                    $item->forceDelete();
                } else {
                    $item->delete();
                }
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

    /**
     * @bugfix-note (2026-09-11v7) Stejná cascade cleanup logika jako `destroy()` -
     * viz hlavička souboru. Trash je vždy 100% force-delete, takže cleanup se
     * volá bezpodmínečně pro každou položku.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        $trashed = WebProject::onlyTrashed()->get();
        $count = $trashed->count();

        foreach ($trashed as $item) {
            $this->cascadeDeleteProjectRelations($item);
            $item->forceDelete();
        }

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

    /**
     * @description Cleans up EVERYTHING that a permanently-deleted project leaves
     * behind: active customer sessions, checkpoints, and threads - each thread's
     * messages, and each message's file attachments (both the DB record AND the
     * physical file on disk, via `HandlesAttachments::deleteAllAttachments()`).
     * Called EXCLUSIVELY from the `forceDelete()` code path (see
     * `destroy()`/`bulkDestroy()`/`forceDeleteAllTrashed()`) - a plain soft
     * `->delete()` must NEVER call this, since the project can still be restored
     * and its conversation history/checkpoints must remain intact in that case.
     * @param WebProject $project The project about to be force-deleted.
     */
    private function cascadeDeleteProjectRelations(WebProject $project): void
    {
        WebProjectSession::where('project_id', $project->id)->delete();

        $project->checkpoints()->delete();

        $threads = $project->threads()->with('messages.attachments')->get();
        foreach ($threads as $thread) {
            foreach ($thread->messages as $message) {
                $this->deleteAllAttachments($message);
                $message->delete();
            }
            $thread->delete();
        }
    }
}