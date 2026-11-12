<?php
/**
 * @file WebProjectController.php
 * @path app/Http/Controllers/Api/Web/WebProjectController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Admin CRUD for customer projects, plus password regeneration and
 * nested checkpoint management.
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
use App\Models\Web\{WebProject, WebProjectCheckpoint, WebProjectSession, WebProjectThread};
use App\Models\Web\WebLog;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Traits\AppliesSafeSorting;

class WebProjectController extends Controller
{
    use LogsActivity, AppliesSafeSorting;

    /**
     * @description Fields whose old → new value the update log row names in its description
     *   (short, no personal data). Other changed fields are listed by name only - their values
     *   are in the row's `changes` (personal contacts masked, WebProject::AUDIT_MASKED).
     */
    private const LOGGED_VALUE_FIELDS = ['name', 'platform', 'visibility', 'status'];
    use HandlesAttachments;

    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebProject::query()->withCount('checkpoints')->withUnreadMessagesCount()->with(['lead', 'order']);
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

        // Only projects with client messages the administration has not read yet.
        if (filter_var($request->input('unread', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->whereHas('threadMessages', WebProjectThread::unreadByAdmin());
        }

        $this->applySorting($query, $request, 'id', 'desc');

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        if ($noPagination) {
            return $this->respond(WebProjectResource::collection($query->get()));
        }

        $data = $query->paginate($perPage);

        return $this->respondPaginated($data, WebProjectResource::class);
    }

    /**
     * @description Creates a project - from a sales order (`order_id` present) or standalone
     * (both fields absent). Generates the permanent access token AND the initial password in
     * one step and returns the plaintext password exactly once.
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

            $this->logAction($request, WebLog::class, 'create', 'WebProject', "Project created: {$project->name} (client portal password generated)", $project->id, 'WebProject');

            $response = (new WebProjectResource($project))->resolve();
            $response['generated_password'] = $plaintextPassword;

            return $this->respond($response, 201);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebProject', "Error creating project: " . $e->getMessage());
            return response()->json(['message' => 'Project creation failed.'], 500);
        }
    }

    public function show($id): JsonResponse
    {
        $project = WebProject::withTrashed()->withUnreadMessagesCount()->with(['lead', 'order', 'checkpoints'])->findOrFail($id);
        return $this->respond((new WebProjectResource($project))->resolve());
    }

    public function update(UpdateWebProjectRequest $request, $id): JsonResponse
    {
        $project = WebProject::findOrFail($id);

        try {
            $before = $project->only(self::LOGGED_VALUE_FIELDS);
            $project->update($request->validated());

            $this->logAction($request, WebLog::class, 'update', 'WebProject', $this->describeProjectUpdate($project, $before), $project->id, 'WebProject');

            $fresh = $project->fresh()->load(['lead', 'order', 'checkpoints']);
            return $this->respond((new WebProjectResource($fresh))->resolve());
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, WebLog::class, 'error', 'WebProject', "Error updating project ID {$id}: " . $e->getMessage(), (int) $id, 'WebProject');
            return response()->json(['message' => 'Project update failed.'], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $item = WebProject::withTrashed()->findOrFail($id);

        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);

            if ($forceDelete) {
                $this->cascadeDeleteProjectRelations($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebProject', "Deleted project ID: $id", (int) $id, 'WebProject');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
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

        return $this->respond(['deleted_count' => $deletedCount, 'requested' => count($ids)]);
    }

    public function restore(Request $request, $id): JsonResponse
    {
        $item = WebProject::withTrashed()->findOrFail($id);
        $item->restore();
        $this->logAction($request, WebLog::class, 'restore', 'WebProject', "Restored project ID: $id", (int) $id, 'WebProject');
        return $this->respond((new WebProjectResource($item))->resolve());
    }

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

        return $this->respond(['generated_password' => $plaintext]);
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

        return $this->respond((new WebProjectCheckpointResource($checkpoint))->resolve(), 201);
    }

    public function updateCheckpoint(UpdateProjectCheckpointRequest $request, $projectId, $checkpointId): JsonResponse
    {
        $checkpoint = WebProjectCheckpoint::findOrFail($checkpointId);

        // IDOR guard - checkpoint MUST belong to the project from the URL, not any other.
        if ((int) $checkpoint->project_id !== (int) $projectId) {
            return response()->json(['message' => 'Checkpoint does not belong to this project.'], 404);
        }

        $validated = $request->validated();
        $oldStatus = $checkpoint->status;
        $oldLabel = $checkpoint->label;
        $oldDescription = $checkpoint->description;
        $statusChanged = isset($validated['status']) && $validated['status'] !== $oldStatus;
        if ($statusChanged) {
            $checkpoint->setStatus($validated['status']);
        }
        unset($validated['status']);
        if (!empty($validated)) {
            $checkpoint->update($validated);
        }

        // Only a real change is worth a log row; the status change says from what to what.
        if ($statusChanged) {
            $this->logAction($request, WebLog::class, 'checkpoint_status', 'WebProjectCheckpoint', "Checkpoint '{$checkpoint->label}' of project #{$projectId}: status {$oldStatus} → {$checkpoint->status}", (int) $projectId, 'WebProject');
        }
        $edits = [];
        if ($checkpoint->label !== $oldLabel) {
            $edits[] = "renamed to '{$checkpoint->label}'";
        }
        if ($checkpoint->description !== $oldDescription) {
            $edits[] = 'description changed';
        }
        if ($edits !== []) {
            $this->logAction($request, WebLog::class, 'update', 'WebProjectCheckpoint', "Checkpoint '{$oldLabel}' of project #{$projectId}: " . implode(', ', $edits), (int) $projectId, 'WebProject');
        }

        return $this->respond((new WebProjectCheckpointResource($checkpoint->fresh()))->resolve());
    }

    public function destroyCheckpoint(Request $request, $projectId, $checkpointId): JsonResponse
    {
        $checkpoint = WebProjectCheckpoint::findOrFail($checkpointId);

        if ((int) $checkpoint->project_id !== (int) $projectId) {
            return response()->json(['message' => 'Checkpoint does not belong to this project.'], 404);
        }

        $checkpoint->delete();

        $this->logAction($request, WebLog::class, 'hard_delete', 'WebProjectCheckpoint', "Deleted checkpoint ID: {$checkpointId} '{$checkpoint->label}' (project #{$projectId})", (int) $projectId, 'WebProject');

        return response()->json(null, 204);
    }

    /**
     * @description Readable summary of a project update for the log, e.g.
     *   "Updated project #3 'Shop': status development → finished; changed: project_lead".
     * @param WebProject $project The updated project.
     * @param array $before Values of LOGGED_VALUE_FIELDS before the update.
     * @return string
     */
    private function describeProjectUpdate(WebProject $project, array $before): string
    {
        $changed = array_keys(array_diff_key($project->getChanges(), array_flip(['updated_at'])));
        if ($changed === []) {
            return "Updated project #{$project->id} '{$project->name}': no changes";
        }

        $parts = [];
        foreach (array_intersect(self::LOGGED_VALUE_FIELDS, $changed) as $field) {
            $parts[] = "{$field} {$before[$field]} → {$project->{$field}}";
        }
        $others = array_values(array_diff($changed, self::LOGGED_VALUE_FIELDS));
        if ($others !== []) {
            $parts[] = 'changed: ' . implode(', ', $others);
        }

        return "Updated project #{$project->id} '{$project->name}': " . implode('; ', $parts);
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