<?php

/**
 * @file WebReferenceController.php
 * @path app/Apps/Web/Http/Controllers/WebReferenceController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description References (delivered projects) of the public website: the row of the list (name,
 * year, client), the category (free text, e.g. "Audit"), scope, role, description, key features,
 * technology stack, result and an optional image, every text per language. Admin (web/edit-website, tab References): all
 * references are read and saved at once - references / features / stack rows missing in the
 * request are deleted, the order of the request is the order on the website; the image is
 * uploaded / removed on its own (a saved reference only) - see storeImage(). Public: the shown
 * references only.
 * @note Texts are plain text (I18nText) - the website shows them as text, never as HTML.
 * @note Image: JPG / PNG / WebP, at most 5 MB and 8000 px per side (protection against huge
 * "decompression bomb" images); stored re-encoded by WebReferenceImage (WebP, metadata dropped).
 * @dependencies WebReference, WebReferenceFeature, WebReferenceStack, WebLog (audit log),
 *   I18nText, WebContentLanguages, WebReferenceImage.
 */

namespace App\Apps\Web\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\Web\Models\WebLog;
use App\Apps\Web\Models\WebReference;
use App\Apps\Web\Models\WebReferenceFeature;
use App\Apps\Web\Models\WebReferenceStack;
use App\Support\I18n\I18nText;
use App\Apps\Web\Support\WebContentLanguages;
use App\Apps\Web\Support\WebReferenceImage;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class WebReferenceController extends Controller
{
    use LogsActivity;

    /** @description Limits of one save (protection against oversized payloads). */
    private const MAX_REFERENCES = 50;
    private const MAX_FEATURES = 30;
    private const MAX_STACK = 20;

    /** @description Maximum characters (per language for the texts). */
    private const MAX_DURATION = 50;
    private const MAX_CLIENT = 150;
    private const MAX_NAME = 150;
    private const MAX_CATEGORY = 80;
    private const MAX_META = 200;
    private const MAX_DESCRIPTION = 3000;
    private const MAX_RESULT = 1000;
    private const MAX_FEATURE = 300;
    private const MAX_STACK_LABEL = 80;
    private const MAX_STACK_VALUE = 300;

    /**
     * @description All references for the admin (also the hidden ones).
     * @return JsonResponse { data: [{ id, category_i18n, duration, client, is_active, image, name_i18n,
     *   size_i18n, role_i18n, description_i18n, result_i18n, features: [{ id, text_i18n }],
     *   stack: [{ id, label_i18n, value_i18n }] }] }
     */
    public function index(): JsonResponse
    {
        return $this->respond($this->list(false));
    }

    /**
     * @description Saves all references: updates the sent ones (by id), creates the new ones (no
     *   id) and deletes the ones that were not sent (with their image); the same for the features
     *   and the stack rows of every reference. The image is not part of the save.
     * @param Request $request { references: [{ id?, category_i18n, duration, client, is_active,
     *   name_i18n, size_i18n, role_i18n, description_i18n, result_i18n, features: [{ id?,
     *   text_i18n }], stack: [{ id?, label_i18n, value_i18n }] }] }
     * @return JsonResponse The fresh references (as index()); 422 when an id does not exist any more.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate(array_merge(
            [
                'references'              => ['present', 'array', 'max:' . self::MAX_REFERENCES],
                'references.*.id'         => ['nullable', 'integer', 'distinct'],
                'references.*.duration'   => ['nullable', 'string', 'max:' . self::MAX_DURATION],
                'references.*.client'     => ['nullable', 'string', 'max:' . self::MAX_CLIENT],
                'references.*.is_active'  => ['required', 'boolean'],
                'references.*.features'      => ['present', 'array', 'max:' . self::MAX_FEATURES],
                'references.*.features.*.id' => ['nullable', 'integer'],
                'references.*.stack'         => ['present', 'array', 'max:' . self::MAX_STACK],
                'references.*.stack.*.id'    => ['nullable', 'integer'],
            ],
            I18nText::rules('references.*.category_i18n', self::MAX_CATEGORY),
            I18nText::rules('references.*.name_i18n', self::MAX_NAME),
            I18nText::rules('references.*.size_i18n', self::MAX_META),
            I18nText::rules('references.*.role_i18n', self::MAX_META),
            I18nText::rules('references.*.description_i18n', self::MAX_DESCRIPTION),
            I18nText::rules('references.*.result_i18n', self::MAX_RESULT),
            I18nText::rules('references.*.features.*.text_i18n', self::MAX_FEATURE),
            I18nText::rules('references.*.stack.*.label_i18n', self::MAX_STACK_LABEL),
            I18nText::rules('references.*.stack.*.value_i18n', self::MAX_STACK_VALUE),
        ));

        $references = array_values($request->input('references', []));
        $referenceIds = array_values(array_filter(array_column($references, 'id'), fn ($id) => $id !== null));
        $featureIds = $this->childIds($references, 'features');
        $stackIds = $this->childIds($references, 'stack');

        // Every sent id must exist (once) and children stay with their reference - otherwise the
        // client works with stale data.
        if (WebReference::whereIn('id', $referenceIds)->count() !== count($referenceIds)
            || !$this->childrenKnown($references, 'features', $featureIds, WebReferenceFeature::class)
            || !$this->childrenKnown($references, 'stack', $stackIds, WebReferenceStack::class)) {
            return response()->json(['message' => 'The references were changed in the meantime. Reload the page.'], 422);
        }

        // Only the languages of the web module (a page opened before a language was deleted
        // must not store it again).
        $languages = WebContentLanguages::codes();
        $text = fn (array $data, string $field, int $max, bool $multiline = false) =>
            I18nText::clean($data[$field] ?? [], $max, $multiline, $languages);

        // Images of the deleted references - removed once the deletion is committed.
        $orphanImages = WebReference::whereNotIn('id', $referenceIds)->whereNotNull('image_path')->pluck('image_path')->all();

        DB::transaction(function () use ($references, $referenceIds, $featureIds, $stackIds, $text) {
            WebReferenceFeature::whereNotIn('id', $featureIds)->delete();
            WebReferenceStack::whereNotIn('id', $stackIds)->delete();
            WebReference::whereNotIn('id', $referenceIds)->delete();

            foreach ($references as $index => $data) {
                $reference = WebReference::findOrNew($data['id'] ?? null);
                $reference->fill([
                    'category_i18n'    => $text($data, 'category_i18n', self::MAX_CATEGORY),
                    'duration'         => $this->plain($data['duration'] ?? null, self::MAX_DURATION),
                    'client'           => $this->plain($data['client'] ?? null, self::MAX_CLIENT),
                    'is_active'        => (bool) $data['is_active'],
                    'name_i18n'        => $text($data, 'name_i18n', self::MAX_NAME),
                    'size_i18n'        => $text($data, 'size_i18n', self::MAX_META),
                    'role_i18n'        => $text($data, 'role_i18n', self::MAX_META),
                    'description_i18n' => $text($data, 'description_i18n', self::MAX_DESCRIPTION, true),
                    'result_i18n'      => $text($data, 'result_i18n', self::MAX_RESULT, true),
                    'sort_order'       => $index,
                ])->save();

                foreach (array_values($data['features']) as $featureIndex => $feature) {
                    WebReferenceFeature::findOrNew($feature['id'] ?? null)->fill([
                        'reference_id' => $reference->id,
                        'text_i18n'    => $text($feature, 'text_i18n', self::MAX_FEATURE),
                        'sort_order'   => $featureIndex,
                    ])->save();
                }
                foreach (array_values($data['stack']) as $stackIndex => $layer) {
                    WebReferenceStack::findOrNew($layer['id'] ?? null)->fill([
                        'reference_id' => $reference->id,
                        'label_i18n'   => $text($layer, 'label_i18n', self::MAX_STACK_LABEL),
                        'value_i18n'   => $text($layer, 'value_i18n', self::MAX_STACK_VALUE),
                        'sort_order'   => $stackIndex,
                    ])->save();
                }
            }
        });

        foreach ($orphanImages as $path) {
            WebReferenceImage::deleteFile($path);
        }

        // The texts themselves are not copied into the log (only the count).
        $this->logAction($request, WebLog::class, 'update', 'Web', 'Updated the references: ' . count($references) . ' projects', null, 'WebReference', ['references']);

        return $this->respond($this->list(false));
    }

    /**
     * @description Uploads a new image of a saved reference (replaces the previous one).
     * @note Why the image is uploaded at once and not with "Save": the save is one JSON request
     *   with all references (texts only) - a file in it would make every save multipart and up to
     *   MAX_REFERENCES × 5 MB large, and one bad image would refuse all text changes. On its own
     *   the upload is small, checked and processed alone (one 422 = one image) and the editor
     *   shows the stored result at once; a reference deleted with "Save" deletes its file (no
     *   orphans). Its price: a new reference has to be saved first (it needs its id).
     * @param Request $request Multipart field `image`.
     * @param string $id Reference ID.
     * @return JsonResponse 200 { image }; 404 unknown reference; 422 invalid file.
     */
    public function storeImage(Request $request, string $id): JsonResponse
    {
        $reference = $this->target($id);
        $request->validate([
            'image' => [
                'required', 'file', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp',
                'max:5120', 'dimensions:max_width=8000,max_height=8000',
            ],
        ]);

        try {
            WebReferenceImage::store($reference, $request->file('image'));
        } catch (RuntimeException) {
            return response()->json(['message' => 'The file is not a readable image.'], 422);
        }

        $this->logAction($request, WebLog::class, 'update', 'Web', "Updated the image of reference #{$reference->id}", $reference->id, 'WebReference');

        return $this->respond(['image' => $reference->image_path]);
    }

    /**
     * @description Removes the image of a reference.
     * @param Request $request
     * @param string $id Reference ID.
     * @return JsonResponse 200 { image: null }; 404 unknown reference.
     */
    public function destroyImage(Request $request, string $id): JsonResponse
    {
        $reference = $this->target($id);
        WebReferenceImage::remove($reference);
        $this->logAction($request, WebLog::class, 'update', 'Web', "Removed the image of reference #{$reference->id}", $reference->id, 'WebReference');

        return $this->respond(['image' => null]);
    }

    /**
     * @description The shown references for the public website (texts per language, empty
     *   languages left out).
     * @return JsonResponse { data: [{ id, category, duration, client, image, name, size, role,
     *   description, result, features: [text], stack: [{ label, value }] }] }
     */
    public function publicIndex(): JsonResponse
    {
        $references = array_map(fn (array $reference) => [
            'id'          => $reference['id'],
            'category'    => $reference['category_i18n'],
            'duration'    => $reference['duration'],
            'client'      => $reference['client'],
            'image'       => $reference['image'],
            'name'        => $reference['name_i18n'],
            'size'        => $reference['size_i18n'],
            'role'        => $reference['role_i18n'],
            'description' => $reference['description_i18n'],
            'result'      => $reference['result_i18n'],
            'features'    => array_column($reference['features'], 'text_i18n'),
            'stack'       => array_map(fn (array $layer) => [
                'label' => $layer['label_i18n'],
                'value' => $layer['value_i18n'],
            ], $reference['stack']),
        ], $this->list(true));

        return $this->respond($references);
    }

    /**
     * @description References with their features and stack in the order of the website.
     * @param bool $activeOnly Only the references shown on the website.
     * @return array<int, array>
     */
    private function list(bool $activeOnly): array
    {
        return WebReference::with(['features', 'stack'])
            ->when($activeOnly, fn ($query) => $query->where('is_active', true))
            ->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn (WebReference $reference) => [
                'id'               => $reference->id,
                'category_i18n'    => (object) ($reference->category_i18n ?? []),
                'duration'         => $reference->duration,
                'client'           => $reference->client,
                'is_active'        => (bool) $reference->is_active,
                'image'            => $reference->image_path,
                'name_i18n'        => (object) ($reference->name_i18n ?? []),
                'size_i18n'        => (object) ($reference->size_i18n ?? []),
                'role_i18n'        => (object) ($reference->role_i18n ?? []),
                'description_i18n' => (object) ($reference->description_i18n ?? []),
                'result_i18n'      => (object) ($reference->result_i18n ?? []),
                'features'         => $reference->features->map(fn (WebReferenceFeature $feature) => [
                    'id'        => $feature->id,
                    'text_i18n' => (object) ($feature->text_i18n ?? []),
                ])->all(),
                'stack'            => $reference->stack->map(fn (WebReferenceStack $layer) => [
                    'id'         => $layer->id,
                    'label_i18n' => (object) ($layer->label_i18n ?? []),
                    'value_i18n' => (object) ($layer->value_i18n ?? []),
                ])->all(),
            ])->all();
    }

    /**
     * @description Ids of the sent children (features / stack rows) of all references.
     * @param array $references Sent references.
     * @param string $key 'features' | 'stack'.
     * @return int[]
     */
    private function childIds(array $references, string $key): array
    {
        $ids = [];
        foreach ($references as $reference) {
            foreach ($reference[$key] as $child) {
                if (($child['id'] ?? null) !== null) {
                    $ids[] = (int) $child['id'];
                }
            }
        }

        return $ids;
    }

    /**
     * @description Every sent child id exists once and belongs to the reference it is sent with.
     * @param array $references Sent references.
     * @param string $key 'features' | 'stack'.
     * @param int[] $ids childIds() of the key.
     * @param class-string $model Model of the children.
     * @return bool
     */
    private function childrenKnown(array $references, string $key, array $ids, string $model): bool
    {
        if (count($ids) !== count(array_unique($ids))) {
            return false;
        }
        $owners = $model::whereIn('id', $ids)->pluck('reference_id', 'id');
        foreach ($references as $reference) {
            foreach ($reference[$key] as $child) {
                $id = $child['id'] ?? null;
                if ($id !== null && (int) ($owners[(int) $id] ?? 0) !== (int) ($reference['id'] ?? -1)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @description A single-line plain value (year, client): tags removed, whitespace collapsed.
     * @param mixed $value Value of the request.
     * @param int $max Maximum characters.
     * @return string|null null when empty.
     */
    private function plain(mixed $value, int $max): ?string
    {
        $text = trim(mb_substr(trim((string) preg_replace('/\s+/u', ' ', strip_tags(is_string($value) ? $value : ''))), 0, $max));

        return $text === '' ? null : $text;
    }

    /**
     * @description Reference of the request (404 for an unknown or non-numeric ID).
     * @param string $id
     * @return WebReference
     */
    private function target(string $id): WebReference
    {
        abort_unless(ctype_digit($id), 404);

        return WebReference::findOrFail((int) $id);
    }
}
