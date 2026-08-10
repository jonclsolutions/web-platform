<?php
/**
 * @file DocumentSectionController.php
 * @path app/Http/Controllers/Api/Legal/DocumentSectionController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages CRUD operations and public delivery of legal document sections, featuring language-based fallback logic and audit logging.
 *
 * @refactor-note (2026) `publicShow()` dřív mapovalo slug na document_type_id natvrdo
 * (`$slug === 'gdpr' ? 1 : ($slug === 'tos' ? 2 : null)`), takže nový typ dokumentu
 * ("cookies") by vždy skončil 404. Přepsáno na dohledání `DocumentType` podle `slug`
 * sloupce - funguje tak pro libovolný typ dokumentu bez další úpravy kódu. Zároveň
 * doplněno pole `footer_effective`, které šablona (`{{ data.footer_effective }}`)
 * očekávala, ale odpověď ho dřív vůbec neposílala.
 *
 * @refactor-note (2026-08) Logování přesunuto z lokální `logAction()` (chybně mířila
 * do `shop_logs`, viz incident - GDPR/TOS/Cookies změny se logovaly do e-shopové audit
 * tabulky) na sdílený `LogsActivity` trait, zapisující do `CoreLog::class`. Právní
 * dokumenty jsou dle dohodnutého rozdělení Core/Web/Shop doménou Core (sdílené napříč
 * Web a Shop), stejně jako auth, uživatelé, role a site settings.
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
            $this->logAction($request, CoreLog::class, 'create', 'Legal', "Created section: {$section->heading} ({$section->lang})", $section->id, 'DocumentSection');
            return response()->json(new DocumentSectionResource($section), 201);
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'Legal', "Error creating section: " . $e->getMessage(), null, 'DocumentSection');
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

            $this->logAction($request, CoreLog::class, 'update', 'Legal', "Updated section: {$section->heading} ({$section->lang})", $section->id, 'DocumentSection');
            return response()->json(new DocumentSectionResource($section));
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'Legal', "Error updating section ID {$id}: " . $e->getMessage(), (int)$id, 'DocumentSection');
            Log::error("Legal Update Error: " . $e->getMessage());
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

        $lastUpdate = $data->max('updated_at');

        return response()->json([
            'header_main' => $documentType->title,
            'last_update_date' => $lastUpdate?->format('d.m.Y') ?? date('d.m.Y'),
            'footer_effective' => $lastUpdate
                ? 'Tyto zásady jsou účinné od ' . $lastUpdate->format('d.m.Y') . '.'
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
        try {
            $section = DocumentSection::findOrFail($id);
            $heading = $section->heading;
            $section->delete();
            $this->logAction($request, CoreLog::class, 'delete', 'Legal', "Deleted section: {$heading}", (int)$id, 'DocumentSection');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'Legal', "Error deleting section ID {$id}: " . $e->getMessage(), (int)$id, 'DocumentSection');
            Log::error("Legal Delete Error: " . $e->getMessage());
            return response()->json(['message' => 'Error deleting section.'], 500);
        }
    }
}