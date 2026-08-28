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
 * @bugfix-note (2026-08-29b) KRITICKÝ BUG - "Cannot read properties of undefined
 * (reading 'id')" v @for smyčce checkpointů. `show()`/`update()`/`restore()`/
 * `storeCheckpoint()`/`updateCheckpoint()` vracely `response()->json(new XResource(...))`
 * BEZ ručního obalení do `['data' => ...]`. Laravel takhle poslaný JsonResource
 * NEOBALÍ automaticky (ten mechanismus - `ResourceResponse::wrap()` - se spouští jen
 * když se Resource vrátí z routy PŘÍMO, ne když se předá jako argument do
 * `response()->json()`, které místo toho volá `jsonSerialize()`, jenž žádné obalení
 * nedělá). Frontend `DataHandler.post()/put()/getOne()` (data-handler.service.ts)
 * ale VŽDY dělá `map(response => response.data)` - bez obálky dostane `undefined`.
 * `store()`/`regeneratePassword()` tenhle bug NEMĚLY, protože už explicitně vrací
 * `['data' => ...]` - teď to mají VŠECHNY metody vracející jeden záznam, jednotně.
 * `index()` (kolekce) a `bulkDestroy()`/`forceDeleteAllTrashed()` beze změny -
 * `index()` má vlastní stránkovací tvar, `WebProjectResource::collection()` uvnitř
 * `WebProjectResource::collection($data->items())` se řeší jinak (frontend čte celý
 * response objekt, ne `.data` jedné položky).
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
use App\Models\Web\{WebProject, WebProjectCheckpoint, WebProjectSession};
use App\Models\Web\WebLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class WebProjectController extends Controller
{
    use LogsActivity;

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
            $validated['access_password_hash'] = 'pending'; // přepsáno hned níže regeneratePassword()

            $project = new WebProject($validated);
            $project->status = $validated['status'] ?? 'new';
            $project->access_token = $validated['access_token'];
            $project->access_password_hash = $validated['access_password_hash'];
            $project->save();

            $plaintextPassword = $project->regeneratePassword();

            $this->logAction($request, WebLog::class, 'create', 'WebProject', "Vytvořen projekt: {$project->name}", $project->id, 'WebProject');

            $response = (new WebProjectResource($project))->resolve();
            $response['generated_password'] = $plaintextPassword;

            return response()->json(['data' => $response], 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebProject', "Chyba při vytváření projektu: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření projektu selhalo.'], 500);
        }
    }

    public function show($id): JsonResponse
    {
        $project = WebProject::withTrashed()->with(['lead', 'order', 'checkpoints'])->findOrFail($id);
        return response()->json(new WebProjectResource($project));
    }

    public function update(UpdateWebProjectRequest $request, $id): JsonResponse
    {
        try {
            $project = WebProject::findOrFail($id);
            $project->update($request->validated());

            $this->logAction($request, WebLog::class, 'update', 'WebProject', "Aktualizace projektu ID: {$project->id}", $project->id, 'WebProject');

            $fresh = $project->fresh()->load(['lead', 'order', 'checkpoints']);
            return response()->json(['data' => (new WebProjectResource($fresh))->resolve()]);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebProject', "Chyba při aktualizaci projektu ID {$id}: " . $e->getMessage(), (int) $id, 'WebProject');
            return response()->json(['message' => 'Aktualizace projektu selhala.'], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebProject::withTrashed()->findOrFail($id);

            $forceDelete ? $item->forceDelete() : $item->delete();

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebProject', "Smazání projektu ID: $id", (int) $id, 'WebProject');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebProject', "Chyba při mazání projektu ID $id: " . $e->getMessage(), (int) $id, 'WebProject');
            return response()->json(['message' => 'Smazání projektu selhalo.'], 500);
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
                $forceDelete ? $item->forceDelete() : $item->delete();
                $deletedCount++;
            }
        });

        $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk', 'WebProject', "Hromadné smazání {$deletedCount} projektů.");

        return response()->json(['data' => ['deleted_count' => $deletedCount, 'requested' => count($ids)]]);
    }

    public function restore(Request $request, $id): JsonResponse
    {
        $item = WebProject::withTrashed()->findOrFail($id);
        $item->restore();
        $this->logAction($request, WebLog::class, 'restore', 'WebProject', "Obnova projektu ID: $id", (int) $id, 'WebProject');
        return response()->json(['data' => (new WebProjectResource($item))->resolve()]);
    }

    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        $count = WebProject::onlyTrashed()->count();
        WebProject::onlyTrashed()->forceDelete();
        $this->logAction($request, WebLog::class, 'force_delete_all', 'WebProject', "Hromadné smazání koše projektů. Počet: $count");
        return response()->json(null, 204);
    }

    /**
     * @description Vygeneruje NOVÉ heslo (přepíše staré, staré přestává platit
     * okamžitě) a zneplatní VŠECHNY aktivní session daného projektu. Vrací plaintext
     * heslo přesně jednou.
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
            "Vygenerováno nové heslo pro projekt ID: {$project->id} (zneplatněno {$invalidatedSessions} aktivních relací).",
            $project->id,
            'WebProject'
        );

        return response()->json(['data' => ['generated_password' => $plaintext]]);
    }

    // ── Checkpointy (nested pod project) ─────────────────────────────────────

    public function storeCheckpoint(StoreProjectCheckpointRequest $request, $projectId): JsonResponse
    {
        $project = WebProject::findOrFail($projectId);
        $validated = $request->validated();
        $validated['sort_order'] = $validated['sort_order'] ?? (($project->checkpoints()->max('sort_order') ?? -1) + 1);
        $validated['status'] = $validated['status'] ?? 'new';

        $checkpoint = $project->checkpoints()->create($validated);

        $this->logAction($request, WebLog::class, 'create', 'WebProjectCheckpoint', "Přidán checkpoint '{$checkpoint->label}' k projektu ID: {$project->id}", $project->id, 'WebProject');

        return response()->json(['data' => (new WebProjectCheckpointResource($checkpoint))->resolve()], 201);
    }

    public function updateCheckpoint(UpdateProjectCheckpointRequest $request, $projectId, $checkpointId): JsonResponse
    {
        $checkpoint = WebProjectCheckpoint::findOrFail($checkpointId);

        // IDOR guard - checkpoint MUSÍ patřit k projektu z URL, ne k libovolnému jinému.
        if ((int) $checkpoint->project_id !== (int) $projectId) {
            return response()->json(['message' => 'Checkpoint nepatří k tomuto projektu.'], 404);
        }

        $validated = $request->validated();
        if (isset($validated['status']) && $validated['status'] !== $checkpoint->status) {
            $checkpoint->setStatus($validated['status']);
            unset($validated['status']);
        }
        if (!empty($validated)) {
            $checkpoint->update($validated);
        }

        $this->logAction($request, WebLog::class, 'update', 'WebProjectCheckpoint', "Aktualizace checkpointu ID: {$checkpoint->id} (projekt ID: {$projectId})", (int) $projectId, 'WebProject');

        return response()->json(['data' => (new WebProjectCheckpointResource($checkpoint->fresh()))->resolve()]);
    }

    public function destroyCheckpoint(Request $request, $projectId, $checkpointId): JsonResponse
    {
        $checkpoint = WebProjectCheckpoint::findOrFail($checkpointId);

        if ((int) $checkpoint->project_id !== (int) $projectId) {
            return response()->json(['message' => 'Checkpoint nepatří k tomuto projektu.'], 404);
        }

        $checkpoint->delete();

        $this->logAction($request, WebLog::class, 'hard_delete', 'WebProjectCheckpoint', "Smazán checkpoint ID: {$checkpointId} (projekt ID: {$projectId})", (int) $projectId, 'WebProject');

        return response()->json(null, 204);
    }
}