<?php

/**
 * @file WebFaqController.php
 * @path app/Apps/Web/Http/Controllers/WebFaqController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description FAQ of the public website: categories (the tabs) with their questions and answers,
 * every text per language. Admin (web/edit-website, tab FAQ): the whole FAQ is read and saved at
 * once - categories / questions missing in the request are deleted, the order of the request is
 * the order on the website. Public: the same tree without the ids of the admin.
 * @note Texts are plain text (I18nText) - the website shows them as text, never as HTML.
 * @dependencies WebFaqCategory, WebFaqItem, WebLog (audit log), I18nText.
 */

namespace App\Apps\Web\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\Web\Models\WebFaqCategory;
use App\Apps\Web\Models\WebFaqItem;
use App\Apps\Web\Models\WebLog;
use App\Support\I18n\I18nText;
use App\Apps\Web\Support\WebContentLanguages;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WebFaqController extends Controller
{
    use LogsActivity;

    /** @description Limits of one save (protection against oversized payloads). */
    private const MAX_CATEGORIES = 30;
    private const MAX_ITEMS_PER_CATEGORY = 100;

    /** @description Maximum characters per language. */
    private const MAX_NAME = 120;
    private const MAX_QUESTION = 500;
    private const MAX_ANSWER = 5000;

    /**
     * @description The whole FAQ for the admin.
     * @return JsonResponse { data: [{ id, name_i18n, items: [{ id, question_i18n, answer_i18n }] }] }
     */
    public function index(): JsonResponse
    {
        return $this->respond($this->tree());
    }

    /**
     * @description Saves the whole FAQ: updates the sent categories / questions (by id), creates
     *   the new ones (no id) and deletes the ones that were not sent. A question may move to
     *   another category.
     * @param Request $request { categories: [{ id?, name_i18n, items: [{ id?, question_i18n, answer_i18n }] }] }
     * @return JsonResponse The fresh FAQ (as index()); 422 when an id does not exist any more.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate(array_merge(
            [
                'categories'              => ['present', 'array', 'max:' . self::MAX_CATEGORIES],
                'categories.*.id'         => ['nullable', 'integer', 'distinct'],
                'categories.*.items'      => ['present', 'array', 'max:' . self::MAX_ITEMS_PER_CATEGORY],
                'categories.*.items.*.id' => ['nullable', 'integer'],
            ],
            I18nText::rules('categories.*.name_i18n', self::MAX_NAME),
            I18nText::rules('categories.*.items.*.question_i18n', self::MAX_QUESTION),
            I18nText::rules('categories.*.items.*.answer_i18n', self::MAX_ANSWER),
        ));

        $categories = array_values($request->input('categories', []));
        $categoryIds = array_values(array_filter(array_column($categories, 'id'), fn ($id) => $id !== null));
        $itemIds = [];
        foreach ($categories as $category) {
            foreach ($category['items'] as $item) {
                if (($item['id'] ?? null) !== null) {
                    $itemIds[] = (int) $item['id'];
                }
            }
        }

        // Every sent id must exist (once) - otherwise the client works with stale data.
        if (count($itemIds) !== count(array_unique($itemIds))
            || WebFaqCategory::whereIn('id', $categoryIds)->count() !== count($categoryIds)
            || WebFaqItem::whereIn('id', $itemIds)->count() !== count($itemIds)) {
            return response()->json(['message' => 'The FAQ was changed in the meantime. Reload the page.'], 422);
        }

        // Only the languages of the web module (a page opened before a language was deleted
        // must not store it again).
        $languages = WebContentLanguages::codes();

        DB::transaction(function () use ($languages, $categories, $categoryIds, $itemIds) {
            WebFaqItem::whereNotIn('id', $itemIds)->delete();
            $keptCategoryIds = $categoryIds;

            foreach ($categories as $categoryIndex => $data) {
                $category = WebFaqCategory::findOrNew($data['id'] ?? null);
                $category->fill([
                    'name_i18n'  => I18nText::clean($data['name_i18n'] ?? [], self::MAX_NAME, false, $languages),
                    'sort_order' => $categoryIndex,
                ])->save();

                foreach (array_values($data['items']) as $itemIndex => $itemData) {
                    WebFaqItem::findOrNew($itemData['id'] ?? null)->fill([
                        'category_id'   => $category->id,
                        'question_i18n' => I18nText::clean($itemData['question_i18n'] ?? [], self::MAX_QUESTION, false, $languages),
                        'answer_i18n'   => I18nText::clean($itemData['answer_i18n'] ?? [], self::MAX_ANSWER, true, $languages),
                        'sort_order'    => $itemIndex,
                    ])->save();
                }
                $keptCategoryIds[] = $category->id;
            }

            // Last: a question moved out of a deleted category is already in its new one.
            WebFaqCategory::whereNotIn('id', $keptCategoryIds)->delete();
        });

        $questions = array_sum(array_map(fn ($category) => count($category['items']), $categories));
        // The texts themselves are not copied into the log (only the counts).
        $this->logAction($request, WebLog::class, 'update', 'Web', 'Updated the FAQ: ' . count($categories) . " categories, {$questions} questions", null, 'WebFaq', ['categories']);

        return $this->respond($this->tree());
    }

    /**
     * @description The FAQ for the public website (texts per language, empty languages left out).
     * @return JsonResponse { data: [{ id, name, items: [{ id, question, answer }] }] }
     */
    public function publicIndex(): JsonResponse
    {
        $tree = array_map(fn (array $category) => [
            'id'    => $category['id'],
            'name'  => (object) $category['name_i18n'],
            'items' => array_map(fn (array $item) => [
                'id'       => $item['id'],
                'question' => (object) $item['question_i18n'],
                'answer'   => (object) $item['answer_i18n'],
            ], $category['items']),
        ], $this->tree());

        return $this->respond($tree);
    }

    /**
     * @description Categories with their questions in the order of the website.
     * @return array<int, array>
     */
    private function tree(): array
    {
        return WebFaqCategory::with('items')->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn (WebFaqCategory $category) => [
                'id'        => $category->id,
                'name_i18n' => (object) ($category->name_i18n ?? []),
                'items'     => $category->items->map(fn (WebFaqItem $item) => [
                    'id'            => $item->id,
                    'question_i18n' => (object) ($item->question_i18n ?? []),
                    'answer_i18n'   => (object) ($item->answer_i18n ?? []),
                ])->all(),
            ])->all();
    }
}
