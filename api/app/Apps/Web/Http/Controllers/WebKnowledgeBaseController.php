<?php

/**
 * @file WebKnowledgeBaseController.php
 * @path app/Apps/Web/Http/Controllers/WebKnowledgeBaseController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public knowledge base of the website (/knowledge-base): the introduction (main
 * heading + first text) and the blocks - heading, text, optional sub-blocks (smaller heading +
 * text) and an optional image at the end of the block - every text per language. Admin
 * (web/edit-website, tab Knowledge base): everything is read and saved at once - blocks and
 * sub-blocks missing in the request are deleted (with their image), the order of the request is
 * the order on the website; the image of a saved block is uploaded / removed on its own (see
 * storeImage()). Public: the introduction and the shown blocks.
 * @note The introduction is always the first row of the request and the only one with
 * `is_intro` - it has no sub-blocks, no image and is always shown.
 * @note Texts are plain text (I18nText) - the website shows them as text, never as HTML.
 * @note Image: JPG / PNG / WebP only (no video, no SVG - SVG can carry scripts), at most 5 MB and
 * 8000 px per side (protection against "decompression bomb" images), decoded and stored
 * re-encoded as WebP by WebKbImage (a file that is not a readable image is refused).
 * @dependencies WebKbSection, WebKbItem, WebLog (audit log), I18nText, WebContentLanguages, WebKbImage.
 */

namespace App\Apps\Web\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\Web\Models\WebKbItem;
use App\Apps\Web\Models\WebKbSection;
use App\Apps\Web\Models\WebLog;
use App\Apps\Web\Support\WebContentLanguages;
use App\Apps\Web\Support\WebKbImage;
use App\Support\I18n\I18nText;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class WebKnowledgeBaseController extends Controller
{
    use LogsActivity;

    /** @description Limits of one save (protection against oversized payloads; the introduction counts as a block). */
    private const MAX_SECTIONS = 51;
    private const MAX_ITEMS = 20;

    /** @description Maximum characters per language. */
    private const MAX_HEADING = 150;
    private const MAX_TEXT = 5000;
    private const MAX_ITEM_TITLE = 150;
    private const MAX_ITEM_TEXT = 2000;

    /**
     * @description The introduction and all blocks for the admin (also the hidden ones).
     * @return JsonResponse { data: [{ id, is_intro, is_active, image, heading_i18n, text_i18n,
     *   items: [{ id, title_i18n, text_i18n }] }] } - the introduction first.
     */
    public function index(): JsonResponse
    {
        return $this->respond($this->list(false));
    }

    /**
     * @description Saves the introduction and all blocks: updates the sent ones (by id), creates
     *   the new ones (no id) and deletes the ones that were not sent (with their image); the same
     *   for the sub-blocks of every block. The image is not part of the save.
     * @param Request $request { sections: [{ id?, is_intro, is_active, heading_i18n, text_i18n,
     *   items: [{ id?, title_i18n, text_i18n }] }] } - exactly one introduction, the first row.
     * @return JsonResponse The fresh content (as index()); 422 when the introduction is missing /
     *   not first or an id does not exist any more.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate(array_merge(
            [
                'sections'                => ['required', 'array', 'min:1', 'max:' . self::MAX_SECTIONS],
                'sections.*.id'           => ['nullable', 'integer', 'distinct'],
                'sections.*.is_intro'     => ['required', 'boolean'],
                'sections.*.is_active'    => ['required', 'boolean'],
                'sections.*.items'        => ['present', 'array', 'max:' . self::MAX_ITEMS],
                'sections.*.items.*.id'   => ['nullable', 'integer'],
            ],
            I18nText::rules('sections.*.heading_i18n', self::MAX_HEADING),
            I18nText::rules('sections.*.text_i18n', self::MAX_TEXT),
            I18nText::rules('sections.*.items.*.title_i18n', self::MAX_ITEM_TITLE),
            I18nText::rules('sections.*.items.*.text_i18n', self::MAX_ITEM_TEXT),
        ));

        $sections = array_values($request->input('sections', []));
        $intros = array_keys(array_filter($sections, fn (array $section) => (bool) $section['is_intro']));
        if ($intros !== [0] || $sections[0]['items'] !== []) {
            return response()->json(['message' => 'The introduction must be the first and only introduction, without sub-blocks.'], 422);
        }

        $sectionIds = array_values(array_filter(array_column($sections, 'id'), fn ($id) => $id !== null));
        $itemIds = [];
        foreach ($sections as $section) {
            foreach ($section['items'] as $item) {
                if (($item['id'] ?? null) !== null) {
                    $itemIds[] = (int) $item['id'];
                }
            }
        }

        // Every sent id must exist (once), the introduction stays the introduction and the
        // sub-blocks stay with their block - otherwise the client works with stale data.
        $known = WebKbSection::whereIn('id', $sectionIds)->pluck('is_intro', 'id');
        $stale = $known->count() !== count($sectionIds)
            || collect($sections)->contains(fn (array $s) => ($s['id'] ?? null) !== null && (bool) $known[(int) $s['id']] !== (bool) $s['is_intro'])
            || !$this->itemsKnown($sections, $itemIds);
        if ($stale) {
            return response()->json(['message' => 'The knowledge base was changed in the meantime. Reload the page.'], 422);
        }

        // Only the languages of the web module (a page opened before a language was deleted
        // must not store it again).
        $languages = WebContentLanguages::codes();
        $text = fn (array $data, string $field, int $max, bool $multiline = false) =>
            I18nText::clean($data[$field] ?? [], $max, $multiline, $languages);

        // Images of the deleted blocks - removed once the deletion is committed.
        $orphanImages = WebKbSection::whereNotIn('id', $sectionIds)->whereNotNull('image_path')->pluck('image_path')->all();

        DB::transaction(function () use ($sections, $sectionIds, $itemIds, $text) {
            WebKbItem::whereNotIn('id', $itemIds)->delete();
            WebKbSection::whereNotIn('id', $sectionIds)->delete();

            foreach ($sections as $index => $data) {
                $isIntro = (bool) $data['is_intro'];
                $section = WebKbSection::findOrNew($data['id'] ?? null);
                $section->fill([
                    'is_intro'     => $isIntro,
                    'is_active'    => $isIntro || (bool) $data['is_active'],
                    'heading_i18n' => $text($data, 'heading_i18n', self::MAX_HEADING),
                    'text_i18n'    => $text($data, 'text_i18n', self::MAX_TEXT, true),
                    'sort_order'   => $index,
                ])->save();

                foreach (array_values($data['items']) as $itemIndex => $item) {
                    WebKbItem::findOrNew($item['id'] ?? null)->fill([
                        'section_id' => $section->id,
                        'title_i18n' => $text($item, 'title_i18n', self::MAX_ITEM_TITLE),
                        'text_i18n'  => $text($item, 'text_i18n', self::MAX_ITEM_TEXT, true),
                        'sort_order' => $itemIndex,
                    ])->save();
                }
            }
        });

        foreach ($orphanImages as $path) {
            WebKbImage::deleteFile($path);
        }

        // The texts themselves are not copied into the log (only the count).
        $this->logAction($request, WebLog::class, 'update', 'Web', 'Updated the knowledge base: ' . (count($sections) - 1) . ' blocks', null, 'WebKbSection', ['sections']);

        return $this->respond($this->list(false));
    }

    /**
     * @description Uploads a new image of a saved block (replaces the previous one); the
     *   introduction has none.
     * @note Uploaded at once and not with "Save" - the same reasons as the image of a reference
     *   (WebReferenceController::storeImage()): small checked request, one bad image refuses
     *   nothing else; a new block has to be saved first (it needs its id).
     * @param Request $request Multipart field `image`.
     * @param string $id Block ID.
     * @return JsonResponse 200 { image }; 404 unknown block; 422 invalid file / the introduction.
     */
    public function storeImage(Request $request, string $id): JsonResponse
    {
        $section = $this->target($id);
        if ($section->is_intro) {
            return response()->json(['message' => 'The introduction has no image.'], 422);
        }
        $request->validate([
            'image' => [
                'required', 'file', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp',
                'max:5120', 'dimensions:max_width=8000,max_height=8000',
            ],
        ]);

        try {
            WebKbImage::store($section, $request->file('image'));
        } catch (RuntimeException) {
            return response()->json(['message' => 'The file is not a readable image.'], 422);
        }

        $this->logAction($request, WebLog::class, 'update', 'Web', "Updated the image of knowledge base block #{$section->id}", $section->id, 'WebKbSection');

        return $this->respond(['image' => $section->image_path]);
    }

    /**
     * @description Removes the image of a block.
     * @param Request $request
     * @param string $id Block ID.
     * @return JsonResponse 200 { image: null }; 404 unknown block.
     */
    public function destroyImage(Request $request, string $id): JsonResponse
    {
        $section = $this->target($id);
        WebKbImage::remove($section);
        $this->logAction($request, WebLog::class, 'update', 'Web', "Removed the image of knowledge base block #{$section->id}", $section->id, 'WebKbSection');

        return $this->respond(['image' => null]);
    }

    /**
     * @description The introduction and the shown blocks for the public website (texts per
     *   language, empty languages left out).
     * @return JsonResponse { data: [{ id, intro, heading, text, image, items: [{ title, text }] }] }
     *   - the introduction first.
     */
    public function publicIndex(): JsonResponse
    {
        return $this->respond(array_map(fn (array $section) => [
            'id'      => $section['id'],
            'intro'   => $section['is_intro'],
            'heading' => $section['heading_i18n'],
            'text'    => $section['text_i18n'],
            'image'   => $section['image'],
            'items'   => array_map(fn (array $item) => [
                'title' => $item['title_i18n'],
                'text'  => $item['text_i18n'],
            ], $section['items']),
        ], $this->list(true)));
    }

    /**
     * @description The introduction and the blocks with their sub-blocks in the order of the website.
     * @param bool $activeOnly Only the blocks shown on the website (the introduction always).
     * @return array<int, array>
     */
    private function list(bool $activeOnly): array
    {
        return WebKbSection::with('items')
            ->when($activeOnly, fn ($query) => $query->where(fn ($q) => $q->where('is_active', true)->orWhere('is_intro', true)))
            ->orderByDesc('is_intro')->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn (WebKbSection $section) => [
                'id'           => $section->id,
                'is_intro'     => (bool) $section->is_intro,
                'is_active'    => (bool) $section->is_active,
                'image'        => $section->image_path,
                'heading_i18n' => (object) ($section->heading_i18n ?? []),
                'text_i18n'    => (object) ($section->text_i18n ?? []),
                'items'        => $section->items->map(fn (WebKbItem $item) => [
                    'id'         => $item->id,
                    'title_i18n' => (object) ($item->title_i18n ?? []),
                    'text_i18n'  => (object) ($item->text_i18n ?? []),
                ])->all(),
            ])->all();
    }

    /**
     * @description Every sent sub-block id exists once and belongs to the block it is sent with.
     * @param array $sections Sent blocks.
     * @param int[] $ids Sent sub-block ids.
     * @return bool
     */
    private function itemsKnown(array $sections, array $ids): bool
    {
        if (count($ids) !== count(array_unique($ids))) {
            return false;
        }
        $owners = WebKbItem::whereIn('id', $ids)->pluck('section_id', 'id');
        foreach ($sections as $section) {
            foreach ($section['items'] as $item) {
                $id = $item['id'] ?? null;
                if ($id !== null && (int) ($owners[(int) $id] ?? 0) !== (int) ($section['id'] ?? -1)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @description Block of the request (404 for an unknown or non-numeric ID).
     * @param string $id
     * @return WebKbSection
     */
    private function target(string $id): WebKbSection
    {
        abort_unless(ctype_digit($id), 404);

        return WebKbSection::findOrFail((int) $id);
    }
}
