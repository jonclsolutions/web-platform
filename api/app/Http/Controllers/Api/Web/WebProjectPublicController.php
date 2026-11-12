<?php
/**
 * @file WebProjectPublicController.php
 * @path app/Http/Controllers/Api/Web/WebProjectPublicController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Client-facing endpoints of the project portal. `login()` is the ONLY
 * unauthenticated action (project link + login name + password of a client account) - everything
 * else sits behind the `project.session` middleware, which resolves the project AND the signed-in
 * account. The client sees only what is meant for them: no internal notes of the team
 * (`is_internal` messages), no internal checkpoint notes.
 * Every change of the client (sign-in / out, new thread, thread status) is written to the web log
 * (module WebProjectPortal; message texts never). Single messages are not logged - they are the
 * conversation itself.
 * @security The portal session travels only in the HttpOnly / Secure / SameSite=Strict cookie of
 * AuthCookies (Path = the routes of this project) - it is never in a body or in JavaScript. A wrong
 * login name and a wrong password answer the same and take the same time (a dummy hash check),
 * so login names cannot be probed.
 * @dependencies CheckProjectSession (current_project / current_project_account), ProjectNotifier,
 *   HandlesAttachments, LogsActivity
 */

namespace App\Http\Controllers\Api\Web;

use App\Models\Core\CoreAttachment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Web\WebProject\{ProjectLoginRequest, StoreProjectThreadRequest, StoreProjectThreadMessageRequest, UpdatePortalAccountRequest};
use App\Http\Resources\Web\{WebProjectFileResource, WebProjectPublicResource, WebProjectThreadResource, WebProjectThreadMessageResource};
use App\Models\Web\{WebLog, WebProject, WebProjectAccount, WebProjectThread, WebProjectThreadMessage};
use App\Services\Web\ProjectNotifier;
use App\Support\Auth\AuthCookies;
use App\Traits\HandlesAttachments;
use App\Http\Controllers\Api\Web\Concerns\StartsPortalSession;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class WebProjectPublicController extends Controller
{
    use HandlesAttachments;
    use LogsActivity;
    use StartsPortalSession;

    /** Module of the web log rows of the client portal. */
    private const LOG_MODULE = 'WebProjectPortal';

    /**
     * @description Bcrypt hash (cost 12, as BCRYPT_ROUNDS) of a random value nobody knows - checked
     *   instead of a real one when the login name does not exist, so both answers take the same time.
     */
    private const DUMMY_PASSWORD_HASH = '$2y$12$KzEnK4vVbE4Y2wYvpqXmOeFDfBL77F1ifnwqHCfOQAIdxdIlTU8zW';

    /** Request keys never written to the log (the client's message texts, the password). */
    private const PRIVATE_KEYS = ['body', 'attachments'];

    /** Storage folder for thread message attachments within the private disk - shared with WebProjectThreadController. */
    private const ATTACHMENT_FOLDER = 'web/project_threads';

    public function __construct(private readonly ProjectNotifier $notifier) {}

    /**
     * @description Sign-in of a client account. Unknown project / private project → 404; wrong
     *   login name or password → 401 (one answer for both, a security event either way).
     * @param ProjectLoginRequest $request username + password
     * @param string $token Permanent access token of the project (the link).
     * @return JsonResponse {expires_in, project (with the signed-in account)} + the session cookie
     */
    public function login(ProjectLoginRequest $request, string $token): JsonResponse
    {
        $project = $this->portalProject($request, $token);
        if (!$project) {
            return $this->projectUnavailable();
        }

        $validated = $request->validated();
        $account = $project->accounts()->where('username', mb_strtolower(trim($validated['username'])))->first();
        // Without an account the password is checked against a dummy hash of the same cost, so the
        // answer takes the same time (login names cannot be probed by timing).
        if ($account === null) {
            Hash::check($validated['password'], self::DUMMY_PASSWORD_HASH);
        }
        $valid = $account !== null && $account->verifyPassword($validated['password']);

        if (!$valid) {
            $this->recordFailedSignIn($request, $project, 'password');
            return response()->json(['message' => 'Invalid login name or password.'], 401);
        }

        return $this->startPortalSession($request, $project, $account, $token, 'password');
    }

    /**
     * @description The project of the signed-in account (with its checkpoints and the account).
     * @param Request $request
     * @return JsonResponse
     */
    public function me(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        return $this->respond(new WebProjectPublicResource($project->load('checkpoints')));
    }

    /**
     * @description The client changes the settings of its own account ("My account"): e-mail,
     *   e-mail language and the notifications it wants. A notification turned on needs an e-mail
     *   (422 otherwise); removing the e-mail turns all of them off. The log names only the changed
     *   fields, never the e-mail.
     * @param UpdatePortalAccountRequest $request
     * @return JsonResponse The project with the updated account.
     */
    public function updateAccount(UpdatePortalAccountRequest $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        /** @var WebProjectAccount $account */
        $account = $request->attributes->get('current_project_account');
        $account->fill($request->validated());

        if (empty($account->email)) {
            $turnedOn = collect(WebProjectAccount::NOTIFICATIONS)->contains(fn (string $column) => $request->boolean($column));
            if ($turnedOn) {
                return response()->json([
                    'message' => 'An e-mail is needed for notifications.',
                    'errors'  => ['email' => ['An e-mail is needed for notifications.']],
                ], 422);
            }
            $account->disableNotifications();
        }

        $changed = array_keys(array_diff_key($account->getDirty(), array_flip(['updated_at'])));
        $account->save();

        if ($changed !== []) {
            $this->logAction($request, WebLog::class, 'portal_account_settings', self::LOG_MODULE,
                "Client account #{$account->id} of project #{$project->id} changed its settings: " . implode(', ', $changed),
                $project->id, 'WebProject', ['email']);
        }

        return $this->respond(new WebProjectPublicResource($project->load('checkpoints')));
    }

    public function logout(Request $request, string $token): JsonResponse
    {
        $session = $request->attributes->get('current_project_session');
        $session?->delete();
        $project = $request->attributes->get('current_project');
        $account = $request->attributes->get('current_project_account');
        $this->logAction($request, WebLog::class, 'portal_logout', self::LOG_MODULE,
            'Client account #' . ($account?->id ?? '?') . ' signed out of the portal of project #' . ($project?->id ?? '?'), $project?->id, 'WebProject');

        // The middleware re-issues the session cookie on every request - replace it with the
        // expired one so the browser deletes it.
        $request->attributes->set('project_session_cookie', AuthCookies::forgetPortal($request, $token));

        return response()->json(['message' => 'Logout successful.']);
    }

    /**
     * @description Threads of the project with their client-visible messages (no internal notes).
     * @param Request $request
     * @return JsonResponse
     */
    public function threadsIndex(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $threads = $project->threads()->with(['messages' => fn ($q) => $q->visibleToClient(), 'messages.attachments'])->get();

        return $this->respond(WebProjectThreadResource::collection($threads));
    }

    /**
     * @description Every file of the project's conversations the client can see (attachments of
     *   client-visible messages), newest first, with the thread and author - "Files" of the portal.
     * @param Request $request
     * @return JsonResponse
     */
    public function files(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');

        return $this->respond(WebProjectFileResource::collection(app(\App\Services\Web\ProjectFiles::class)->of($project, forClient: true)));
    }

    public function threadShow(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $threadId = $request->route('threadId');

        $thread = $project->threads()->find($threadId);
        if (!$thread) {
            return response()->json(['message' => 'Thread not found.'], 404);
        }

        [$messages, $hasMore] = $thread->pagedMessages(null);
        $thread->setRelation('messages', $messages);

        $thread->update(['customer_last_read_at' => now()]);

        return $this->respond(new WebProjectThreadResource($thread), 200, ['has_more_older_messages' => $hasMore]);
    }

    /**
     * @description Returns `$limit` messages OLDER than `before_message_id` ("Load older
     * messages" in the client portal). Scoped to `$project` (`$project->threads()->find(...)`) -
     * the same IDOR protection as the other methods of this controller. No internal notes.
     */
    public function olderMessages(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $threadId = $request->route('threadId');

        $thread = $project->threads()->find($threadId);
        if (!$thread) {
            return response()->json(['message' => 'Thread not found.'], 404);
        }

        $beforeId = $request->input('before_message_id');
        $limit = min((int) $request->input('limit', WebProjectThread::DEFAULT_MESSAGE_PAGE_SIZE), 100);

        [$messages, $hasMore] = $thread->pagedMessages($beforeId ? (int) $beforeId : null, $limit);

        return $this->respond(WebProjectThreadMessageResource::collection($messages), 200, ['has_more_older_messages' => $hasMore]);
    }

    /**
     * @description Polled every 15s by the customer portal while a thread is open -
     * returns only messages newer than `after_id` (the currently last-known message id
     * on the frontend), so the customer sees new admin replies without a manual
     * refresh. Updates `customer_last_read_at` when new messages are found (the
     * customer is actively viewing the thread at poll time). The meta carries the status and
     * whose turn it is.
     */
    public function newMessages(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $threadId = $request->route('threadId');

        $thread = $project->threads()->find($threadId);
        if (!$thread) {
            return response()->json(['message' => 'Thread not found.'], 404);
        }

        $afterId = (int) $request->input('after_id', 0);
        $messages = $thread->newerMessages($afterId);

        if ($messages->isNotEmpty()) {
            $thread->update(['customer_last_read_at' => now()]);
        }

        return $this->respond(WebProjectThreadMessageResource::collection($messages), 200,
            ['status' => $thread->status, 'waiting_on' => $thread->waitingOn()]);
    }

    public function threadStore(StoreProjectThreadRequest $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $account = $request->attributes->get('current_project_account');
        $validated = $request->validated();

        $thread = $project->threads()->create([
            'subject'               => $validated['subject'],
            'priority'              => $validated['priority'],
            'status'                => 'active',
            'opened_by'             => 'customer',
            'last_public_author'    => 'customer',
            'last_message_at'       => now(),
            'customer_last_read_at' => now(),
        ]);

        $message = $thread->messages()->create($this->clientMessage($account, $validated['body']));

        $this->storeAttachments($request, $message, self::ATTACHMENT_FOLDER);
        $this->logAction($request, WebLog::class, 'portal_thread_create', self::LOG_MODULE,
            "Client account #{$account->id} opened thread #{$thread->id} in project #{$project->id} (" . count($message->attachments()->get()) . ' attachments)', $thread->id, 'WebProjectThread', self::PRIVATE_KEYS);

        $this->notifier->notifyTeam($project, $thread, isNewThread: true);

        return $this->respond(new WebProjectThreadResource($thread->load('messages.attachments')), 201);
    }

    public function messageStore(StoreProjectThreadMessageRequest $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $account = $request->attributes->get('current_project_account');
        $threadId = $request->route('threadId');

        $thread = $project->threads()->find($threadId);
        if (!$thread) {
            return response()->json(['message' => 'Thread not found.'], 404);
        }

        $message = $thread->messages()->create($this->clientMessage($account, $request->validated()['body']));

        $this->storeAttachments($request, $message, self::ATTACHMENT_FOLDER);

        $thread->update(['last_message_at' => now(), 'customer_last_read_at' => now(), 'last_public_author' => 'customer']);
        // Not logged: single messages are the conversation itself; the log keeps the client's
        // sign-ins, new requests (threads) and closing / reopening them.

        $this->notifier->notifyTeam($project, $thread, isNewThread: false);

        return $this->respond(new WebProjectThreadMessageResource($message->load('attachments')), 201);
    }

    /**
     * @description Customer-driven thread status change - BIDIRECTIONAL (active <-> closed): a
     * customer can accidentally close a thread and needs a way back without waiting on an admin.
     * Scoped on `$project` (`$project->threads()->find(...)`) - same IDOR guard as the rest of this
     * controller.
     */
    public function updateStatus(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $account = $request->attributes->get('current_project_account');
        $threadId = $request->route('threadId');

        $thread = $project->threads()->find($threadId);
        if (!$thread) {
            return response()->json(['message' => 'Thread not found.'], 404);
        }

        $validated = $request->validate([
            'status' => ['required', 'in:' . implode(',', WebProjectThread::STATUSES)],
        ]);

        $oldStatus = $thread->status;
        $thread->update(['status' => $validated['status']]);
        if ($oldStatus !== $thread->status) {
            $this->logAction($request, WebLog::class, 'portal_thread_status', self::LOG_MODULE,
                "Client account #{$account->id} " . ($thread->status === 'closed' ? 'closed' : 'reopened') . " thread #{$thread->id} of project #{$project->id}", $thread->id, 'WebProjectThread');
        }

        return $this->respond(new WebProjectThreadResource($thread->fresh()));
    }

    /**
     * @description Attributes of a client message: the author account and a snapshot of its name
     *   (kept in the history when the account is removed later).
     * @param WebProjectAccount $account Signed-in account.
     * @param string $body Message text.
     * @return array<string, mixed>
     */
    private function clientMessage(WebProjectAccount $account, string $body): array
    {
        return [
            'author_type'  => 'customer',
            'author_label' => $account->display_name,
            'account_id'   => $account->id,
            'is_internal'  => false,
            'body'         => $body,
        ];
    }
}
