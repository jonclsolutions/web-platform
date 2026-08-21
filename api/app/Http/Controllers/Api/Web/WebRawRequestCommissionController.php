<?php
/**
 * @file WebRawRequestCommissionController.php
 * @path app/Http/Controllers/Api/Web/WebRawRequestCommissionController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages raw commission request submissions, supporting multiple file
 * attachments, status tracking, and administrative audit logging.
 *
 * @refactor-note (2026-08) Jednosouborové pole `file_path` KOMPLETNĚ ODSTRANĚNO (sloupec
 * smazán z DB) - nahrazeno polymorfním `web_attachments` vztahem přes `HandlesAttachments`
 * trait, podporujícím až 10 příloh na jeden požadavek.
 *
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction(). Lokální verze ručně volala `json_encode()` na
 * `context_data` PŘED `create()` - u modelu s `'array'` castem (WebLog má `'array'`
 * cast na `context_data`, viz CoreLog/WebLog/ShopLog) to vede k DVOJITÉMU enkódování
 * (stejný bug, jaký byl opraven u DocumentSectionController/SiteConfigurationController -
 * viz LogsActivity trait hlavička). Trait navíc stripuje citlivá pole a ořezává
 * description/context_data na bezpečnou velikost, což lokální verze vůbec nedělala.
 * Doménově zůstává WebLog::class beze změny (Web sekce).
 *
 * @bugfix-note (2026-08-19) `index()` NEEAGER-LOADOVAL vztah `attachments` -
 * `WebRawRequestCommissionResource::toArray()` používá `$this->whenLoaded('attachments')`,
 * který bez `->with('attachments')` na dotazu vrátí "chybějící hodnotu" a klíč
 * `attachments` se z JSON odpovědi ÚPLNĚ VYNECHÁ (ne prázdné pole - klíč tam vůbec
 * není). Admin frontend přitom řádek z TÉTO odpovědi (ne z `show()`) používá i pro
 * předvyplnění editačního formuláře (`editFormOpened` event nese objekt přímo z
 * tabulky) - existující přílohy tak v editaci nebyly vůbec vidět, i když v detailu
 * (který interně volá `show()`, ten `->with('attachments')` už měl) se zobrazovaly
 * správně. Přidáno `->with('attachments')` i sem, ať jsou obě cesty konzistentní.
 *
 * @bugfix-note (2026-08-19v2) `->send()` PŘEPNUTO NA `->queue()` - sjednoceno
 * s `WebSalesOrderController::store()`, který potvrzovací e-mail už dřív posílal přes
 * frontu. Vedlejší efekt konzistentního chování: `->send()` (synchronní) vždy použije
 * aktuální kód/šablonu ze souborového systému v okamžiku HTTP requestu, zatímco fronta
 * jede v dlouhoběžícím `queue:work` procesu, který má PHP kód natažený v paměti od
 * svého startu - po úpravě Mailable třídy/Blade šablony je proto nutné frontu
 * restartovat (`php artisan queue:restart`, případně `horizon:terminate`), jinak
 * worker dál posílá podle staré verze, dokud se sám nerestartuje. Tohle byl přesně
 * důvod, proč `WebSalesOrderReceived` (fronta) poslal starý vzhled e-mailu, zatímco
 * tento (dřív `->send()`) šel vždy s aktuální šablonou - teď mají OBĚ stejné chování
 * (a stejnou nutnost restartu fronty po každé úpravě šablony).
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebRawRequestCommission;
use App\Models\Web\WebLog;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use App\Http\Resources\Web\WebRawRequestCommissionResource;
use App\Http\Requests\Web\WebRawRequestCommission\StoreWebRawRequestCommissionRequest;
use App\Http\Requests\Web\WebRawRequestCommission\UpdateWebRawRequestCommissionRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Mail\Web\WebRawRequestCommissionReceived;
use Illuminate\Support\Facades\Mail;

/**
 * @description Controller responsible for processing raw commission inquiries submitted via the website.
 * @note Implements soft-delete functionality and managed file storage for request attachments.
 */
class WebRawRequestCommissionController extends Controller
{
    use HandlesAttachments;
    use LogsActivity;

    /**
     * Storage folder for attachments within public disk.
     */
    private const ATTACHMENT_FOLDER = 'raw_request_commissions';

    /**
     * Retrieves a paginated or full collection of commission requests with search and filtering.
     * @bugfix-note (2026-08-19) `->with('attachments')` doplněno - viz hlavička souboru.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebRawRequestCommission::query()->with('attachments');
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('thema', 'like', "%$s%")
                ->orWhere('order_description', 'like', "%$s%")
                ->orWhere('contact_email', 'like', "%$s%")
                ->orWhere('contact_phone', 'like', "%$s%"));
        }

        foreach (['id', 'status', 'priority'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        foreach (['contact_email', 'contact_phone', 'thema', 'order_description'] as $f) {
            if ($request->filled($f)) $query->where($f, 'like', '%' . $request->input($f) . '%');
        }

        if ($request->filled('created_at')) $query->whereDate('created_at', $request->created_at);

        $sortBy = $request->input('sort_by', 'id');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);
        $data = $noPagination ? $query->get() : $query->paginate($perPage);

        if ($noPagination) {
            return WebRawRequestCommissionResource::collection($data);
        }

        return response()->json([
            'data'         => WebRawRequestCommissionResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Stores a new commission request, handling multiple optional file uploads.
     */
    public function store(StoreWebRawRequestCommissionRequest $request): JsonResponse
    {
        try {
            $data = $request->safe()->except(['attachments']);

            $commission = WebRawRequestCommission::create($data);

            $this->storeAttachments($request, $commission, self::ATTACHMENT_FOLDER);

            $this->logAction($request, WebLog::class, 'create', 'WebRawRequestCommission', "Vytvořen požadavek na provizi: {$commission->thema}", $commission->id, 'WebRawRequestCommission');

            try {
                Mail::to($commission->contact_email)
                    ->queue(new WebRawRequestCommissionReceived($commission));
            } catch (\Throwable $e) {
                $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Nepodařilo se odeslat potvrzovací e-mail: " . $e->getMessage(), $commission->id, 'WebRawRequestCommission');
            }

            return response()->json(new WebRawRequestCommissionResource($commission->load('attachments')), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při vytváření požadavku: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření požadavku selhalo.'], 500);
        }
    }

    /**
     * Retrieves a single commission request by ID, including trashed records and attachments.
     */
    public function show($id): JsonResponse
    {
        $rawRequestCommission = WebRawRequestCommission::withTrashed()->with('attachments')->findOrFail($id);
        return response()->json(new WebRawRequestCommissionResource($rawRequestCommission));
    }

    /**
     * Updates an existing request. Newly uploaded attachments are ADDED to the existing
     * set (not replaced). Attachments listed in `attachments_removed_ids` (UI-only
     * staged removal - see FormBuilderComponent/MultiFileUploadComponent) are deleted
     * BEFORE new ones are stored, so a "replace" (remove old + add new in one save)
     * works correctly in a single request.
     * @bugfix-note (2026-08-19) `attachments_removed_ids` doplněno - viz
     * `HandlesAttachments::deleteAttachmentsByIds()`, scoped na `$rawRequestCommission`,
     * takže cizí ID poslaná klientem se tiše ignorují (nelze smazat přílohu jiného
     * záznamu).
     */
    public function update(UpdateWebRawRequestCommissionRequest $request, $id): JsonResponse
    {
        try {
            $rawRequestCommission = WebRawRequestCommission::findOrFail($id);

            $validated = $request->safe()->except(['attachments', 'attachments_removed_ids']);
            $rawRequestCommission->update($validated);

            $removedIds = $request->input('attachments_removed_ids', []);
            if (!empty($removedIds)) {
                $this->deleteAttachmentsByIds($rawRequestCommission, $removedIds);
            }

            $this->storeAttachments($request, $rawRequestCommission, self::ATTACHMENT_FOLDER);

            $this->logAction($request, WebLog::class, 'update', 'WebRawRequestCommission', "Aktualizace požadavku ID: {$rawRequestCommission->id}", $rawRequestCommission->id, 'WebRawRequestCommission');

            return response()->json(new WebRawRequestCommissionResource($rawRequestCommission->fresh()->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při aktualizaci požadavku ID {$id}: " . $e->getMessage(), (int) $id, 'WebRawRequestCommission');
            return response()->json(['message' => 'Aktualizace požadavku selhala.'], 500);
        }
    }

    /**
     * Deletes a request (Soft or Hard). On hard delete, all associated attachment files
     * and their DB records are removed too (see HandlesAttachments::deleteAllAttachments()).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebRawRequestCommission::withTrashed()->with('attachments')->findOrFail($id);

            if ($forceDelete) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebRawRequestCommission', "Smazání požadavku na provizi ID: $id", (int) $id, 'WebRawRequestCommission');

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při mazání požadavku ID $id: " . $e->getMessage(), (int) $id, 'WebRawRequestCommission');
            return response()->json(['message' => 'Smazání požadavku selhalo.'], 500);
        }
    }

    /**
     * Restores a soft-deleted request.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebRawRequestCommission::withTrashed()->findOrFail($id);
            $item->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebRawRequestCommission', "Obnova požadavku ID: $id", (int) $id, 'WebRawRequestCommission');

            return response()->json(new WebRawRequestCommissionResource($item->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při obnově požadavku ID $id: " . $e->getMessage(), (int) $id, 'WebRawRequestCommission');
            return response()->json(['message' => 'Obnova požadavku selhala.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted records and all their attachment files.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashed = WebRawRequestCommission::onlyTrashed()->with('attachments')->get();
            $count = $trashed->count();

            foreach ($trashed as $item) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            }

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebRawRequestCommission', "Hromadné smazání koše provizí. Počet: $count");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebRawRequestCommission', "Chyba při vyprazdňování koše provizí: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }
}