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
 * @refactor-note (2026-08) Odkazy jsou nyní PLNĚ SOUKROMÉ per-uživatel:
 * - KAŽDÝ dotaz (index/show/update/destroy/restore/forceDeleteAllTrashed) je scoped na
 *   `where('user_id', $request->user()->id)` - dřív `show()`/`update()`/`destroy()` braly
 *   záznam jen podle `$id` bez ověření vlastnictví, což byl IDOR (Insecure Direct Object
 *   Reference): kterýkoliv přihlášený admin mohl uhodnutím/inkrementací ID číst, editovat
 *   i mazat odkazy jiných uživatelů. Teď `findOrFail()` na cizí ID vrátí 404 (ne 403 -
 *   záměrně, aby útočník nemohl z rozdílu 403 vs. 404 zjistit, že záznam s daným ID vůbec
 *   existuje, jen patří někomu jinému).
 * - `store()` ignoruje jakýkoliv `user_id` poslaný klientem a vždy dosadí
 *   `$request->user()->id` - nikdy nedůvěřovat vlastnictví z requestu.
 * - Logování přepsáno z lokální `logAction()` (chybně mířila do `shop_logs`) na sdílený
 *   `LogsActivity` trait, zapisující do `WebLog::class` (externí odkazy patří dle
 *   Core/Web/Shop rozdělení do Web domény - viz `web_external_links` tabulka).
 *
 * @note Struktura kontroleru (index/store/show/update/destroy/restore/forceDeleteAllTrashed)
 * zrcadlí ostatní resource controllery v aplikaci pro konzistenci.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreExternalLink;
use App\Models\Web\WebLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

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

        $this->logAction($request, WebLog::class, 'delete', 'Web', "Smazán externí odkaz: {$name}", (int) $id, 'CoreExternalLink');
        return response()->json(null, 204);
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

        $this->logAction($request, WebLog::class, 'delete', 'Web', "Trvale smazáno {$count} externích odkazů z koše");
        return response()->json(null, 204);
    }
}