<?php
/**
 * @file DocumentSectionController.php
 * @path app/Http/Controllers/Api/Legal/DocumentSectionController.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages CRUD operations and public delivery of legal document sections, featuring language-based fallback logic and audit logging.
 */

namespace App\Http\Controllers\Api\Legal;

use App\Http\Controllers\Controller;
use App\Models\Legal\DocumentSection;
use App\Models\Legal\DocumentType;
use App\Models\Core\CoreLog;
use App\Http\Resources\Legal\DocumentSectionResource;
use App\Http\Requests\Legal\DocumentSection\StoreDocumentSectionRequest;
use App\Http\Requests\Legal\DocumentSection\UpdateDocumentSectionRequest;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * @description Controller handling the administration and public serving of multi-language legal document sections.
 * @note Implements a language-fallback strategy for public viewing to ensure content availability.
 */
class DocumentSectionController extends Controller
{
    use LogsActivity;

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
        return $this->respond(DocumentSectionResource::collection($data));
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
            $this->logAction($request, CoreLog::class, 'create', 'Legal', "Created section: {$section->heading} ({$section->lang})", $section->id, 'DocumentSection');
            return $this->respond(new DocumentSectionResource($section), 201);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, CoreLog::class, 'error', 'Legal', "Error creating section: " . $e->getMessage(), null, 'DocumentSection');
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
        return $this->respond(new DocumentSectionResource($section));
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
        $section = DocumentSection::findOrFail($id);

        try {
            $section->update($request->validated());

            $this->logAction($request, CoreLog::class, 'update', 'Legal', "Updated section: {$section->heading} ({$section->lang})", $section->id, 'DocumentSection');
            return $this->respond(new DocumentSectionResource($section));
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, CoreLog::class, 'error', 'Legal', "Error updating section ID {$id}: " . $e->getMessage(), (int)$id, 'DocumentSection');
            return response()->json(['message' => 'Update failed.'], 500);
        }
    }

    /**
     * Serves content for public display, mapping a document type slug (gdpr/tos/cookies/...)
     * to its sections, with language fallback to 'cz' when the requested language has no content.
     *
     * @param Request $request The incoming request.
     * @param string $slug The document type identifier (e.g., 'gdpr', 'tos', 'cookies').
     * @return JsonResponse Document sections and metadata.
     */
    public function publicShow(Request $request, string $slug): JsonResponse
    {
        $documentType = DocumentType::where('slug', $slug)->first();

        if (!$documentType) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $lang = $request->input('lang', 'cz');

        // Attempt to load requested language
        $data = DocumentSection::where('document_type_id', $documentType->id)
            ->where('lang', $lang)
            ->orderBy('position', 'asc')
            ->get();

        // Fallback: If no content in requested language, default to 'cz'
        if ($data->isEmpty() && $lang !== 'cz') {
            $data = DocumentSection::where('document_type_id', $documentType->id)
                ->where('lang', 'cz')
                ->orderBy('position', 'asc')
                ->get();
        }

        // Last fallback (2026-10-31): any language the document has (e.g. only the English
        // templates of a new installation) - a legal page is never empty while it has sections.
        if ($data->isEmpty()) {
            $anyLang = DocumentSection::where('document_type_id', $documentType->id)->orderBy('lang')->value('lang');
            if ($anyLang !== null) {
                $data = DocumentSection::where('document_type_id', $documentType->id)
                    ->where('lang', $anyLang)
                    ->orderBy('position', 'asc')
                    ->get();
            }
        }

        $lastUpdate = $data->max('updated_at');

        return $this->respond([
            'header_main' => $documentType->title,
            'last_update_date' => $lastUpdate?->format('d.m.Y') ?? date('d.m.Y'),
            'footer_effective' => $lastUpdate
                ? 'This policy is effective from ' . $lastUpdate->format('d.m.Y') . '.'
                : null,
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
        $section = DocumentSection::findOrFail($id);

        try {
            $heading = $section->heading;
            $section->delete();
            $this->logAction($request, CoreLog::class, 'delete', 'Legal', "Deleted section: {$heading}", (int)$id, 'DocumentSection');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            $this->logAction($request, CoreLog::class, 'error', 'Legal', "Error deleting section ID {$id}: " . $e->getMessage(), (int)$id, 'DocumentSection');
            return response()->json(['message' => 'Error deleting section.'], 500);
        }
    }
}