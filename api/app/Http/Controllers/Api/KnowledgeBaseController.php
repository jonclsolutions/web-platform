<?php
/**
 * @file KnowledgeBaseController.php
 * @path app/Http/Controllers/Api/KnowledgeBaseController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The internal manual (Knowledge Base) of the administration for the signed-in user:
 * the menu and single pages, filtered by the user's permissions (App\Support\KnowledgeBase).
 * No permission middleware - every signed-in user gets the general pages; a page the user may
 * not see answers 404 like a missing one (its existence is not revealed).
 * @dependencies App\Support\KnowledgeBase\KnowledgeBase
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\KnowledgeBase\KnowledgeBase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KnowledgeBaseController extends Controller
{
    /**
     * @description Menu of the pages the user may open.
     * @param Request $request Query `lang` (default cz).
     * @return JsonResponse { data: [{ id, group, order, label }] }
     */
    public function index(Request $request): JsonResponse
    {
        return $this->respond((new KnowledgeBase($request->user()))->menu($this->lang($request)));
    }

    /**
     * @description One page with the sections the user may see.
     * @param Request $request Query `lang` (default cz).
     * @param string $id Page id.
     * @return JsonResponse { data: { id, group, order, navLabel, header, sections } }; 404.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $page = (new KnowledgeBase($request->user()))->page($id, $this->lang($request));

        return $page === null
            ? response()->json(['message' => 'Page not found.'], 404)
            : $this->respond($page);
    }

    /**
     * @description Requested language code (letters only, default cz).
     * @param Request $request
     * @return string
     */
    private function lang(Request $request): string
    {
        $lang = strtolower((string) $request->query('lang', 'cz'));

        return preg_match('/^[a-z]{2,5}$/', $lang) === 1 ? $lang : 'cz';
    }
}
