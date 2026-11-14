<?php
/**
 * @file PageTitleController.php
 * @path app/Http/Controllers/Api/Legal/PageTitleController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Admin editing and public delivery of browser tab titles per page
 *              (table `legal_page_titles`). Admin: list + bulk update of the texts of
 *              ONE area, each managed by its own module (route default `area`):
 *              - web   - web/page-titles   (web/edit-website, web-edit-website-view / -update),
 *              - shop  - shop/page-titles  (shop/edit-eshop, shop-edit-eshop-view / -update),
 *              - admin - legal/config/page-titles (core/settings, core-legal-config-view / -update).
 *              Removing a module from a branched application therefore removes its page
 *              titles with it. Public: map "area.page_key" => { lang: title } for the
 *              Angular PageTitleStrategy.
 * @dependencies PageTitle; AppRegistry::logModel() (audit log of the area's application,
 *   CoreLog for the admin area).
 */

namespace App\Http\Controllers\Api\Legal;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreLog;
use App\Models\Legal\PageTitle;
use App\Support\Apps\AppRegistry;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;


/**
 * @description Page titles of one area per route; the permission is checked by the route
 *              middleware of the module (see the file header).
 * @note Pages themselves (rows) are defined by SQL, never by the admin – the
 *       update endpoint only changes `title_i18n` of existing rows of its area.
 */
class PageTitleController extends Controller
{
    use LogsActivity;

    /** @var int Hard limit for one title. Google shows ~60 chars, the rest is cut. */
    private const MAX_LENGTH = 120;


    /**
     * Lists the pages of one area with their titles.
     *
     * @param string $area Route default: 'web', 'shop' or 'admin'.
     * @return JsonResponse { data: PageTitle[] }
     */
    public function index(string $area): JsonResponse
    {
        return $this->respond($this->orderedRows($area));
    }

    /**
     * Bulk-updates titles of existing pages. Only languages sent in the request
     * are changed, other languages already stored stay untouched.
     *
     * @param Request $request { titles: [{ id: int, title_i18n: { lang: string } }] }
     * @param string $area Route default: 'web', 'shop' or 'admin' - only its rows can change.
     * @return JsonResponse { data: PageTitle[] } – the fresh list of the area.
     */
    public function update(Request $request, string $area): JsonResponse
    {
        $request->validate([
            'titles'                => 'required|array|min:1|max:200',
            'titles.*.id'           => 'required|integer|distinct',
            'titles.*.title_i18n'   => 'present|array',
            'titles.*.title_i18n.*' => 'nullable|string|max:' . self::MAX_LENGTH,
        ]);

        $items = collect($request->input('titles'))->keyBy('id');
        $rows  = PageTitle::where('area', $area)->whereIn('id', $items->keys())->get()->keyBy('id');

        // Every sent id must exist in this area – otherwise the client works with stale data
        // (or tries to change the titles of another module).
        if ($rows->count() !== $items->count()) {
            return response()->json(['message' => 'Some pages do not exist anymore. Reload the page.'], 422);
        }

        $changed = [];

        DB::transaction(function () use ($rows, $items, &$changed) {
            foreach ($rows as $id => $row) {
                $sanitized = $this->sanitizeTitles($items[$id]['title_i18n'] ?? []);
                $current   = $row->title_i18n ?? [];
                $merged    = array_merge($current, $sanitized);

                if ($merged !== $current) {
                    $row->title_i18n = $merged;
                    $row->save();
                    $changed[] = $row;
                }
            }
        });

        foreach ($changed as $row) {
            $this->logAction(
                $request,
                AppRegistry::logModel($area) ?? CoreLog::class,
                'update',
                'Legal',
                "Updated page title: {$row->area}.{$row->page_key}",
                $row->id,
                'PageTitle'
            );
        }

        return $this->respond($this->orderedRows($area));
    }

    /**
     * Public map of titles for the Angular PageTitleStrategy.
     * Empty translations are left out, so the frontend can fall back cleanly.
     *
     * @return JsonResponse { data: { "web.home": { "cz": "...", "en": "..." }, ... } }
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

        return $this->respond((object) $titles);
    }

    /**
     * Rows of one area ordered for the admin list (sort_order).
     *
     * @param string $area 'web', 'shop' or 'admin'.
     * @return \Illuminate\Support\Collection<int, PageTitle>
     */
    private function orderedRows(string $area)
    {
        return PageTitle::where('area', $area)
            ->orderBy('sort_order')
            ->orderBy('id')
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
    private function sanitizeTitles(array $raw): array
    {
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