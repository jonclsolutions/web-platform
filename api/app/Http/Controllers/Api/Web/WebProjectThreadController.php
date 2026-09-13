<?php
/**
 * @file WebProjectThreadController.php
 * @path app/Http/Controllers/Api/Web/WebProjectThreadController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Admin view of customer conversation threads.
 *
 * (Earlier bugfix-note 2026-08-29e for the updateStatus() ['data' => ...] wrapper,
 * refactor-note 2026-09-08 for backend-fully-in-English, and refactor-note
 * 2026-09-11 for HandlesAttachments/reply() attachments are unchanged - see version
 * history.)
 *
 * @refactor-note (2026-09-11v4) BACKLOG "otevření vlákna ukazuje nejstarší zprávu
 * / vlákno s 1000 zprávami nemá načítat všechny najednou": `show()` teď natahuje
 * jen POSLEDNÍCH `WebProjectThread::DEFAULT_MESSAGE_PAGE_SIZE` zpráv přes
 * `pagedMessages()` (místo `->with('messages.attachments')`, které tahalo úplně
 * všechny), a do odpovědi přidává `has_more_older_messages` flag. Nová
 * `olderMessages()` metoda + route obsluhuje tlačítko "Načíst starší zprávy" ve
 * frontendu (`before_message_id` = id aktuálně nejstarší načtené zprávy).
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

class WebProjectThreadController extends Controller
{
    use LogsActivity;
    use HandlesAttachments;

    /** Storage folder for thread message attachments within the private disk. */
    private const ATTACHMENT_FOLDER = 'web/project_threads';

    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $query = WebProjectThread::query()->with('project:id,name');

        if ($request->filled('project_id')) $query->where('project_id', $request->input('project_id'));
        if ($request->filled('priority')) $query->where('priority', $request->input('priority'));
        if ($request->filled('status')) $query->where('status', $request->input('status'));

        $sortBy = $request->input('sort_by', 'last_message_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        if ($noPagination) {
            return response()->json(WebProjectThreadResource::collection($query->get()));
        }

        $data = $query->paginate($perPage);

        return response()->json([
            'data'         => WebProjectThreadResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * @refactor-note (2026-09-11v4) Natahuje jen posledních `DEFAULT_MESSAGE_PAGE_SIZE`
     * zpráv přes `pagedMessages()` - viz hlavička souboru.
     */
    public function show($id): JsonResponse
    {
        $thread = WebProjectThread::with('project:id,name')->findOrFail($id);

        [$messages, $hasMore] = $thread->pagedMessages(null);
        $thread->setRelation('messages', $messages);

        $response = (new WebProjectThreadResource($thread))->resolve();
        $response['has_more_older_messages'] = $hasMore;

        return response()->json($response);
    }

    /**
     * @description Vrátí `$limit` zpráv STARŠÍCH než `before_message_id` - obsluha
     * tlačítka "Načíst starší zprávy". Vrací PLOCHÉ pole zpráv (ne celé vlákno),
     * frontend výsledek jen předřadí před stávající lokální seznam.
     */
    public function olderMessages(Request $request, $threadId): JsonResponse
    {
        $thread = WebProjectThread::findOrFail($threadId);
        $beforeId = $request->input('before_message_id');
        $limit = min((int) $request->input('limit', WebProjectThread::DEFAULT_MESSAGE_PAGE_SIZE), 100);

        [$messages, $hasMore] = $thread->pagedMessages($beforeId ? (int) $beforeId : null, $limit);

        return response()->json([
            'data'                     => WebProjectThreadMessageResource::collection($messages),
            'has_more_older_messages'  => $hasMore,
        ]);
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

        $thread->update(['last_message_at' => now()]);

        $this->logAction($request, WebLog::class, 'create', 'WebProjectThreadMessage', "Admin reply in thread ID: {$thread->id} (project ID: {$thread->project_id})", $thread->project_id, 'WebProject');

        return response()->json(['data' => new WebProjectThreadMessageResource($message->load('attachments'))], 201);
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
        $thread->update(['status' => $validated['status']]);

        $this->logAction($request, WebLog::class, 'update', 'WebProjectThreadMessage', "Thread status changed ID: {$thread->id} to '{$validated['status']}' (project ID: {$thread->project_id})", $thread->project_id, 'WebProject');

        return response()->json(['data' => (new WebProjectThreadResource($thread->fresh()))->resolve()]);
    }
}