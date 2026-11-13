<?php
/**
 * @file ProjectController.php
 * @path app/Apps/ProjectPortal/Http/Controllers/ProjectController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Admin CRUD for customer projects (with the responsible administrator), the list
 * of assignable administrators, the files of a project's conversations and nested checkpoint
 * management (title, description, due date, internal note, status, order). A checkpoint status
 * change notifies the client accounts that want it (ProjectNotifier). The client accounts of the
 * portal are managed by ProjectAccountController.
 *
 * @note SECURITY (consultation note 2): checkpoint mutations verify
 * `$checkpoint->project_id === $project->id` explicitly (IDOR guard).
 * @dependencies ProjectNotifier, LogsActivity, AppliesSafeSorting, HandlesAttachments
 */

namespace App\Apps\ProjectPortal\Http\Controllers;

use App\Models\Core\CoreAttachment;
use App\Http\Controllers\Controller;
use App\Apps\ProjectPortal\Http\Requests\ReorderProjectCheckpointsRequest;
use App\Apps\ProjectPortal\Http\Requests\StoreProjectRequest;
use App\Apps\ProjectPortal\Http\Requests\UpdateProjectRequest;
use App\Apps\ProjectPortal\Http\Requests\StoreProjectCheckpointRequest;
use App\Apps\ProjectPortal\Http\Requests\UpdateProjectCheckpointRequest;
use App\Apps\ProjectPortal\Http\Resources\ProjectFileResource;
use App\Apps\ProjectPortal\Http\Resources\ProjectResource;
use App\Apps\ProjectPortal\Http\Resources\ProjectCheckpointResource;
use App\Apps\ProjectPortal\Mail\ProjectClientUpdateMail;
use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectCheckpoint;
use App\Apps\ProjectPortal\Models\ProjectSession;
use App\Apps\ProjectPortal\Models\ProjectThread;
use App\Apps\ProjectPortal\Models\ProjectThreadMessage;
use App\Apps\ProjectPortal\Services\ProjectNotifier;
use App\Apps\ProjectPortal\Services\ProjectActivityFeed;
use App\Apps\ProjectPortal\Models\ProjectApproval;
use App\Apps\ProjectPortal\Models\ProjectTemplate;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Traits\AppliesSafeSorting;

class ProjectController extends Controller
{
    use LogsActivity, AppliesSafeSorting;

    /**
     * @description Fields whose old → new value the update log row names in its description
     *   (short, no personal data). Other changed fields are listed by name only - their values
     *   are in the row's `changes` (personal contacts masked, Project::AUDIT_MASKED).
     */
    private const LOGGED_VALUE_FIELDS = ['name', 'platform', 'visibility', 'status', 'assignee_id'];
    use HandlesAttachments;

    public function __construct(private readonly ProjectNotifier $notifier) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = Project::query()->withCount('checkpoints')->withUnreadMessagesCount()->withWaitingThreadsCount()
            ->with(['assignee:id,full_name']);
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('name', 'like', "%$s%")
                ->orWhere('project_lead', 'like', "%$s%")
                ->orWhere('contact_email', 'like', "%$s%"));
        }

        // `order_id`: the project of a web order (the order list opens it or prefills a new one).
        foreach (['id', 'order_id', 'visibility', 'status', 'platform'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        if ($request->filled('created_at')) $query->whereDate('created_at', $request->created_at);

        // Only projects with client messages the administration has not read yet.
        if (filter_var($request->input('unread', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->whereHas('threadMessages', ProjectThread::unreadByAdmin());
        }

        // Only the projects of the signed-in administrator ("my projects").
        if (filter_var($request->input('assigned_to_me', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->where('assignee_id', $request->user()?->id);
        }

        $this->applySorting($query, $request, 'id', 'desc');

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        if ($noPagination) {
            return $this->respond(ProjectResource::collection($query->get()));
        }

        $data = $query->paginate($perPage);

        return $this->respondPaginated($data, ProjectResource::class);
    }

    /**
     * @description Administrators who can be responsible for a project (Project::assignableUsers()).
     * @return JsonResponse [{id, full_name}]
     */
    public function assignees(): JsonResponse
    {
        return $this->respond(Project::assignableUsers()->get(['id', 'full_name'])
            ->map(fn ($user) => ['id' => $user->id, 'full_name' => $user->full_name])->values());
    }

    /**
     * @description Creates a project - from a sales order (`order_id` present) or standalone
     * (both fields absent) - with its permanent access token. The client accounts (login name +
     * password) are added afterwards on the project page (ProjectAccountController).
     */
    public function store(StoreProjectRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();

            $project = DB::transaction(function () use ($validated) {
                $project = new Project(array_diff_key($validated, ['template_id' => true]));
                $project->status = $validated['status'] ?? 'new';
                $project->access_token = Project::generateAccessToken();
                $project->save();
                // A template fills the checkpoints (due dates from today).
                if (!empty($validated['template_id'])) {
                    ProjectTemplate::with('checkpoints')->find($validated['template_id'])?->applyTo($project);
                }

                return $project;
            });

            $this->logAction($request, ProjectPortalLog::class, 'create', 'Project', "Project created: {$project->name}"
                . (!empty($validated['template_id']) ? " from template #{$validated['template_id']}" : ''), $project->id, 'Project');

            return $this->respond((new ProjectResource($project))->resolve(), 201);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, ProjectPortalLog::class, 'error', 'Project', "Error creating project: " . $e->getMessage());
            return response()->json(['message' => 'Project creation failed.'], 500);
        }
    }

    public function show($id): JsonResponse
    {
        $project = Project::withTrashed()->withUnreadMessagesCount()->withWaitingThreadsCount()
            ->withCount([
                'accounts',
                'approvals as pending_approvals_count' => fn ($q) => $q->where('status', ProjectApproval::STATUS_PENDING),
                'updates as published_updates_count'   => fn ($q) => $q->whereNotNull('published_at'),
                'threads as open_threads_count'        => fn ($q) => $q->where('status', 'active'),
            ])
            ->with(['checkpoints', 'assignee:id,full_name'])->findOrFail($id);
        return $this->respond((new ProjectResource($project))->resolve());
    }

    /**
     * @description What happened in the project lately for the team: client messages, approval
     *   decisions, updates, checkpoint changes (ProjectActivityFeed, team audience).
     * @param int|string $id Project id.
     * @return JsonResponse
     */
    public function activity($id): JsonResponse
    {
        $project = Project::withTrashed()->findOrFail($id);

        return $this->respond(app(ProjectActivityFeed::class)->build($project, ProjectActivityFeed::AUDIENCE_TEAM, 40)->values());
    }

    public function update(UpdateProjectRequest $request, $id): JsonResponse
    {
        $project = Project::findOrFail($id);

        try {
            $before = $project->only(self::LOGGED_VALUE_FIELDS);
            $project->update($request->validated());

            $this->logAction($request, ProjectPortalLog::class, 'update', 'Project', $this->describeProjectUpdate($project, $before), $project->id, 'Project');

            $fresh = $project->fresh()->load(['checkpoints', 'assignee:id,full_name']);
            return $this->respond((new ProjectResource($fresh))->resolve());
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, ProjectPortalLog::class, 'error', 'Project', "Error updating project ID {$id}: " . $e->getMessage(), (int) $id, 'Project');
            return response()->json(['message' => 'Project update failed.'], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $item = Project::withTrashed()->findOrFail($id);

        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);

            if ($forceDelete) {
                $this->cascadeDeleteProjectRelations($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, ProjectPortalLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'Project', "Deleted project ID: $id", (int) $id, 'Project');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, ProjectPortalLog::class, 'error', 'Project', "Error deleting project ID $id: " . $e->getMessage(), (int) $id, 'Project');
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
            foreach (Project::withTrashed()->whereIn('id', $ids)->get() as $item) {
                if ($forceDelete) {
                    $this->cascadeDeleteProjectRelations($item);
                    $item->forceDelete();
                } else {
                    $item->delete();
                }
                $deletedCount++;
            }
        });

        $this->logAction($request, ProjectPortalLog::class, $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk', 'Project', "Bulk deletion of {$deletedCount} projects.");

        return $this->respond(['deleted_count' => $deletedCount, 'requested' => count($ids)]);
    }

    public function restore(Request $request, $id): JsonResponse
    {
        $item = Project::withTrashed()->findOrFail($id);
        $item->restore();
        $this->logAction($request, ProjectPortalLog::class, 'restore', 'Project', "Restored project ID: $id", (int) $id, 'Project');
        return $this->respond((new ProjectResource($item))->resolve());
    }

    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        $trashed = Project::onlyTrashed()->get();
        $count = $trashed->count();

        foreach ($trashed as $item) {
            $this->cascadeDeleteProjectRelations($item);
            $item->forceDelete();
        }

        $this->logAction($request, ProjectPortalLog::class, 'force_delete_all', 'Project', "Emptied project trash. Count: $count");
        return response()->json(null, 204);
    }

    /**
     * @description Every file of the project's conversations for the administration - also the
     *   attachments of internal notes (flagged) - newest first, with thread and author.
     * @param int|string $id Project id.
     * @return JsonResponse
     */
    public function files($id): JsonResponse
    {
        $project = Project::withTrashed()->findOrFail($id);

        return $this->respond(ProjectFileResource::collection(app(\App\Apps\ProjectPortal\Services\ProjectFiles::class)->of($project, forClient: false)));
    }

    // ── Checkpoints (nested under project) ───────────────────────────────────

    public function storeCheckpoint(StoreProjectCheckpointRequest $request, $projectId): JsonResponse
    {
        $project = Project::findOrFail($projectId);
        $validated = $request->validated();
        $validated['sort_order'] = $validated['sort_order'] ?? (($project->checkpoints()->max('sort_order') ?? -1) + 1);
        $validated['status'] = $validated['status'] ?? 'new';

        $checkpoint = $project->checkpoints()->create($validated);

        $this->logAction($request, ProjectPortalLog::class, 'create', 'ProjectCheckpoint', "Added checkpoint '{$checkpoint->label}' to project ID: {$project->id}", $project->id, 'Project');

        return $this->respond((new ProjectCheckpointResource($checkpoint))->resolve(), 201);
    }

    public function updateCheckpoint(UpdateProjectCheckpointRequest $request, $projectId, $checkpointId): JsonResponse
    {
        $checkpoint = ProjectCheckpoint::findOrFail($checkpointId);

        // IDOR guard - checkpoint MUST belong to the project from the URL, not any other.
        if ((int) $checkpoint->project_id !== (int) $projectId) {
            return response()->json(['message' => 'Checkpoint does not belong to this project.'], 404);
        }

        $validated = $request->validated();
        $oldStatus = $checkpoint->status;
        $oldLabel = $checkpoint->label;
        $before = $checkpoint->only(['description', 'due_date', 'internal_note']);
        $statusChanged = isset($validated['status']) && $validated['status'] !== $oldStatus;
        if ($statusChanged) {
            $checkpoint->setStatus($validated['status']);
        }
        unset($validated['status']);
        if (!empty($validated)) {
            $checkpoint->update($validated);
        }

        // Only a real change is worth a log row; the status change says from what to what and the
        // client accounts that want it get an e-mail.
        if ($statusChanged) {
            $project = $checkpoint->project;
            $notified = $project ? $this->notifier->notifyClients($project, ProjectClientUpdateMail::KIND_CHECKPOINT, $checkpoint->label, $checkpoint->status) : 0;
            $this->logAction($request, ProjectPortalLog::class, 'checkpoint_status', 'ProjectCheckpoint', "Checkpoint '{$checkpoint->label}' of project #{$projectId}: status {$oldStatus} → {$checkpoint->status}"
                . ($notified ? " ({$notified} client e-mails)" : ''), (int) $projectId, 'Project');
        }
        $edits = [];
        if ($checkpoint->label !== $oldLabel) {
            $edits[] = "renamed to '{$checkpoint->label}'";
        }
        $after = $checkpoint->only(['description', 'due_date', 'internal_note']);
        foreach (['description' => 'description', 'due_date' => 'due date', 'internal_note' => 'internal note'] as $field => $name) {
            if ($this->differs($before[$field], $after[$field])) {
                $edits[] = "{$name} changed";
            }
        }
        // A new / changed / removed due date → the client accounts that want it get an e-mail.
        if ($this->differs($before['due_date'], $after['due_date']) && ($project = $checkpoint->project)) {
            $notified = $this->notifier->notifyClients($project, ProjectClientUpdateMail::KIND_CHECKPOINT_DATE, $checkpoint->label,
                null, $after['due_date']?->format('Y-m-d'));
            if ($notified) {
                $edits[] = "{$notified} client e-mails about the due date";
            }
        }
        if ($edits !== []) {
            $this->logAction($request, ProjectPortalLog::class, 'update', 'ProjectCheckpoint', "Checkpoint '{$oldLabel}' of project #{$projectId}: " . implode(', ', $edits), (int) $projectId, 'Project');
        }

        return $this->respond((new ProjectCheckpointResource($checkpoint->fresh()))->resolve());
    }

    public function destroyCheckpoint(Request $request, $projectId, $checkpointId): JsonResponse
    {
        $checkpoint = ProjectCheckpoint::findOrFail($checkpointId);

        if ((int) $checkpoint->project_id !== (int) $projectId) {
            return response()->json(['message' => 'Checkpoint does not belong to this project.'], 404);
        }

        $checkpoint->delete();

        $this->logAction($request, ProjectPortalLog::class, 'hard_delete', 'ProjectCheckpoint', "Deleted checkpoint ID: {$checkpointId} '{$checkpoint->label}' (project #{$projectId})", (int) $projectId, 'Project');

        return response()->json(null, 204);
    }

    /**
     * @description New order of the checkpoints: `ids` must be exactly the project's checkpoints
     *   (each once) - their positions become 0, 1, 2, … in that order.
     * @param ReorderProjectCheckpointsRequest $request
     * @param int|string $projectId
     * @return JsonResponse The checkpoints in the new order; 422 when the ids do not match.
     */
    public function reorderCheckpoints(ReorderProjectCheckpointsRequest $request, $projectId): JsonResponse
    {
        $project = Project::findOrFail($projectId);
        $ids = array_map('intval', $request->validated()['ids']);
        $existing = $project->checkpoints()->pluck('id')->map(fn ($id) => (int) $id)->all();

        if (count($ids) !== count($existing) || array_diff($ids, $existing) !== []) {
            return response()->json([
                'message' => 'The order must list every checkpoint of the project exactly once.',
                'errors'  => ['ids' => ['The order must list every checkpoint of the project exactly once.']],
            ], 422);
        }

        DB::transaction(function () use ($project, $ids) {
            foreach ($ids as $position => $id) {
                $project->checkpoints()->whereKey($id)->update(['sort_order' => $position]);
            }
        });

        $this->logAction($request, ProjectPortalLog::class, 'checkpoint_order', 'ProjectCheckpoint', "Checkpoints of project #{$project->id} reordered", $project->id, 'Project');

        return $this->respond(ProjectCheckpointResource::collection($project->checkpoints()->get()));
    }

    /**
     * @description Whether two stored values differ (dates compared as Y-m-d).
     * @param mixed $old
     * @param mixed $new
     * @return bool
     */
    private function differs(mixed $old, mixed $new): bool
    {
        $normalize = fn ($value) => $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : $value;

        return $normalize($old) !== $normalize($new);
    }

    /**
     * @description Readable summary of a project update for the log, e.g.
     *   "Updated project #3 'Shop': status development → finished; changed: project_lead".
     * @param Project $project The updated project.
     * @param array $before Values of LOGGED_VALUE_FIELDS before the update.
     * @return string
     */
    private function describeProjectUpdate(Project $project, array $before): string
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
     * behind: active customer sessions, client accounts, checkpoints, and threads - each thread's
     * messages, and each message's file attachments (both the DB record AND the
     * physical file on disk, via `HandlesAttachments::deleteAllAttachments()`).
     * Called EXCLUSIVELY from the `forceDelete()` code path (see
     * `destroy()`/`bulkDestroy()`/`forceDeleteAllTrashed()`) - a plain soft
     * `->delete()` must NEVER call this, since the project can still be restored
     * and its conversation history/checkpoints must remain intact in that case.
     * @param Project $project The project about to be force-deleted.
     */
    private function cascadeDeleteProjectRelations(Project $project): void
    {
        ProjectSession::where('project_id', $project->id)->delete();
        $project->accounts()->delete();

        // Approvals and updates carry files (decisions go with their approval by FK cascade).
        foreach ($project->approvals()->with('attachments')->get() as $approval) {
            $this->deleteAllAttachments($approval);
            $approval->delete();
        }
        foreach ($project->updates()->with('attachments')->get() as $update) {
            $this->deleteAllAttachments($update);
            $update->delete();
        }

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