<?php
/**
 * @file WebNewsController.php
 * @path app/Http/Controllers/Api/Web/WebNewsController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages news article lifecycle, including categorization, content management, and soft-delete administrative workflows.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction(). Lokální verze si ručně dopisovala vlastní
 * Str::limit(description, 990) a Str::limit(json_encode(context_data), 60000) ochranu -
 * trait dělá totéž centrálně (viz LogsActivity::safeContextData()), takže lokální
 * duplicita mizí beze změny chování. Doménově beze změny (WebLog::class).
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebNews;
use App\Models\Web\WebLog;
use App\Http\Resources\Web\WebNewsResource;
use App\Http\Requests\Web\WebNews\StoreWebNewsRequest;
use App\Http\Requests\Web\WebNews\UpdateWebNewsRequest;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

/**
 * @description Controller responsible for processing and managing news content on the website.
 * @note Integrates with the logging system to maintain an audit trail for all content modifications.
 */
class WebNewsController extends Controller
{
    use LogsActivity;

    /**
     * Retrieves a paginated list of news articles with support for search and filtering.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebNews::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('title', 'like', "%$s%")
                ->orWhere('author', 'like', "%$s%")
                ->orWhere('message', 'like', "%$s%"));
        }

        if ($request->filled('thema')) {
            $query->where('thema', $request->thema);
        }

        if ($request->filled('author')) {
            $query->where('author', 'like', '%' . $request->author . '%');
        }

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
     */
    public function store(StoreWebNewsRequest $request): JsonResponse
    {
        try {
            $news = WebNews::create($request->validated());

            $this->logAction($request, WebLog::class, 'create', 'WebNews', "Vytvořena novinka: {$news->title}", $news->id, 'WebNews');

            return response()->json(new WebNewsResource($news), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při vytváření novinky: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření novinky selhalo.'], 500);
        }
    }

    /**
     * Retrieves the details of a single news article by ID, including soft-deleted ones.
     */
    public function show($id): JsonResponse
    {
        $news = WebNews::withTrashed()->findOrFail($id);
        return response()->json(new WebNewsResource($news));
    }

    /**
     * Updates an existing news article.
     */
    public function update(UpdateWebNewsRequest $request, $id): JsonResponse
    {
        try {
            $news = WebNews::findOrFail($id);

            $news->update($request->validated());

            $this->logAction($request, WebLog::class, 'update', 'WebNews', "Aktualizace novinky: {$news->title}", $news->id, 'WebNews');

            return response()->json(new WebNewsResource($news));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při aktualizaci novinky ID {$id}: " . $e->getMessage(), (int) $id, 'WebNews');
            return response()->json(['message' => 'Aktualizace novinky selhala.'], 500);
        }
    }

    /**
     * Deletes a news article (Soft or Hard).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $news = WebNews::withTrashed()->findOrFail($id);
            $title = $news->title;

            $forceDelete ? $news->forceDelete() : $news->delete();

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebNews', "Smazání novinky: $title", (int) $id, 'WebNews');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při mazání novinky ID $id: " . $e->getMessage(), (int) $id, 'WebNews');
            return response()->json(['message' => 'Smazání novinky selhalo.'], 500);
        }
    }

    /**
     * Restores a soft-deleted news article.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $news = WebNews::withTrashed()->findOrFail($id);
            $news->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebNews', "Obnovení novinky: {$news->title}", $news->id, 'WebNews');

            return response()->json(new WebNewsResource($news));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při obnově novinky ID $id: " . $e->getMessage(), (int) $id, 'WebNews');
            return response()->json(['message' => 'Obnova novinky selhala.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted news articles.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $count = WebNews::onlyTrashed()->count();
            WebNews::onlyTrashed()->forceDelete();

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebNews', "Hromadné smazání koše novinek. Počet: $count");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při vyprazdňování koše novinek: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }
}