<?php
/**
 * @file WebProjectThreadController.php
 * @path app/Http/Controllers/Api/Web/WebProjectThreadController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Admin view of customer conversation threads.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Web\WebProject\StoreProjectThreadMessageRequest;
use App\Http\Resources\Web\{WebProjectThreadResource, WebProjectThreadMessageResource};
use App\Models\Web\{WebProjectThread, WebProjectThreadMessage};
use App\Models\Web\WebLog;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\AppliesSafeSorting;

class WebProjectThreadController extends Controller
{
    use LogsActivity, AppliesSafeSorting;
    use HandlesAttachments;

    /** Storage folder for thread message attachments within the private disk. */
    private const ATTACHMENT_FOLDER = 'web/project_threads';

    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $query = WebProjectThread::query()->with('project:id,name')->withAdminUnreadCount();

        if ($request->filled('project_id')) $query->where('project_id', $request->input('project_id'));
        if ($request->filled('priority')) $query->where('priority', $request->input('priority'));
        if ($request->filled('status')) $query->where('status', $request->input('status'));

        $this->applySorting($query, $request, 'last_message_at', 'desc');

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        if ($noPagination) {
            return $this->respond(WebProjectThreadResource::collection($query->get()));
        }

        $data = $query->paginate($perPage);

        return $this->respondPaginated($data, WebProjectThreadResource::class);
    }

    public function show($id): JsonResponse
    {
        $thread = WebProjectThread::with('project:id,name')->findOrFail($id);
        // An admin opened it: the client's messages are no longer new for the administration.
        $thread->markReadByAdmin();

        [$messages, $hasMore] = $thread->pagedMessages(null);
        $thread->setRelation('messages', $messages);

        return $this->respond(new WebProjectThreadResource($thread), 200, ['has_more_older_messages' => $hasMore]);
    }

    /**
     * @description Returns `$limit` messages OLDER than `before_message_id` ("Load older
     * messages"). A FLAT list of messages (not the whole thread) - the frontend prepends it.
     */
    public function olderMessages(Request $request, $threadId): JsonResponse
    {
        $thread = WebProjectThread::findOrFail($threadId);
        $beforeId = $request->input('before_message_id');
        $limit = min((int) $request->input('limit', WebProjectThread::DEFAULT_MESSAGE_PAGE_SIZE), 100);

        [$messages, $hasMore] = $thread->pagedMessages($beforeId ? (int) $beforeId : null, $limit);

        return $this->respond(WebProjectThreadMessageResource::collection($messages), 200, ['has_more_older_messages' => $hasMore]);
    }

    /**
     * @note `author_label` fallback here ("Administrator") is intentionally
     * hardcoded and NOT translated dynamically like the customer-side label - it's
     * only ever used when `$request->user()->user_email` is somehow unavailable
     * (should not normally happen for an authenticated admin action), a genuine
     * edge case rather than the everyday display path. The normal path stores the
     * admin's real e-mail, which is data, not a generic label, and is never
     * translated regardless of admin UI language - see
     * `WebProjectPublicController` header for the customer-side contrast.
     */
    public function reply(StoreProjectThreadMessageRequest $request, $threadId): JsonResponse
    {
        $thread = WebProjectThread::findOrFail($threadId);

        $message = $thread->messages()->create([
            'author_type'  => 'admin',
            'author_label' => $request->user()->user_email ?? 'Administrator',
            'body'         => $request->validated()['body'],
        ]);

        $this->storeAttachments($request, $message, self::ATTACHMENT_FOLDER);

        $thread->update(['last_message_at' => now(), 'admin_last_read_at' => now()]);
        // Not logged: who wrote which message is the conversation itself (kept in the thread),
        // the audit log keeps the decisions - thread closed / reopened, project changes.

        return $this->respond(new WebProjectThreadMessageResource($message->load('attachments')), 201);
    }

    /**
     * @description Quick thread status change (active/closed) - independent of
     * reply(), so an admin can close a thread without writing a reply.
     */
    public function updateStatus(Request $request, $threadId): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:' . implode(',', WebProjectThread::STATUSES)],
        ]);

        $thread = WebProjectThread::findOrFail($threadId);
        $oldStatus = $thread->status;
        $thread->update(['status' => $validated['status']]);

        if ($oldStatus !== $thread->status) {
            $closed = $thread->status === 'closed';
            $this->logAction($request, WebLog::class, $closed ? 'thread_close' : 'thread_reopen', 'WebProjectThread',
                ($closed ? 'Closed' : 'Reopened') . " thread #{$thread->id} of project #{$thread->project_id}", $thread->project_id, 'WebProject');
        }

        return $this->respond((new WebProjectThreadResource($thread->fresh()))->resolve());
    }
}