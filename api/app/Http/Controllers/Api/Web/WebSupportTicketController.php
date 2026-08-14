<?php
/**
 * @file WebSupportTicketController.php
 * @path app/Http/Controllers/Api/Web/WebSupportTicketController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the support ticket lifecycle, including creation, status tracking, file attachment management, and audit logging.
 * @refactor-note (2026-08-2) Attachment storage moved to the polymorphic `web_attachments` table.
 * @refactor-note (2026-08-6) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction(). Doménově beze změny (WebLog::class).
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebSupportTicket;
use App\Models\Web\WebLog;
use App\Http\Requests\Web\WebSupportTicket\StoreWebSupportTicketRequest;
use App\Http\Requests\Web\WebSupportTicket\UpdateWebSupportTicketRequest;
use App\Http\Resources\Web\WebSupportTicketResource;
use App\Traits\HandlesAttachments;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

/**
 * @description Controller responsible for processing customer support tickets.
 * @note Supports soft-delete operations and persistent file storage (via HandlesAttachments) for ticket attachments.
 */
class WebSupportTicketController extends Controller
{
    use HandlesAttachments;
    use LogsActivity;

    /**
     * Storage folder for ticket attachments within the public disk.
     */
    private const ATTACHMENT_FOLDER = 'tickets';

    /**
     * Retrieves a paginated list of support tickets based on filters and sorting criteria.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebSupportTicket::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($s = $request->input('search')) {
            $query->where(fn($q) => $q->where('subject', 'like', "%$s%")
                ->orWhere('description', 'like', "%$s%")
                ->orWhere('user_plain', 'like', "%$s%"));
        }

        foreach (['id', 'priority', 'category'] as $f) {
            if ($request->filled($f)) {
                $query->where($f, $request->input($f));
            }
        }

        if ($request->filled('status')) {
            $query->where('state', $request->input('status'));
        }

        $sortBy = $request->input('sort_by', 'created_at');
        $direction = strtolower($request->input('sort_direction', 'desc'));
        $sortDirection = in_array($direction, ['asc', 'desc']) ? $direction : 'desc';

        $query->orderBy($sortBy, $sortDirection);

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, WebLog::class, 'export', 'WebSupportTicket', "Hromadný export support ticketů.");
            $data = $query->get();
            return response()->json(WebSupportTicketResource::collection($data));
        }

        $data = $query->paginate($perPage);

        return response()->json([
            'data'         => WebSupportTicketResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * Stores a new support ticket and handles the optional file attachment.
     */
    public function store(StoreWebSupportTicketRequest $request): JsonResponse
    {
        try {
            $data = $request->validated();
            unset($data['attachment']);

            $user = $request->user() ?? auth('sanctum')->user();

            if ($user) {
                $data['user_id'] = $user->id;
                $data['user_name_plain'] = $data['user_name_plain'] ?? ($user->full_name ?? $user->user_email);
                $data['user_plain'] = $data['user_plain'] ?? $user->user_email;
            }

            $ticket = WebSupportTicket::create($data);

            $this->storeSingleAttachment($request, $ticket, self::ATTACHMENT_FOLDER, 'attachment');

            $this->logAction($request, WebLog::class, 'create', 'WebSupportTicket', "Nový ticket: {$ticket->subject}", $ticket->id, 'WebSupportTicket');

            return response()->json(new WebSupportTicketResource($ticket->load('attachments')), 201);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při vytváření ticketu: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření ticketu selhalo.'], 500);
        }
    }

    /**
     * Retrieves a single support ticket by ID, including soft-deleted items.
     */
    public function show($id): JsonResponse
    {
        $supportTicket = WebSupportTicket::withTrashed()->with('attachments')->findOrFail($id);
        return response()->json(new WebSupportTicketResource($supportTicket));
    }

    /**
     * Updates an existing support ticket and manages attachment replacement.
     */
    public function update(UpdateWebSupportTicketRequest $request, $id): JsonResponse
    {
        try {
            $ticket = WebSupportTicket::withTrashed()->findOrFail($id);
            $validated = $request->validated();
            unset($validated['attachment']);

            $ticket->update($validated);

            $this->storeSingleAttachment($request, $ticket, self::ATTACHMENT_FOLDER, 'attachment');

            $this->logAction($request, WebLog::class, 'update', 'WebSupportTicket', "Aktualizace ticketu ID: {$id}", (int) $id, 'WebSupportTicket');

            return response()->json(new WebSupportTicketResource($ticket->fresh()->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při aktualizaci ticketu ID {$id}: " . $e->getMessage(), (int) $id, 'WebSupportTicket');
            return response()->json(['message' => 'Aktualizace ticketu selhala.'], 500);
        }
    }

    /**
     * Deletes a support ticket (Soft or Hard).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebSupportTicket::withTrashed()->with('attachments')->findOrFail($id);

            if ($forceDelete) {
                $this->deleteAllAttachments($item);
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, WebLog::class, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSupportTicket', "Smazání ticketu ID: $id", (int) $id, 'WebSupportTicket');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při mazání ticketu ID $id: " . $e->getMessage(), (int) $id, 'WebSupportTicket');
            return response()->json(['message' => 'Smazání ticketu selhalo.'], 500);
        }
    }

    /**
     * Restores a soft-deleted support ticket.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebSupportTicket::withTrashed()->findOrFail($id);
            $item->restore();

            $this->logAction($request, WebLog::class, 'restore', 'WebSupportTicket', "Obnova ticketu ID: $id", (int) $id, 'WebSupportTicket');
            return response()->json(new WebSupportTicketResource($item->load('attachments')));
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při obnově ticketu ID $id: " . $e->getMessage(), (int) $id, 'WebSupportTicket');
            return response()->json(['message' => 'Obnova ticketu selhala.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted tickets and associated files.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashed = WebSupportTicket::onlyTrashed()->with('attachments')->get();
            $count = $trashed->count();

            foreach ($trashed as $ticket) {
                $this->deleteAllAttachments($ticket);
                $ticket->forceDelete();
            }

            $this->logAction($request, WebLog::class, 'force_delete_all', 'WebSupportTicket', "Hromadné smazání koše ticketů. Počet: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, WebLog::class, 'error', 'WebSupportTicket', "Chyba při vysypávání koše ticketů: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }
}