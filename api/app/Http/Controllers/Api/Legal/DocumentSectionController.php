<?php
/**
 * @file DocumentSectionController.php
 * @path app/Http/Controllers/Api/Legal/DocumentSectionController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages CRUD operations and public delivery of legal document sections, featuring language-based fallback logic and audit logging.
 */

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

/**
 * @description Controller handling the administration and public serving of multi-language legal document sections.
 * @note Implements a language-fallback strategy for public viewing to ensure content availability.
 */
class DocumentSectionController extends Controller
{
    /**
     * Retrieves all sections for a specific document type and language.
     *
     * @param Request $request The incoming request with filtering parameters (document_type_id, lang).
     * @return JsonResponse Collection of document sections ordered by position.
     */
    public function index(Request $request): JsonResponse
    {
        $query = DocumentSection::query();
        
        if ($typeId = $request->input('document_type_id')) {
            $query->where('document_type_id', $typeId);
        }

        if ($lang = $request->input('lang')) {
            $query->where('lang', $lang);
        }

        $data = $query->orderBy('position', 'asc')->get();
        return response()->json(DocumentSectionResource::collection($data));
    }

    /**
     * Stores a new legal section.
     *
     * @param StoreDocumentSectionRequest $request Validated request containing section data.
     * @return JsonResponse Returns the created section resource.
     */
    public function store(StoreDocumentSectionRequest $request): JsonResponse
    {
        try {
            $section = DocumentSection::create($request->validated());
            $this->logAction($request, 'create', 'Legal', "Created section: {$section->heading} ({$section->lang})", $section->id);
            return response()->json(new DocumentSectionResource($section), 201);
        } catch (\Exception $e) {
            Log::error("Legal Store Error: " . $e->getMessage());
            return response()->json(['message' => 'Error creating section.'], 500);
        }
    }

    /**
     * Retrieves details for a single section.
     *
     * @param int|string $id The ID of the section.
     * @return JsonResponse Returns the section resource.
     */
    public function show($id): JsonResponse
    {
        $section = DocumentSection::findOrFail($id);
        return response()->json(new DocumentSectionResource($section));
    }

    /**
     * Updates an existing legal section.
     *
     * @param UpdateDocumentSectionRequest $request Validated request data.
     * @param int|string $id The ID of the section to update.
     * @return JsonResponse Returns the updated section resource.
     */
    public function update(UpdateDocumentSectionRequest $request, $id): JsonResponse
    {
        try {
            $section = DocumentSection::findOrFail($id);
            $section->update($request->validated());
            
            $this->logAction($request, 'update', 'Legal', "Updated section ID: {$id}", $id);
            return response()->json(new DocumentSectionResource($section));
        } catch (\Exception $e) {
            Log::error("Legal Update Error: " . $e->getMessage());
            return response()->json(['message' => 'Update failed.'], 500);
        }
    }

    /**
     * Serves content for public display, mapping slugs (gdpr/tos) to document types with language fallback.
     *
     * @param Request $request The incoming request.
     * @param string $slug The document type identifier (e.g., 'gdpr').
     * @return JsonResponse Document sections and metadata.
     */
    public function publicShow(Request $request, string $slug): JsonResponse
    {
        $typeId = ($slug === 'gdpr') ? 1 : (($slug === 'tos') ? 2 : null);

        if (!$typeId) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $lang = $request->input('lang', 'cz');

        // Attempt to load requested language
        $data = DocumentSection::where('document_type_id', $typeId)
            ->where('lang', $lang)
            ->orderBy('position', 'asc')
            ->get();

        // Fallback: If no content in requested language, default to 'cz'
        if ($data->isEmpty() && $lang !== 'cz') {
            $data = DocumentSection::where('document_type_id', $typeId)
                ->where('lang', 'cz')
                ->orderBy('position', 'asc')
                ->get();
        }

        return response()->json([
            'header_main' => ($typeId === 1) ? 'GDPR' : 'Terms of Service',
            'last_update_date' => $data->max('updated_at')?->format('d.m.Y') ?? date('d.m.Y'),
            'sections' => DocumentSectionResource::collection($data)
        ]);
    }

    /**
     * Deletes a legal section.
     *
     * @param Request $request The incoming request.
     * @param int|string $id The ID of the section to delete.
     * @return JsonResponse Returns 204 status on success.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $section = DocumentSection::findOrFail($id);
            $heading = $section->heading;
            $section->delete();
            
            $this->logAction($request, 'delete', 'Legal', "Deleted section: {$heading}", (int)$id);
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error("Legal Delete Error: " . $e->getMessage());
            return response()->json(['message' => 'Error deleting section.'], 500);
        }
    }

    /**
     * Logs administrative actions to the central audit system.
     *
     * @param Request $request Request object for context.
     * @param string $eventType Action type (create, update, delete).
     * @param string $module Module identification.
     * @param string $description Audit log message.
     * @param int|null $affectedId ID of the affected entity.
     * @return void
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
                'user_plain' => $user ? ($user->full_name ?? $user->user_email) : 'System'
            ]);
        } catch (\Exception $e) { 
            Log::error("Log error: " . $e->getMessage()); 
        }
    }
}