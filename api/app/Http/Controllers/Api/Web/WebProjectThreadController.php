<?php
/**
 * @file WebProjectThreadController.php
 * @path app/Http/Controllers/Api/Web/WebProjectThreadController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Admin view of customer conversation threads.
 * @bugfix-note (2026-08-29e) `updateStatus()` teď vrací `['data' => ...]` obálku -
 * volá se přes `dataHandler.put<T>()` na frontendu, který `.data` VŽDY rozbaluje
 * (`ProjectsComponent.changeThreadStatus()`) - bez obálky dostal `undefined` a
 * `updated.status` spadlo na "Cannot read properties of undefined". Stejná rodina
 * bugu jako WebProjectController - `show()`/`index()` zůstávají NEOBALENÉ (volají se
 * přes `dataHandler.get<T>()`, který nic nerozbaluje), jen mutační `updateStatus()`/
 * `reply()` se obalují.
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

    public function reply(StoreProjectThreadMessageRequest $request, $threadId): JsonResponse
    {
        $thread = WebProjectThread::findOrFail($threadId);

        $message = $thread->messages()->create([
            'author_type'  => 'admin',
            'author_label' => $request->user()->user_email ?? 'Administrátor',
            'body'         => $request->validated()['body'],
        ]);

        $thread->update(['last_message_at' => now()]);

        $this->logAction($request, WebLog::class, 'create', 'WebProjectThreadMessage', "Odpověď admina ve vlákně ID: {$thread->id} (projekt ID: {$thread->project_id})", $thread->project_id, 'WebProject');

        return response()->json(['data' => $message], 201);
    }

    /**
     * @description Rychlá změna stavu vlákna (active/closed) - nezávislá na reply(),
     * ať admin může zavřít vlákno i bez psaní odpovědi.
     */
    public function updateStatus(Request $request, $threadId): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:' . implode(',', WebProjectThread::STATUSES)],
        ]);

        $thread = WebProjectThread::findOrFail($threadId);
        $thread->update(['status' => $validated['status']]);

        $this->logAction($request, WebLog::class, 'update', 'WebProjectThreadMessage', "Změna stavu vlákna ID: {$thread->id} na '{$validated['status']}' (projekt ID: {$thread->project_id})", $thread->project_id, 'WebProject');

        return response()->json(['data' => (new WebProjectThreadResource($thread->fresh()))->resolve()]);
    }
}