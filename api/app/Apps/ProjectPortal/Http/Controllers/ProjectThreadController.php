<?php
/**
 * @file ProjectThreadController.php
 * @path app/Apps/ProjectPortal/Http/Controllers/ProjectThreadController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Admin view of customer conversation threads: list (with unread counts and whose
 * turn it is), detail with ALL messages including the team's internal notes, replies (a reply
 * notifies the client accounts that want it; an internal note never reaches the client and does
 * not change whose turn it is), status changes.
 * @dependencies ProjectNotifier, HandlesAttachments, LogsActivity, AppliesSafeSorting
 */

namespace App\Apps\ProjectPortal\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\ProjectPortal\Http\Requests\StoreProjectThreadMessageRequest;
use App\Apps\ProjectPortal\Http\Resources\ProjectThreadResource;
use App\Apps\ProjectPortal\Http\Resources\ProjectThreadMessageResource;
use App\Apps\ProjectPortal\Mail\ProjectClientUpdateMail;
use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectThread;
use App\Apps\ProjectPortal\Models\ProjectThreadMessage;
use App\Apps\ProjectPortal\Services\ProjectNotifier;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\AppliesSafeSorting;

class ProjectThreadController extends Controller
{
    use LogsActivity, AppliesSafeSorting;
    use HandlesAttachments;

    /** Storage folder for thread message attachments within the private disk. */
    private const ATTACHMENT_FOLDER = 'web/project_threads';

    public function __construct(private readonly ProjectNotifier $notifier) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $query = ProjectThread::query()->with(['project:id,name', 'assignee:id,full_name'])->withAdminUnreadCount();

        if ($request->filled('project_id')) $query->where('project_id', $request->input('project_id'));
        // Only the threads assigned to the signed-in administrator ("my threads").
        if (filter_var($request->input('assigned_to_me', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->where('assignee_id', $request->user()?->id);
        }
        if ($request->filled('priority')) $query->where('priority', $request->input('priority'));
        if ($request->filled('status')) $query->where('status', $request->input('status'));

        $this->applySorting($query, $request, 'last_message_at', 'desc');

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        if ($noPagination) {
            return $this->respond(ProjectThreadResource::collection($query->get()));
        }

        $data = $query->paginate($perPage);

        return $this->respondPaginated($data, ProjectThreadResource::class);
    }

    public function show($id): JsonResponse
    {
        $thread = ProjectThread::with(['project:id,name', 'assignee:id,full_name'])->findOrFail($id);
        // An admin opened it: the client's messages are no longer new for the administration.
        $thread->markReadByAdmin();

        [$messages, $hasMore] = $thread->pagedMessages(null, withInternal: true);
        $thread->setRelation('messages', $messages);

        return $this->respond(new ProjectThreadResource($thread), 200, ['has_more_older_messages' => $hasMore]);
    }

    /**
     * @description Returns `$limit` messages OLDER than `before_message_id` ("Load older
     * messages"). A FLAT list of messages (not the whole thread) - the frontend prepends it.
     */
    public function olderMessages(Request $request, $threadId): JsonResponse
    {
        $thread = ProjectThread::findOrFail($threadId);
        $beforeId = $request->input('before_message_id');
        $limit = min((int) $request->input('limit', ProjectThread::DEFAULT_MESSAGE_PAGE_SIZE), 100);

        [$messages, $hasMore] = $thread->pagedMessages($beforeId ? (int) $beforeId : null, $limit, withInternal: true);

        return $this->respond(ProjectThreadMessageResource::collection($messages), 200, ['has_more_older_messages' => $hasMore]);
    }

    /**
     * @description Reply of an administrator, or an internal note of the team (`is_internal`).
     *   The author's full name is stored as the message's name snapshot (the client sees the name,
     *   never an e-mail). A reply moves the thread (last activity, the client's turn) and notifies
     *   the client accounts that want it; an internal note changes neither and is never shown to
     *   the client.
     * @param StoreProjectThreadMessageRequest $request body, attachments[], is_internal
     * @param int|string $threadId
     * @return JsonResponse 201 message
     */
    public function reply(StoreProjectThreadMessageRequest $request, $threadId): JsonResponse
    {
        $thread = ProjectThread::with('project')->findOrFail($threadId);
        $user = $request->user();
        $internal = $request->boolean('is_internal');

        $message = $thread->messages()->create([
            'author_type'  => 'admin',
            'author_label' => $user->full_name ?: 'Administrator',
            'user_id'      => $user->id,
            'is_internal'  => $internal,
            'body'         => $request->validated()['body'],
        ]);

        $this->storeAttachments($request, $message, self::ATTACHMENT_FOLDER);

        if ($internal) {
            $thread->markReadByAdmin();
        } else {
            $thread->update(['last_message_at' => now(), 'admin_last_read_at' => now(), 'last_public_author' => 'admin']);
            if ($thread->project) {
                $this->notifier->notifyClients($thread->project, ProjectClientUpdateMail::KIND_REPLY, $thread->subject);
            }
        }
        // Not logged: who wrote which message is the conversation itself (kept in the thread),
        // the audit log keeps the decisions - thread closed / reopened, project changes.

        return $this->respond(new ProjectThreadMessageResource($message->load('attachments')), 201);
    }

    /**
     * @description Quick thread status change (active/closed) - independent of
     * reply(), so an admin can close a thread without writing a reply.
     */
    public function updateStatus(Request $request, $threadId): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:' . implode(',', ProjectThread::STATUSES)],
        ]);

        $thread = ProjectThread::findOrFail($threadId);
        $oldStatus = $thread->status;
        $thread->update(['status' => $validated['status']]);

        if ($oldStatus !== $thread->status) {
            $closed = $thread->status === 'closed';
            $this->logAction($request, ProjectPortalLog::class, $closed ? 'thread_close' : 'thread_reopen', 'ProjectThread',
                ($closed ? 'Closed' : 'Reopened') . " thread #{$thread->id} of project #{$thread->project_id}", $thread->project_id, 'Project');
        }

        return $this->respond((new ProjectThreadResource($thread->fresh()))->resolve());
    }

    /**
     * @description Assigns the thread to an administrator who may edit projects (or nobody);
     *   the new assignee is e-mailed (not when assigning to oneself). Client notifications of the
     *   thread then go to them.
     * @param Request $request {assignee_id: int|null}
     * @param int|string $threadId
     * @return JsonResponse The thread (assignee_id, assignee_name).
     */
    public function assign(Request $request, $threadId): JsonResponse
    {
        $validated = $request->validate([
            'assignee_id' => ['present', 'nullable', 'integer', \Illuminate\Validation\Rule::in(Project::assignableUsers()->pluck('id')->all())],
        ]);
        $thread = ProjectThread::with(['project', 'assignee:id,full_name'])->findOrFail($threadId);
        $before = $thread->assignee_id;
        $thread->update(['assignee_id' => $validated['assignee_id']]);
        $thread->load('assignee:id,full_name,user_email,is_blocked');

        if ((int) $before !== (int) $thread->assignee_id) {
            $this->logAction($request, ProjectPortalLog::class, 'thread_assign', 'ProjectThread',
                "Thread #{$thread->id} of project #{$thread->project_id} assigned to " . ($thread->assignee_id ? "user #{$thread->assignee_id}" : 'nobody'),
                $thread->project_id, 'Project');
            if ($thread->assignee && $thread->project) {
                $this->notifier->notifyThreadAssigned($thread->project, $thread, $thread->assignee, $request->user());
            }
        }

        return $this->respond((new ProjectThreadResource($thread->fresh(['assignee:id,full_name'])))->resolve());
    }
}
