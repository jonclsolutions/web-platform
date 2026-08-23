<?php
/**
 * @file CoreExternalLinkController.php
 * @path app/Http/Controllers/Api/Core/CoreExternalLinkController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Spravuje seznam externích odkazů zobrazovaných v adminu (Google Analytics
 * dashboard, webmail, Search Console apod.) - čisté odkazy ven, žádné živé statistiky.
 *
 * @refactor-note (2026-08) Odkazy jsou nyní PLNĚ SOUKROMÉ per-uživatel - viz IDOR bugfix
 * popsaný níže v historii souboru.
 *
 * @bugfix-note (2026-08-15) `destroy()`/`forceDeleteAllTrashed()` sjednoceny na
 * `soft_delete`/`force_delete_all` event_type.
 *
 * @refactor-note (2026-08-23) HROMADNÉ MAZÁNÍ V JEDNOM REQUESTU: přidána `bulkDestroy()` -
 * viz TableBuilderComponent.onBulkDeleteClick() (volá POST core/external_links/bulk-delete).
 * KRITICKÉ: MUSÍ zůstat scoped na `user_id` přihlášeného uživatele, stejně jako VŠECHNY
 * ostatní metody v tomto kontroleru (`show`/`update`/`destroy`/`restore` výše) - bez
 * tohohle scope by šlo hromadně smazat cizí odkazy jen uhodnutím/inkrementací ID, přesně
 * ten IDOR bug, který byl u jednotlivých akcí už opravený (viz refactor-note 2026-08).
 * ID, která patří jinému uživateli, se v `whereIn()` prostě nenajdou - stejné chování
 * jako 404 u jednotlivých akcí (žádný rozdíl mezi "neexistuje" a "patří někomu jinému"),
 * jen se to promítne do `skipped_count` bez zvláštního rozlišení důvodu.
 *
 * Logování ZŮSTÁVÁ zapnuté i pro tenhle typ dat (osobní odkazy) - i když jde o čistě
 * soukromý obsah, zachování stejné auditní konvence napříč VŠEMI resources má cenu samo
 * o sobě (konzistence, žádná výjimka, na kterou je nutné pamatovat) a cena zápisu jednoho
 * řádku do `web_logs` je zanedbatelná.
 *
 * IMPORT ZÁMĚRNĚ NEIMPLEMENTOVÁN - jde o osobní seznam bookmarků (typicky pár položek na
 * uživatele), hromadný import ze souboru pro tenhle typ dat nemá reálné praktické využití.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreExternalLink;
use App\Models\Web\WebLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CoreExternalLinkController extends Controller
{
    use LogsActivity;

    /**
     * @description Vrátí seznam externích odkazů PATŘÍCÍCH PŘIHLÁŠENÉMU UŽIVATELI
     *              (aktivních, nebo košových podle ?only_trashed=) s podporou filtrování,
     *              řazení a volitelného stránkování.
     */
    public function index(Request $request): JsonResponse
    {
        $query = $request->boolean('only_trashed')
            ? CoreExternalLink::onlyTrashed()
            : CoreExternalLink::query();

        $query->where('user_id', $request->user()->id);

        if ($name = $request->input('name')) {
            $query->where('name', 'like', "%{$name}%");
        }
        if ($url = $request->input('url')) {
            $query->where('url', 'like', "%{$url}%");
        }
        if ($request->has('is_active') && !$request->boolean('only_trashed')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $sortBy  = $request->input('sort_by', 'position');
        $sortDir = $request->input('sort_direction', 'asc');
        $query->orderBy($sortBy, $sortDir);

        if ($request->boolean('no_pagination')) {
            return response()->json($query->get());
        }

        $perPage = (int) $request->input('per_page', 15);
        return response()->json($query->paginate($perPage));
    }

    /**
     * @description Vrátí detail jednoho odkazu - jen pokud patří přihlášenému uživateli
     *              (včetně smazaných, pro zobrazení v koši). Cizí ID -> 404, ne 403.
     */
    public function show(Request $request, $id): JsonResponse
    {
        $link = CoreExternalLink::withTrashed()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        return response()->json($link);
    }

    /**
     * @description Vytvoří nový externí odkaz - vlastníkem je vždy přihlášený uživatel,
     *              bez ohledu na to, co (případně) přijde v requestu.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'      => 'required|string|max:150',
            'url'       => 'required|url|max:500',
            'position'  => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $link = CoreExternalLink::create([
            'user_id'   => $request->user()->id,
            'name'      => $validated['name'],
            'url'       => $validated['url'],
            'position'  => $validated['position'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $this->logAction($request, WebLog::class, 'create', 'Web', "Vytvořen externí odkaz: {$link->name}", $link->id, 'CoreExternalLink');
        return response()->json($link, 201);
    }

    /**
     * @description Aktualizuje existující externí odkaz - jen pokud patří přihlášenému
     *              uživateli.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $link = CoreExternalLink::where('user_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'name'      => 'required|string|max:150',
            'url'       => 'required|url|max:500',
            'position'  => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $link->update($validated);

        $this->logAction($request, WebLog::class, 'update', 'Web', "Upraven externí odkaz: {$link->name}", $link->id, 'CoreExternalLink');
        return response()->json($link);
    }

    /**
     * @description Soft-delete odkazu (přesun do koše) - jen pokud patří přihlášenému
     *              uživateli.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $link = CoreExternalLink::where('user_id', $request->user()->id)->findOrFail($id);
        $name = $link->name;
        $link->delete();

        $this->logAction($request, WebLog::class, 'soft_delete', 'Web', "Smazán externí odkaz: {$name}", (int) $id, 'CoreExternalLink');
        return response()->json(null, 204);
    }

    /**
     * @description Hromadně smaže vybrané externí odkazy JEDNÍM requestem - viz
     * TableBuilderComponent.onBulkDeleteClick() (volá POST core/external_links/bulk-delete).
     * KRITICKY scoped na `user_id` přihlášeného uživatele - viz refactor-note v hlavičce
     * třídy. ID patřící jinému uživateli se prostě nenajdou (whereIn na scoped query),
     * promítnou se do `skipped_count` bez rozlišení důvodu (stejný princip jako 404 vs.
     * "cizí" u jednotlivých akcí výše).
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
        $userId = $request->user()->id;

        try {
            DB::transaction(function () use ($ids, $forceDelete, $userId, &$deletedCount) {
                // KRITICKÉ: where('user_id', $userId) - bez tohohle by šlo hromadně
                // smazat cizí odkazy jen uhodnutím ID. Stejný scope jako destroy() výše.
                $items = CoreExternalLink::withTrashed()
                    ->where('user_id', $userId)
                    ->whereIn('id', $ids)
                    ->get();

                foreach ($items as $item) {
                    $forceDelete ? $item->forceDelete() : $item->delete();
                    $deletedCount++;
                }
            });
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'Web', "Chyba při hromadném mazání externích odkazů: " . $e->getMessage());
            return response()->json(['message' => 'Hromadné mazání selhalo.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            WebLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'Web',
            'Hromadné ' . ($forceDelete ? 'trvalé ' : '') . "smazání {$deletedCount} externích odkazů (požadováno {$requestedCount}, ID: {$idsPreview}).",
            null,
            'CoreExternalLink'
        );

        return response()->json(['data' => [
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]]);
    }

    /**
     * @description Obnoví odkaz z koše zpět mezi aktivní - jen pokud patří přihlášenému
     *              uživateli.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $link = CoreExternalLink::onlyTrashed()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $link->restore();

        $this->logAction($request, WebLog::class, 'restore', 'Web', "Obnoven externí odkaz: {$link->name}", $link->id, 'CoreExternalLink');
        return response()->json($link);
    }

    /**
     * @description Trvale smaže VŠECHNY záznamy V KOŠI PATŘÍCÍ PŘIHLÁŠENÉMU UŽIVATELI
     *              (nevratné) - nikdy ne cizí data.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        $ownTrashed = CoreExternalLink::onlyTrashed()->where('user_id', $request->user()->id);
        $count = $ownTrashed->count();
        $ownTrashed->forceDelete();

        $this->logAction($request, WebLog::class, 'force_delete_all', 'Web', "Trvale smazáno {$count} externích odkazů z koše");
        return response()->json(null, 204);
    }
}