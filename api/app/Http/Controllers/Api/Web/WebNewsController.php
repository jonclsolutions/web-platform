<?php
/**
 * @file WebNewsController.php
 * @path app/Http/Controllers/Api/Web/WebNewsController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages news article lifecycle, including categorization, content management, and soft-delete administrative workflows.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVANI na sdileny LogsActivity trait misto
 * lokalni duplicitni logAction(). Domenove beze zmeny (WebLog::class).
 *
 * @bugfix-note (2026-08-15) KRITICKA OPRAVA FILTRU: index() vubec nezpracovaval
 * filtry id a title, prestoze NEWS_FILTER_COLUMNS (frontend) je nabizi. Doplneno
 * id (presna shoda) a title (castecna shoda pres LIKE, konzistentne s author).
 *
 * @refactor-note (2026-08-23) HROMADNE MAZANI V JEDNOM REQUESTU: pridana bulkDestroy()
 * - viz TableBuilderComponent.onBulkDeleteClick() na frontendu (vola
 * POST web/news/bulk-delete). Na rozdil od WebJobApplicationController tady destroy()
 * NEMA zadny vedlejsi efekt na soubory/jine tabulky (zadne prilohy) - jediny rozdil
 * oproti generickemu Model::destroy($ids) je nutnost explicitne zavolat forceDelete()
 * pro force_delete=true vetev (Model::destroy() interne vzdy vola delete(), coz by
 * u SoftDeletes modelu znamenalo znovu jen soft-delete, ne trvale smazani).
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
use Illuminate\Support\Facades\DB;

class WebNewsController extends Controller
{
    use LogsActivity;

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

        if ($request->filled('id')) {
            $query->where('id', $request->input('id'));
        }

        if ($request->filled('title')) {
            $query->where('title', 'like', '%' . $request->input('title') . '%');
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

    public function show($id): JsonResponse
    {
        $news = WebNews::withTrashed()->findOrFail($id);
        return response()->json(new WebNewsResource($news));
    }

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
     * @description Hromadně smaže vybrané novinky JEDNÍM requestem - viz
     * TableBuilderComponent.onBulkDeleteClick() na frontendu (volá
     * POST web/news/bulk-delete).
     * @param Request $request Tělo obsahuje { ids: number[], force_delete?: boolean }.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids'          => ['required', 'array', 'min:1', 'max:1000'],
            'ids.*'        => ['integer'],
            'force_delete' => ['sometimes', 'boolean'],
        ]);

        $ids = array_values(array_unique(array_map('intval', $validated['ids'])));
        $forceDelete = filter_var($validated['force_delete'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $requestedCount = count($ids);
        $deletedCount = 0;

        try {
            DB::transaction(function () use ($ids, $forceDelete, &$deletedCount) {
                $items = WebNews::withTrashed()->whereIn('id', $ids)->get();

                foreach ($items as $item) {
                    // Explicitní forceDelete()/delete() - Model::destroy($ids) by interně
                    // vždy volalo jen delete(), což by u SoftDeletes modelu znamenalo
                    // opakovaný soft-delete, ne skutečné trvalé smazání.
                    $forceDelete ? $item->forceDelete() : $item->delete();
                    $deletedCount++;
                }
            });
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebNews', "Chyba při hromadném mazání novinek: " . $e->getMessage());
            return response()->json(['message' => 'Hromadné mazání selhalo.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'WebNews',
            'Hromadné ' . ($forceDelete ? 'trvalé ' : '') . "smazání {$deletedCount} novinek (požadováno {$requestedCount}, ID: {$idsPreview}).",
            null,
            'WebNews'
        );

        return response()->json(['data' => [
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]]);
    }

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