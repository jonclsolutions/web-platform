<?php
/**
 * @file WebProjectThreadController.php
 * @path app/Http/Controllers/Api/Web/WebProjectThreadController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Admin view of customer conversation threads.
 * @bugfix-note (2026-08-29e) `updateStatus()` now returns a `['data' => ...]`
 * wrapper - called via `dataHandler.put<T>()` on the frontend, which ALWAYS unwraps
 * `.data` (`ProjectsComponent.changeThreadStatus()`) - without the wrapper it got
 * `undefined` and `updated.status` failed with "Cannot read properties of
 * undefined". Same family of bug as WebProjectController - `show()`/`index()`
 * remain UNWRAPPED (called via `dataHandler.get<T>()`, which doesn't unwrap
 * anything), only mutating `updateStatus()`/`reply()` are wrapped.
 *
 * @refactor-note (2026-09-08) BACKLOG "backend fully in English": all log
 * description strings in this file translated from Czech. `author_label` fallback
 * for admin replies translated to "Administrator" - see note on `reply()` below for
 * why this one CAN stay hardcoded (unlike the customer-side label, see
 * `WebProjectPublicController` header).
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Web\WebProject\StoreProjectThreadMessageRequest;
use App\Http\Resources\Web\WebProjectThreadResource;
use App\Models\Web\{WebProjectThread, WebProjectThreadMessage};
use App\Models\Web\WebLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class WebProjectThreadController extends Controller
{
    use LogsActivity;

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

    public function show($id): JsonResponse
    {
        $thread = WebProjectThread::with(['project:id,name', 'messages'])->findOrFail($id);
        return response()->json(new WebProjectThreadResource($thread));
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

        $thread->update(['last_message_at' => now()]);

        $this->logAction($request, WebLog::class, 'create', 'WebProjectThreadMessage', "Admin reply in thread ID: {$thread->id} (project ID: {$thread->project_id})", $thread->project_id, 'WebProject');

        return response()->json(['data' => $message], 201);
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