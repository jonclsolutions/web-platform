<?php
/**
 * @file WebRawRequestCommissionController.php
 * @path app/Http/Controllers/Api/Web/WebRawRequestCommissionController.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Manages raw commission request submissions, supporting file attachments, status tracking, and administrative audit logging.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebRawRequestCommission;
use App\Models\Web\WebLog;
use App\Http\Resources\Web\WebRawRequestCommissionResource;
use App\Http\Requests\Web\WebRawRequestCommission\StoreWebRawRequestCommissionRequest;
use App\Http\Requests\Web\WebRawRequestCommission\UpdateWebRawRequestCommissionRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * @description Controller responsible for processing raw commission inquiries submitted via the website.
 * @note Implements soft-delete functionality and managed file storage for request attachments.
 */
class WebRawRequestCommissionController extends Controller
{
    /**
     * Storage folder for attachments within public disk.
     */
    private const ATTACHMENT_FOLDER = 'raw_request_commissions';

    /**
     * Retrieves a paginated or full collection of commission requests with search and filtering.
     *
     * @param Request $request Filters (status, priority, date) and pagination settings.
     * @return JsonResponse|mixed Returns paginated data or a collection.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebRawRequestCommission::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        // Fulltext-like search
        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('thema', 'like', "%$s%")
                ->orWhere('order_description', 'like', "%$s%")
                ->orWhere('contact_email', 'like', "%$s%")
                ->orWhere('contact_phone', 'like', "%$s%"));
        }

        // Exact match filters
        foreach (['id', 'status', 'priority'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->input($f));
        }

        // Partial match filters
        foreach (['contact_email', 'contact_phone', 'thema', 'order_description'] as $f) {
            if ($request->filled($f)) $query->where($f, 'like', '%' . $request->input($f) . '%');
        }

        if ($request->filled('created_at')) $query->whereDate('created_at', $request->created_at);

        // Sorting
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
     * Stores a new commission request, handling optional file uploads.
     *
     * @param StoreWebRawRequestCommissionRequest $request Validated request data.
     * @return JsonResponse Created commission resource.
     * @throws \Exception On database or storage failure.
     */
    public function store(StoreWebRawRequestCommissionRequest $request): JsonResponse
    {
        try {
            $data = $request->validated();

            if ($request->hasFile('attachment')) {
                $data['file_path'] = $request->file('attachment')->store(self::ATTACHMENT_FOLDER, 'public');
            }

            $commission = WebRawRequestCommission::create($data);

            $this->logAction($request, 'create', 'WebRawRequestCommission', "Vytvořen požadavek na provizi: {$commission->thema}", $commission->id);

            return response()->json(new WebRawRequestCommissionResource($commission), 201);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebRawRequestCommission', "Chyba při vytváření požadavku: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření požadavku selhalo.'], 500);
        }
    }

    /**
     * Retrieves a single commission request by ID, including trashed records.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $rawRequestCommission = WebRawRequestCommission::withTrashed()->findOrFail($id);
        
        return response()->json(new WebRawRequestCommissionResource($rawRequestCommission));
    }

    /**
     * Updates an existing request, managing attachment replacement.
     *
     * @param UpdateWebRawRequestCommissionRequest $request Validated data.
     * @param int $id Request identifier.
     * @return JsonResponse Updated resource.
     */
    public function update(UpdateWebRawRequestCommissionRequest $request, $id): JsonResponse
    {
        try {
            $rawRequestCommission = WebRawRequestCommission::findOrFail($id);

            $validated = $request->validated();

            if ($request->hasFile('attachment')) {
                if ($rawRequestCommission->file_path) {
                    Storage::disk('public')->delete($rawRequestCommission->file_path);
                }
                $validated['file_path'] = $request->file('attachment')->store(self::ATTACHMENT_FOLDER, 'public');
            }

            $rawRequestCommission->update($validated);

            $this->logAction($request, 'update', 'WebRawRequestCommission', "Aktualizace požadavku ID: {$rawRequestCommission->id}", $rawRequestCommission->id);

            return response()->json(new WebRawRequestCommissionResource($rawRequestCommission->fresh()));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebRawRequestCommission', "Chyba při aktualizaci požadavku ID {$id}: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Aktualizace požadavku selhala.'], 500);
        }
    }

    /**
     * Deletes a request (Soft or Hard), including associated files.
     *
     * @param Request $request Flags (force_delete).
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebRawRequestCommission::withTrashed()->findOrFail($id);

            if ($forceDelete) {
                if ($item->file_path) {
                    Storage::disk('public')->delete($item->file_path);
                }
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebRawRequestCommission', "Smazání požadavku na provizi ID: $id", $id);

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebRawRequestCommission', "Chyba při mazání požadavku ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Smazání požadavku selhalo.'], 500);
        }
    }

    /**
     * Restores a soft-deleted request.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebRawRequestCommission::withTrashed()->findOrFail($id);
            $item->restore();
            
            $this->logAction($request, 'restore', 'WebRawRequestCommission', "Obnova požadavku ID: $id", $id);
            
            return response()->json(new WebRawRequestCommissionResource($item));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebRawRequestCommission', "Chyba při obnově požadavku ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Obnova požadavku selhala.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted records and their files.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashed = WebRawRequestCommission::onlyTrashed()->get();
            $count = $trashed->count();

            foreach ($trashed as $item) {
                if ($item->file_path) {
                    Storage::disk('public')->delete($item->file_path);
                }
                $item->forceDelete();
            }

            $this->logAction($request, 'force_delete_all', 'WebRawRequestCommission', "Hromadné smazání koše provizí. Počet: $count");

            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebRawRequestCommission', "Chyba při vyprazdňování koše provizí: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }

    /**
     * Logs administrative actions to the central audit system.
     *
     * @param Request $request
     * @param string $eventType
     * @param string $module
     * @param string $description
     * @param int|null $affectedId
     * @return void
     */
    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null)
    {
        try {
            $user = $request->user() ?? auth('sanctum')->user();

            WebLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => $description,
                'affected_entity_type' => 'WebRawRequestCommission',
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => json_encode($request->except(['attachment']), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user ? $user->user_email : 'Veřejný formulář'
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (WebRawRequestCommission): " . $e->getMessage());
        }
    }
}