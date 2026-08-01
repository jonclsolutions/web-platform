<?php

namespace App\Http\Controllers\Api\Legal;

use App\Http\Controllers\Controller;
use App\Models\Legal\DocumentType;
use Illuminate\Http\JsonResponse;

/**
 * @description Poskytuje seznam typů právních dokumentů (GDPR, TOS, Cookies, ...).
 * @note Nový controller (2026) - dřív admin (edit-legal) měl typy dokumentů natvrdo
 * napsané jako `1 | 2` v TS kódu. Tenhle endpoint umožňuje taby v adminu vykreslovat
 * dynamicky podle skutečného obsahu `document_types` tabulky, takže přidání dalšího
 * typu dokumentu (jako teď "cookies") nevyžaduje žádnou další změnu kódu.
 */
class DocumentTypeController extends Controller
{
    /**
     * @description Vrátí všechny typy dokumentů seřazené podle ID (pořadí vzniku).
     */
    public function index(): JsonResponse
    {
        $types = DocumentType::query()
            ->orderBy('id')
            ->get(['id', 'slug', 'title']);

        return response()->json($types);
    }
}