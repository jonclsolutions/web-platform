<?php
/**
 * @file PageTitleController.php
 * @path app/Http/Controllers/Api/Legal/PageTitleController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Admin editing and public delivery of browser tab titles per page
 *              (table `legal_page_titles`). Admin: list + bulk update of texts.
 *              Public: map "area.page_key" => { lang: title } for the Angular
 *              PageTitleStrategy.
 * @refactor-note (2026-09-30b) Area 'admin' (one title for the whole administration,
 *              see 2026-09-30b_legal_page_titles_admin.sql) – listed after web and e-shop.
 */

namespace App\Http\Controllers\Api\Legal;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreLog;
use App\Models\Legal\PageTitle;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * @description Page titles live next to the other site-wide configuration
 *              (SiteConfigurationController) and share its permissions
 *              (core-legal-config-view / core-legal-config-update).
 * @note Pages themselves (rows) are defined by SQL, never by the admin – the
 *       update endpoint only changes `title_i18n` of existing rows.
 */
class PageTitleController extends Controller
{
    use LogsActivity;

    /** @var int Hard limit for one title. Google shows ~60 chars, the rest is cut. */
    private const MAX_LENGTH = 120;

    /**
     * Lists all pages with their titles for the admin (web, e-shop, administration).
     *
     * @return JsonResponse { page_titles: PageTitle[] }
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'page_titles' => $this->orderedRows(),
        ]);
    }

    /**
     * Bulk-updates titles of existing pages. Only languages sent in the request
     * are changed, other languages already stored stay untouched.
     *
     * @param Request $request { titles: [{ id: int, title_i18n: { lang: string } }] }
     * @return JsonResponse { page_titles: PageTitle[] } – the fresh full list.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'titles'                => 'required|array|min:1|max:200',
            'titles.*.id'           => 'required|integer|distinct',
            'titles.*.title_i18n'   => 'present|array',
            'titles.*.title_i18n.*' => 'nullable|string|max:' . self::MAX_LENGTH,
        ]);

        $items = collect($request->input('titles'))->keyBy('id');
        $rows  = PageTitle::whereIn('id', $items->keys())->get()->keyBy('id');

        // Every sent id must exist – otherwise the client works with stale data.
        if ($rows->count() !== $items->count()) {
            return response()->json(['message' => 'Some pages do not exist anymore. Reload the page.'], 422);
        }

        $changed = [];

        DB::transaction(function () use ($rows, $items, &$changed) {
            foreach ($rows as $id => $row) {
                $sanitized = $this->sanitizeTitles($items[$id]['title_i18n'] ?? []);
                $row->title_i18n = array_merge($row->title_i18n ?? [], $sanitized);

                if ($row->isDirty('title_i18n')) {
                    $row->save();
                    $changed[] = $row;
                }
            }
        });

        foreach ($changed as $row) {
            $this->logAction(
                $request,
                CoreLog::class,
                'update',
                'Legal',
                "Updated page title: {$row->area}.{$row->page_key}",
                $row->id,
                'PageTitle'
            );
        }

        return response()->json([
            'page_titles' => $this->orderedRows(),
        ]);
    }

    /**
     * Public map of titles for the Angular PageTitleStrategy.
     * Empty translations are left out, so the frontend can fall back cleanly.
     *
     * @return JsonResponse { titles: { "web.home": { "cz": "...", "en": "..." }, ... } }
     */
    public function publicIndex(): JsonResponse
    {
        $titles = [];

        foreach (PageTitle::all(['area', 'page_key', 'title_i18n']) as $row) {
            $filled = array_filter(
                $row->title_i18n ?? [],
                fn ($value) => is_string($value) && $value !== ''
            );
            $titles["{$row->area}.{$row->page_key}"] = (object) $filled;
        }

        return response()->json(['titles' => (object) $titles]);
    }

    /**
     * Rows ordered for the admin list: web, e-shop, administration, then sort_order.
     *
     * @return \Illuminate\Support\Collection<int, PageTitle>
     */
    private function orderedRows()
    {
        return PageTitle::orderByRaw("FIELD(area, 'web', 'shop', 'admin')")
            ->orderBy('sort_order')
            ->get(['id', 'area', 'page_key', 'route_path', 'title_i18n', 'sort_order']);
    }

    /**
     * Cleans one title map: accepts only language-code keys, strips HTML,
     * collapses whitespace and cuts to MAX_LENGTH. Empty string = "no title in
     * this language" (the frontend then falls back to another language).
     *
     * @param mixed $raw Map { lang: title } from the request.
     * @return array<string, string>
     */
    private function sanitizeTitles($raw): array
    {
        if (!is_array($raw)) {
            return [];
        }

        $clean = [];

        foreach ($raw as $lang => $value) {
            if (!is_string($lang) || !preg_match('/^[a-z]{2,5}(?:[-_][a-z0-9]{2,8})?$/i', $lang)) {
                continue;
            }

            $text = trim(preg_replace('/\s+/u', ' ', strip_tags((string) ($value ?? ''))));
            $clean[strtolower($lang)] = mb_substr($text, 0, self::MAX_LENGTH);
        }

        return $clean;
    }
}