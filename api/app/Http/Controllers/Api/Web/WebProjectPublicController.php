<?php
/**
 * @file WebProjectPublicController.php
 * @path app/Http/Controllers/Api/Web/WebProjectPublicController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Customer-facing endpoints. `login()` is the ONLY unauthenticated
 * action - everything else sits behind `project.session` middleware.
 *
 * (Earlier refactor-notes for notifyProjectContact() e-mail, backend-fully-in-English
 * translation, the customer-side null author_label, customer_last_read_at unread
 * tracking, and HandlesAttachments/messageStore()/threadStore() attachments are
 * unchanged - see version history.)
 *
 * @refactor-note (2026-09-11v4) BACKLOG "otevření vlákna ukazuje nejstarší zprávu
 * / vlákno s 1000 zprávami nemá načítat všechny najednou": `threadShow()` teď
 * natahuje jen posledních `WebProjectThread::DEFAULT_MESSAGE_PAGE_SIZE` zpráv přes
 * `pagedMessages()`, přidává `has_more_older_messages` do odpovědi. Nová
 * `olderMessages()` metoda obsluhuje "Načíst starší zprávy" na zákaznickém portálu.
 * `threadsIndex()` ZÁMĚRNĚ BEZE ZMĚNY - pořád eager-loaduje `messages.attachments`
 * v plné šíři, protože zákaznické fulltextové vyhledávání ve vláknech prohledává
 * text VŠECH zpráv na frontendu (viz `ProjectPortalComponent.filteredThreads`) -
 * omezení na posledních N zpráv by hledání ve starších zprávách tiše rozbilo.
 * Pokud se v budoucnu ukáže výkonnostní problém i tady, hledání bude muset přejít
 * na server-side endpoint místo klient-side filtru nad plně načtenými daty.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Web\WebProject\{ProjectLoginRequest, StoreProjectThreadRequest, StoreProjectThreadMessageRequest};
use App\Http\Resources\Web\{WebProjectPublicResource, WebProjectThreadResource, WebProjectThreadMessageResource};
use App\Mail\Web\ProjectThreadActivityMail;
use App\Models\Core\CoreSecurityEvent;
use App\Models\Web\{WebProject, WebProjectSession, WebProjectThread};
use App\Traits\HandlesAttachments;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class WebProjectPublicController extends Controller
{
    use HandlesAttachments;

    /** Storage folder for thread message attachments within the private disk - shared with WebProjectThreadController. */
    private const ATTACHMENT_FOLDER = 'web/project_threads';

    public function login(ProjectLoginRequest $request, string $token): JsonResponse
    {
        $project = WebProject::where('access_token', $token)->first();

        if (!$project || $project->visibility !== 'public') {
            CoreSecurityEvent::record(
                'project_login_invalid_token',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['reason' => 'project_unavailable'])
            );
            return response()->json(['message' => 'Project not found or unavailable.'], 404);
        }

        if (!$project->verifyPassword($request->validated()['password'])) {
            CoreSecurityEvent::record(
                'project_login_failed',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['project_id' => $project->id])
            );
            return response()->json(['message' => 'Invalid password.'], 401);
        }

        $sessionToken = WebProjectSession::issueFor($project, $request->ip(), $request->userAgent());

        return response()->json([
            'session_token' => $sessionToken,
            'expires_in'    => WebProjectSession::LIFETIME_MINUTES * 60,
            'project'       => new WebProjectPublicResource($project->load('checkpoints')),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        return response()->json(new WebProjectPublicResource($project->load('checkpoints')));
    }

    public function logout(Request $request): JsonResponse
    {
        $session = $request->attributes->get('current_project_session');
        $session?->delete();

        return response()->json(['message' => 'Logout successful.']);
    }

    public function threadsIndex(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $threads = $project->threads()->with('messages.attachments')->get();

        return response()->json(WebProjectThreadResource::collection($threads));
    }

    /**
     * @refactor-note (2026-09-11v4) Natahuje jen posledních `DEFAULT_MESSAGE_PAGE_SIZE`
     * zpráv přes `pagedMessages()` - viz hlavička souboru. `customer_last_read_at`
     * zápis ZŮSTÁVÁ beze změny.
     */
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

        $response = (new WebProjectThreadResource($thread))->resolve();
        $response['has_more_older_messages'] = $hasMore;

        return response()->json($response);
    }

    /**
     * @description Vrátí `$limit` zpráv STARŠÍCH než `before_message_id` - obsluha
     * tlačítka "Načíst starší zprávy" na zákaznickém portálu. Scoped na `$project`
     * (`$project->threads()->find(...)`) - stejná IDOR ochrana jako ostatní metody
     * v tomhle controlleru.
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

    return response()->json([
        'data'                    => WebProjectThreadMessageResource::collection($messages),
        'has_more_older_messages' => $hasMore,
    ]);
}
/**
 * @description Polled every 15s by the customer portal while a thread is open -
 * returns only messages newer than `after_id` (the currently last-known message id
 * on the frontend), so the customer sees new admin replies without a manual
 * refresh. Updates `customer_last_read_at` when new messages are found (the
 * customer is actively viewing the thread at poll time).
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

    return response()->json([
        'data'   => WebProjectThreadMessageResource::collection($messages),
        'status' => $thread->status,
    ]);
}
    /**
     * @bugfix-note (2026-09-08) `author_label` for the customer's first message is
     * now `null` - see file header. Frontend resolves the generic label itself.
     */
    public function threadStore(StoreProjectThreadRequest $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $validated = $request->validated();

        $thread = $project->threads()->create([
            'subject'               => $validated['subject'],
            'priority'              => $validated['priority'],
            'status'                => 'active',
            'opened_by'             => 'customer',
            'last_message_at'       => now(),
            'customer_last_read_at' => now(),
        ]);

        $message = $thread->messages()->create([
            'author_type'  => 'customer',
            'author_label' => null,
            'body'         => $validated['body'],
        ]);

        $this->storeAttachments($request, $message, self::ATTACHMENT_FOLDER);

        $this->notifyProjectContact($project, $thread, isNewThread: true);

        return response()->json(new WebProjectThreadResource($thread->load('messages.attachments')), 201);
    }

    /**
     * @bugfix-note (2026-09-08) `author_label` for customer messages is now `null` -
     * see file header.
     */
    public function messageStore(StoreProjectThreadMessageRequest $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $threadId = $request->route('threadId');

        $thread = $project->threads()->find($threadId);
        if (!$thread) {
            return response()->json(['message' => 'Thread not found.'], 404);
        }

        $message = $thread->messages()->create([
            'author_type'  => 'customer',
            'author_label' => null,
            'body'         => $request->validated()['body'],
        ]);

        $this->storeAttachments($request, $message, self::ATTACHMENT_FOLDER);

        $thread->update(['last_message_at' => now(), 'customer_last_read_at' => now()]);

        $this->notifyProjectContact($project, $thread, isNewThread: false);

        return response()->json(new WebProjectThreadMessageResource($message->load('attachments')), 201);
    }

    /**
 * @description Customer-driven thread status change - NOW BIDIRECTIONAL
 * (active <-> closed), unlike the earlier one-way "mark resolved" design. Rationale:
 * a customer can accidentally close a thread and needs a way back without waiting
 * on an admin. Scoped on `$project` (`$project->threads()->find(...)`) - same IDOR
 * guard as the rest of this controller.
 * @bugfix-note (2026-09-12) Replaces the old `threadClose()`, which had the SAME
 * route-parameter-order bug as `olderMessages()`/`newMessages()` before their fix
 * (`$threadId` declared as the second method parameter got bound to `{token}`
 * instead, since Laravel injects positionally when a parameter isn't type-hinted
 * as a route-model-bound class) - `$request->route('threadId')` is immune to that.
 */
public function updateStatus(Request $request): JsonResponse
{
    $project = $request->attributes->get('current_project');
    $threadId = $request->route('threadId');

    $thread = $project->threads()->find($threadId);
    if (!$thread) {
        return response()->json(['message' => 'Thread not found.'], 404);
    }

    $validated = $request->validate([
        'status' => ['required', 'in:' . implode(',', WebProjectThread::STATUSES)],
    ]);

    $thread->update(['status' => $validated['status']]);

    return response()->json(new WebProjectThreadResource($thread->fresh()));
}

    /**
     * @description Sends a notification to `$project->contact_email` if it's filled
     * in - otherwise nothing happens silently (no error, no log). A failure to send
     * (SMTP outage etc.) is swallowed and logged, and must never break the response
     * to a customer who just successfully sent a message/opened a thread.
     */
    private function notifyProjectContact(WebProject $project, WebProjectThread $thread, bool $isNewThread): void
    {
        if (empty($project->contact_email)) {
            return;
        }

        try {
            Mail::to($project->contact_email)->queue(
                new ProjectThreadActivityMail($project, $thread, $isNewThread)
            );
        } catch (\Throwable $e) {
            Log::error('Sending project thread activity notification failed: ' . $e->getMessage(), [
                'project_id' => $project->id,
                'thread_id'  => $thread->id,
            ]);
        }
    }
}