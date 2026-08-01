<?php
/**
 * @file WebExternalLinkController.php
 * @path app/Http/Controllers/Api/Web/WebExternalLinkController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Spravuje seznam externích odkazů zobrazovaných v adminu (Google Analytics
 * dashboard, webmail, Search Console apod.) - čisté odkazy ven, žádné živé statistiky.
 *
 * @note Struktura kontroleru (index/store/show/update/destroy/restore/forceDeleteAllTrashed
 * + logAction) zrcadlí ostatní resource controllery v aplikaci (viz DocumentSectionController,
 * SiteConfigurationController) pro konzistenci.
 *
 * @assumption (2026) Parametr pro filtrování jen smazaných záznamů (koš) je pojmenovaný
 * `trashed` (?trashed=true) a pro nestránkovaný výpis `no_pagination` (?no_pagination=true) -
 * podle vzoru viděného jinde v aplikaci (`shop/products?no_pagination=true`). Pokud
 * PaginatedListStore posílá jiný název parametru pro koš, jde o jednořádkovou opravu zde.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebExternalLink;
use App\Models\Shop\ShopLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class WebExternalLinkController extends Controller
{
    /**
     * @description Vrátí seznam externích odkazů (aktivních, nebo košových podle ?trashed=)
     *              s podporou filtrování, řazení a volitelného stránkování.
     */
    public function index(Request $request): JsonResponse
    {
        $query = $request->boolean('only_trashed')
            ? WebExternalLink::onlyTrashed()
            : WebExternalLink::query();

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
     * @description Vrátí detail jednoho odkazu (včetně smazaných, pro zobrazení v koši).
     */
    public function show($id): JsonResponse
    {
        $link = WebExternalLink::withTrashed()->findOrFail($id);
        return response()->json($link);
    }

    /**
     * @description Vytvoří nový externí odkaz.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'      => 'required|string|max:150',
            'url'       => 'required|url|max:500',
            'position'  => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $link = WebExternalLink::create([
            'name'      => $validated['name'],
            'url'       => $validated['url'],
            'position'  => $validated['position'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $this->logAction($request, 'create', 'Web', "Vytvořen externí odkaz: {$link->name}", $link->id);
        return response()->json($link, 201);
    }

    /**
     * @description Aktualizuje existující externí odkaz.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $link = WebExternalLink::findOrFail($id);

        $validated = $request->validate([
            'name'      => 'required|string|max:150',
            'url'       => 'required|url|max:500',
            'position'  => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $link->update($validated);

        $this->logAction($request, 'update', 'Web', "Upraven externí odkaz: {$link->name}", $link->id);
        return response()->json($link);
    }

    /**
     * @description Soft-delete odkazu (přesun do koše).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $link = WebExternalLink::findOrFail($id);
        $name = $link->name;
        $link->delete();

        $this->logAction($request, 'delete', 'Web', "Smazán externí odkaz: {$name}", (int) $id);
        return response()->json(null, 204);
    }

    /**
     * @description Obnoví odkaz z koše zpět mezi aktivní.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $link = WebExternalLink::onlyTrashed()->findOrFail($id);
        $link->restore();

        $this->logAction($request, 'restore', 'Web', "Obnoven externí odkaz: {$link->name}", $link->id);
        return response()->json($link);
    }

    /**
     * @description Trvale smaže všechny záznamy v koši (nevratné).
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        $count = WebExternalLink::onlyTrashed()->count();
        WebExternalLink::onlyTrashed()->forceDelete();

        $this->logAction($request, 'delete', 'Web', "Trvale smazáno {$count} externích odkazů z koše");
        return response()->json(null, 204);
    }

    /**
     * @description Loguje administrativní akce do centrálního auditního systému.
     */
    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null): void
    {
        try {
            $user = $request->user();
            ShopLog::create([
                'origin' => $request->ip(),
                'event_type' => $eventType,
                'module' => $module,
                'description' => $description,
                'affected_entity_type' => 'WebExternalLink',
                'affected_entity_id' => $affectedId,
                'user_id' => $user?->id,
                'context_data' => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_plain' => $user ? ($user->full_name ?? $user->user_email) : 'System',
            ]);
        } catch (\Exception $e) {
            Log::error("Log error: " . $e->getMessage());
        }
    }
}