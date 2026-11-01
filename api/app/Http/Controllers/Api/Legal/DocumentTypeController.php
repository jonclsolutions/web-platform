<?php

namespace App\Http\Controllers\Api\Legal;

use App\Http\Controllers\Controller;
use App\Models\Legal\DocumentType;
use Illuminate\Http\JsonResponse;

/**
 * @description Lists the legal document types (GDPR, TOS, cookies, ...), so the admin renders
 * its tabs from the `document_types` table - a new type needs no code change.
 */
class DocumentTypeController extends Controller
{
    /**
     * @description Returns every document type ordered by ID (creation order).
     */
    public function index(): JsonResponse
    {
        $types = DocumentType::query()
            ->orderBy('id')
            ->get(['id', 'slug', 'title']);

        return $this->respond($types);
    }
}