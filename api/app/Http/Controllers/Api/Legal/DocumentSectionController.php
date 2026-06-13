<?php

namespace App\Http\Controllers\Api\Legal;

use App\Http\Controllers\Controller;
use App\Models\Legal\DocumentSection;
use App\Models\Shop\ShopLog;
use App\Http\Resources\Legal\DocumentSectionResource;
use App\Http\Requests\Legal\DocumentSection\StoreDocumentSectionRequest;
use App\Http\Requests\Legal\DocumentSection\UpdateDocumentSectionRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class DocumentSectionController extends Controller
{
    /**
     * Získání všech sekcí pro konkrétní typ dokumentu.
     */
    public function index(Request $request): JsonResponse
    {
        $query = DocumentSection::query();
        
        if ($typeId = $request->input('document_type_id')) {
            $query->where('document_type_id', $typeId);
        }

        $data = $query->orderBy('position', 'asc')->get();
        return response()->json(DocumentSectionResource::collection($data));
    }

    /**
     * Uložení nové sekce.
     */
    public function store(StoreDocumentSectionRequest $request): JsonResponse
    {
        try {
            $section = DocumentSection::create($request->validated());
            $this->logAction($request, 'create', 'Legal', "Vytvořena sekce: {$section->heading}", $section->id);
            return response()->json(new DocumentSectionResource($section), 201);
        } catch (\Exception $e) {
            Log::error("Legal Store Error: " . $e->getMessage());
            return response()->json(['message' => 'Chyba při vytváření sekce.'], 500);
        }
    }

    /**
     * Získání detailu jedné sekce.
     */
    public function show($id): JsonResponse
    {
        $section = DocumentSection::findOrFail($id);
        return response()->json(new DocumentSectionResource($section));
    }

    /**
     * Aktualizace existující sekce.
     */
    public function update(UpdateDocumentSectionRequest $request, $id): JsonResponse
    {
        try {
            $section = DocumentSection::findOrFail($id);
            $section->update($request->validated());
            
            $this->logAction($request, 'update', 'Legal', "Aktualizace sekce ID: {$id}", $id);
            return response()->json(new DocumentSectionResource($section));
        } catch (\Exception $e) {
            Log::error("Legal Update Error: " . $e->getMessage());
            return response()->json(['message' => 'Aktualizace selhala.'], 500);
        }
    }
/**
     * VEŘEJNÉ ZOBRAZENÍ: Načtení dle slugu (gdpr / tos).
     */
    public function publicShow(string $slug): JsonResponse
    {
        // Mapování slugu na ID v databázi
        $typeId = ($slug === 'gdpr') ? 1 : (($slug === 'tos') ? 2 : null);

        if (!$typeId) {
            return response()->json(['message' => 'Dokument nenalezen.'], 404);
        }

        $data = DocumentSection::where('document_type_id', $typeId)
            ->orderBy('position', 'asc')
            ->get();

        return response()->json([
            'header_main' => ($typeId === 1) ? 'GDPR' : 'Obchodní podmínky',
            'last_update_date' => $data->max('updated_at')?->format('d.m.Y') ?? date('d.m.Y'),
            'sections' => DocumentSectionResource::collection($data)
        ]);
    }
    /**
     * Smazání sekce.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $section = DocumentSection::findOrFail($id);
            $heading = $section->heading;
            $section->delete();
            
            $this->logAction($request, 'delete', 'Legal', "Smazána sekce: {$heading}", (int)$id);
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error("Legal Delete Error: " . $e->getMessage());
            return response()->json(['message' => 'Chyba při mazání sekce.'], 500);
        }
    }

    /**
     * Interní metoda pro logování akcí v modulu Legal.
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
                'affected_entity_type' => 'DocumentSection',
                'affected_entity_id' => $affectedId,
                'user_id' => $user?->id,
                'context_data' => json_encode($request->all(), JSON_UNESCAPED_UNICODE),
                'user_plain' => $user ? ($user->full_name ?? $user->user_email) : 'Systém'
            ]);
        } catch (\Exception $e) { 
            Log::error("Log error: " . $e->getMessage()); 
        }
    }
}