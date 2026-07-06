<?php
/**
 * @file WebNewsController.php
 * @path app/Http/Controllers/Api/Web/WebNewsController.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Manages news article lifecycle, including categorization, content management, and soft-delete administrative workflows.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebNews;
use App\Models\Web\WebLog;
use App\Http\Resources\Web\WebNewsResource;
use App\Http\Requests\Web\WebNews\StoreWebNewsRequest;
use App\Http\Requests\Web\WebNews\UpdateWebNewsRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller responsible for processing and managing news content on the website.
 * @note Integrates with the logging system to maintain an audit trail for all content modifications.
 */
class WebNewsController extends Controller
{
    /**
     * Retrieves a paginated list of news articles with support for search and filtering.
     *
     * @param Request $request Incoming request containing filters (thema, author) and pagination.
     * @return JsonResponse|mixed Returns paginated data or a raw collection.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebNews::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        // Search functionality
        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('title', 'like', "%$s%")
                ->orWhere('author', 'like', "%$s%")
                ->orWhere('message', 'like', "%$s%"));
        }

        // Exact match and partial filters
        if ($request->filled('thema')) {
            $query->where('thema', $request->thema);
        }

        if ($request->filled('author')) {
            $query->where('author', 'like', '%' . $request->author . '%');
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        $data = $noPagination ? $query->get() : $query->paginate($perPage);

        if ($noPagination) {
            return WebNewsResource::collection($data);
        }

        return response()->json([
            'data'         => WebNewsResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Persists a new news article.
     *
     * @param StoreWebNewsRequest $request Validated input data.
     * @return JsonResponse Returns the created resource.
     * @throws \Exception On failure.
     */
    public function store(StoreWebNewsRequest $request): JsonResponse
    {
        try {
            $news = WebNews::create($request->validated());
            
            $this->logAction($request, 'create', 'WebNews', "Vytvořena novinka: {$news->title}", $news->id);
            
            return response()->json(new WebNewsResource($news), 201);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebNews', "Chyba při vytváření novinky: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření novinky selhalo.'], 500);
        }
    }

    /**
     * Retrieves the details of a single news article by ID, including soft-deleted ones.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $news = WebNews::withTrashed()->findOrFail($id);
        
        return response()->json(new WebNewsResource($news));
    }

    /**
     * Updates an existing news article.
     *
     * @param UpdateWebNewsRequest $request Validated input data.
     * @param int $id Article identifier.
     * @return JsonResponse Returns the updated resource.
     * @throws \Exception On failure.
     */
    public function update(UpdateWebNewsRequest $request, $id): JsonResponse
    {
        try {
            $news = \App\Models\Web\WebNews::findOrFail($id);

            $news->update($request->validated());
            
            $this->logAction($request, 'update', 'WebNews', "Aktualizace novinky: {$news->title}", $news->id);
            
            return response()->json(new \App\Http\Resources\Web\WebNewsResource($news));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebNews', "Chyba při aktualizaci novinky ID {$id}: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Aktualizace novinky selhala.'], 500);
        }
    }

    /**
     * Deletes a news article (Soft or Hard).
     *
     * @param Request $request Flags for force deletion.
     * @param int $id Article identifier.
     * @return JsonResponse
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $news = WebNews::withTrashed()->findOrFail($id);
            $title = $news->title;

            $forceDelete ? $news->forceDelete() : $news->delete();
            
            $this->logAction($request, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebNews', "Smazání novinky: $title", $id);

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebNews', "Chyba při mazání novinky ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Smazání novinky selhalo.'], 500);
        }
    }

    /**
     * Restores a soft-deleted news article.
     *
     * @param Request $request
     * @param int $id Article identifier.
     * @return JsonResponse
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $news = WebNews::withTrashed()->findOrFail($id);
            $news->restore();
            
            $this->logAction($request, 'restore', 'WebNews', "Obnovení novinky: {$news->title}", $news->id);
            
            return response()->json(new WebNewsResource($news));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebNews', "Chyba při obnově novinky ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Obnova novinky selhala.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted news articles.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $count = WebNews::onlyTrashed()->count();
            WebNews::onlyTrashed()->forceDelete();
            
            $this->logAction($request, 'force_delete_all', 'WebNews', "Hromadné smazání koše novinek. Počet: $count");
            
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebNews', "Chyba při vyprazdňování koše novinek: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }

    /**
     * Logs administrative actions to the audit log table.
     *
     * @param Request $request Current request instance.
     * @param string $eventType Action type (create, update, delete, etc.).
     * @param string $module Module context.
     * @param string $description Detailed audit message.
     * @param int|null $affectedId Entity identifier.
     * @return void
     */
    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null)
    {
        try {
            $user = $request->user();
            WebLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => $description,
                'affected_entity_type' => 'WebNews',
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'system'
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (WebNews): " . $e->getMessage());
        }
    }
}