<?php

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebSupportTicket;
use App\Models\Web\WebLog;
use App\Http\Requests\Web\WebSupportTicket\StoreWebSupportTicketRequest;
use App\Http\Requests\Web\WebSupportTicket\UpdateWebSupportTicketRequest;
use App\Http\Resources\Web\WebSupportTicketResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class WebSupportTicketController extends Controller
{
    /**
     * Seznam tiketů s filtrací a funkčním řazením.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN);

        $query = WebSupportTicket::query();
        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        // --- FILTRACE ---
if ($s = $request->input('search')) {
    $query->where(fn($q) => $q->where('subject', 'like', "%$s%")
        ->orWhere('description', 'like', "%$s%")
        ->orWhere('user_plain', 'like', "%$s%"));
}

// Přesná shoda (Upraveno tak, aby se frontendový 'status' správně dotazoval do DB na 'state')
foreach (['id', 'priority', 'category'] as $f) {
    if ($request->filled($f)) {
        $query->where($f, $request->input($f));
    }
}

// Speciální ošetření pro stav (Front: status -> DB: state)
if ($request->filled('status')) {
    $query->where('state', $request->input('status'));
}

        // --- ŘAZENÍ ---
        $sortBy = $request->input('sort_by', 'created_at');
        $direction = strtolower($request->input('sort_direction', 'desc'));
        $sortDirection = in_array($direction, ['asc', 'desc']) ? $direction : 'desc';

        $query->orderBy($sortBy, $sortDirection);

        // --- EXEKUCE ---
        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        // Logování exportu
        if ($noPagination) {
            $this->logAction($request, 'export', 'WebSupportTicket', "Hromadný export support ticketů.");
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
     * Vytvoření tiketu s automatickým doplněním uživatele.
     */
    public function store(StoreWebSupportTicketRequest $request): JsonResponse
    {
        try {
            $data = $request->all(); 
            $user = $request->user() ?? auth('sanctum')->user();

            if ($user) {
                $data['user_id'] = $user->id;
                $data['user_name_plain'] = $data['user_name_plain'] ?? ($user->full_name ?? $user->user_email);
                $data['user_plain'] = $data['user_plain'] ?? $user->user_email;
            }
            
            if ($request->hasFile('attachment')) {
                $path = $request->file('attachment')->store('tickets', 'public');
                $data['attachment_path'] = $path;
            }

            $ticket = WebSupportTicket::create($data);

            $this->logAction($request, 'create', 'WebSupportTicket', "Nový ticket: {$ticket->subject}", $ticket->id);
            
            return response()->json(new WebSupportTicketResource($ticket), 201);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSupportTicket', "Chyba při vytváření ticketu: " . $e->getMessage());
            return response()->json(['message' => 'Vytvoření ticketu selhalo.'], 500);
        }
    }

/**
     * Detail tiketu (včetně smazaných v koši).
     */
    public function show($id): JsonResponse
    {
        // 🔧 Ruční vyhledání podle ID (včetně smazaných v koši)
        $supportTicket = WebSupportTicket::withTrashed()->findOrFail($id);
        
        return response()->json(new WebSupportTicketResource($supportTicket));
    }

   /**
     * Aktualizace support ticketu (ruční načtení podle ID).
     */
    public function update(UpdateWebSupportTicketRequest $request, $id): JsonResponse
    {
        try {
            // 🔧 Ruční načtení podle ID (konzistentní s api.php {id})
            // Používáme withTrashed(), aby admin mohl reagovat i na tikety v koši
            $ticket = \App\Models\Web\WebSupportTicket::withTrashed()->findOrFail($id);

            $validated = $request->validated();

            // Zpracování přílohy (attachment)
            if ($request->hasFile('attachment')) {
                // Smazání staré přílohy, pokud existuje
                if ($ticket->attachment_path) {
                    \Illuminate\Support\Facades\Storage::disk('public')->delete($ticket->attachment_path);
                }
                $path = $request->file('attachment')->store('tickets', 'public');
                $validated['attachment_path'] = $path;
            }

            $ticket->update($validated);

            $this->logAction(
                $request, 
                'update', 
                'WebSupportTicket', 
                "Aktualizace ticketu ID: {$id}", 
                $id
            );
            
            return response()->json(new \App\Http\Resources\Web\WebSupportTicketResource($ticket->fresh()));
        } catch (\Exception $e) {
            $this->logAction(
                $request, 
                'error', 
                'WebSupportTicket', 
                "Chyba při aktualizaci ticketu ID {$id}: " . $e->getMessage(), 
                $id
            );
            return response()->json(['message' => 'Aktualizace ticketu selhala.'], 500);
        }
    }

    /**
     * Smazání tiketu.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $forceDelete = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $item = WebSupportTicket::withTrashed()->findOrFail($id);
            
            if ($forceDelete) {
                if ($item->attachment_path) {
                    Storage::disk('public')->delete($item->attachment_path);
                }
                $item->forceDelete();
            } else {
                $item->delete();
            }

            $this->logAction($request, $forceDelete ? 'hard_delete' : 'soft_delete', 'WebSupportTicket', "Smazání ticketu ID: $id", $id);
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSupportTicket', "Chyba při mazání ticketu ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Smazání ticketu selhalo.'], 500);
        }
    }

    /**
     * Obnova smazaného tiketu.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        try {
            $item = WebSupportTicket::withTrashed()->findOrFail($id);
            $item->restore();
            
            $this->logAction($request, 'restore', 'WebSupportTicket', "Obnova ticketu ID: $id", $id);
            return response()->json(new WebSupportTicketResource($item));
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSupportTicket', "Chyba při obnově ticketu ID $id: " . $e->getMessage(), $id);
            return response()->json(['message' => 'Obnova ticketu selhala.'], 500);
        }
    }

    /**
     * Vymazání koše.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        try {
            $trashed = WebSupportTicket::onlyTrashed()->get();
            $count = $trashed->count();

            foreach ($trashed as $ticket) {
                if ($ticket->attachment_path) {
                    Storage::disk('public')->delete($ticket->attachment_path);
                }
                $ticket->forceDelete();
            }

            $this->logAction($request, 'force_delete_all', 'WebSupportTicket', "Hromadné smazání koše ticketů. Počet: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, 'error', 'WebSupportTicket', "Chyba při vysypávání koše ticketů: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }

    /**
     * Logování akcí do WebLog.
     */
    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null)
    {
        try {
            // Získání uživatele přes sanctum i pro veřejné/hybridní routy
            $user = $request->user() ?? auth('sanctum')->user();

            WebLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => $description,
                'affected_entity_type' => 'WebSupportTicket',
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => json_encode($request->except(['attachment']), JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'     => $user ? $user->user_email : 'system/anonymous'
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (WebSupportTicket): " . $e->getMessage());
        }
    }
}