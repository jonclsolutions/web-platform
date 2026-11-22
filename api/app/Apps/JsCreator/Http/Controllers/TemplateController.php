<?php
/**
 * @file TemplateController.php
 * @path app/Apps/JsCreator/Http/Controllers/TemplateController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description OWN templates of one section (`<section>/templates`, the section comes from the
 *   route): list (search, size, sorting, trash, the sizes in use), detail with the document and
 *   the blocks of its instances, new (empty document), save of the editor (document validated by
 *   DocumentCheck - images, fonts and blocks must be own; version check), thumbnail, copy (also
 *   to another size), delete to the trash, restore, delete for good, empty the trash.
 *   Every query is limited to the signed-in account and the section (another account's template
 *   = 404, also for the sysadmin).
 * @note A save based on an older version (the template saved meanwhile in another tab) is
 *   refused with 409 `version_conflict` - compare-and-set in one UPDATE, so two saves never both
 *   win. The audit log names only the id of a template, never its name.
 * @dependencies TemplateDocument, DocumentCheck, TemplateUsages, WorkspaceQuota, WorkspaceFiles,
 *   LibraryImage, CreatorTemplate, CreatorBlock, TemplateResource, TemplateDetailResource,
 *   AppliesSafeSorting, LogsActivity (JsCreatorLog).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Http\Requests\BulkItemsRequest;
use App\Apps\JsCreator\Http\Requests\DuplicateTemplateRequest;
use App\Apps\JsCreator\Http\Requests\StoreTemplateRequest;
use App\Apps\JsCreator\Http\Requests\TemplateThumbnailRequest;
use App\Apps\JsCreator\Http\Requests\UpdateTemplateRequest;
use App\Apps\JsCreator\Http\Resources\TemplateDetailResource;
use App\Apps\JsCreator\Http\Resources\TemplateResource;
use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\CreatorUsage;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\TemplateUsages;
use App\Apps\JsCreator\Services\WorkspaceQuota;
use App\Apps\JsCreator\Support\DocumentCheck;
use App\Apps\JsCreator\Support\LibraryImage;
use App\Apps\JsCreator\Support\TemplateDocument;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use App\Http\Controllers\Controller;
use App\Traits\AppliesSafeSorting;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class TemplateController extends Controller
{
    use AppliesSafeSorting, LogsActivity;

    /** @description Templates per page of the list. */
    private const PER_PAGE = 48;

    /** @description Audit events of the bulk actions of templates, blocks and sets. */
    public const BULK_EVENTS = ['delete' => 'soft_delete', 'restore' => 'restore', 'destroy' => 'hard_delete'];

    /**
     * @description Page of the own templates of the section (`only_trashed`, `search` in the name,
     *   `size` = `<width>x<height>`, `sort_by` name | updated_at | created_at, `sort_direction`,
     *   `page`); meta `sizes` = the sizes of the templates outside the trash (most used first).
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $query = $this->templates($request);
        if (filter_var($request->query('only_trashed', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->onlyTrashed();
        }
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where('name', 'like', '%' . addcslashes(mb_substr($search, 0, 100), '%_\\') . '%');
        }
        if (preg_match('/^(\d{3,4})x(\d{3,4})$/', (string) $request->query('size', ''), $size)) {
            $query->where('width', (int) $size[1])->where('height', (int) $size[2]);
        }
        $this->applySorting($query, $request, 'updated_at');

        $sizes = $this->templates($request)
            ->selectRaw('width, height, COUNT(*) AS total')->groupBy('width', 'height')
            ->orderByDesc('total')->orderByDesc('width')->get()
            ->map(fn ($row) => ['width' => (int) $row->width, 'height' => (int) $row->height, 'count' => (int) $row->total])->all();

        return $this->respondPaginated($query->paginate(self::PER_PAGE), TemplateResource::class, ['sizes' => $sizes]);
    }

    /**
     * @description An own template outside the trash with its document and the blocks of its
     *   instances (editor, generating).
     * @param Request $request
     * @param string $id Template.
     * @return JsonResponse 200; 404.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        return $this->respond(new TemplateDetailResource(self::withBlocks($this->templates($request)->findOrFail((int) $id))));
    }

    /**
     * @description New template with an empty document (white background, PNG).
     * @param StoreTemplateRequest $request `name`, `width`, `height`.
     * @return JsonResponse 201 the template with its document.
     */
    public function store(StoreTemplateRequest $request): JsonResponse
    {
        $template = CreatorTemplate::create([
            'user_id'        => $request->user()->id,
            'section'        => $this->section($request),
            'name'           => $request->input('name'),
            'width'          => (int) $request->input('width'),
            'height'         => (int) $request->input('height'),
            'schema_version' => TemplateDocument::SCHEMA,
            'document'       => TemplateDocument::empty(),
            'output_format'  => 'png',
            'output_quality' => 90,
            'version'        => 1,
        ]);
        $this->logAction($request, JsCreatorLog::class, 'create', 'Template', "Template #{$template->id} created", $template->id, 'Template');

        return $this->respond(new TemplateDetailResource(self::withBlocks($template->refresh())), 201);
    }

    /**
     * @description Saves the editor: every property and the document. Refused when the template
     *   was saved meanwhile (another tab) or when the document is invalid / uses a file that is
     *   not in the own library / a block that is not an own block of the section.
     * @param UpdateTemplateRequest $request
     * @param string $id Template.
     * @return JsonResponse 200 the template with its document (new version); 404; 409
     *   `version_conflict` with `current_version`; 422 invalid document.
     */
    public function update(UpdateTemplateRequest $request, string $id): JsonResponse
    {
        $template = $this->templates($request)->findOrFail((int) $id);
        $document = $request->document();
        $checked = DocumentCheck::validate($document, $request->user()->id, $template->section, true);

        $saved = DB::transaction(function () use ($request, $template, $document, $checked) {
            $updated = CreatorTemplate::query()->whereKey($template->id)->where('version', (int) $request->input('version'))->update([
                'name'             => $request->input('name'),
                'width'            => (int) $request->input('width'),
                'height'           => (int) $request->input('height'),
                'schema_version'   => TemplateDocument::SCHEMA,
                'document'         => json_encode($document, TemplateDocument::JSON_FLAGS),
                'output_format'    => $request->input('output_format'),
                'output_quality'   => (int) $request->input('output_quality'),
                'caption_template' => $request->input('caption_template'),
                'version'          => DB::raw('version + 1'),
                'updated_at'       => now(),
            ]);
            if ($updated === 1) {
                TemplateUsages::sync($template, $checked->assetIds(), $checked->fontIds(), $checked->blockIds());
            }

            return $updated === 1;
        });

        if (!$saved) {
            return response()->json([
                'message'         => 'The template was saved meanwhile (e.g. in another tab). Load its current state.',
                'error_code'      => 'version_conflict',
                'current_version' => (int) CreatorTemplate::query()->whereKey($template->id)->value('version'),
            ], 409);
        }
        $this->logAction($request, JsCreatorLog::class, 'update', 'Template', "Template #{$template->id} saved", $template->id, 'Template');

        return $this->respond(new TemplateDetailResource(self::withBlocks($template->refresh())));
    }

    /**
     * @description Replaces the thumbnail of an own template (a PNG / WebP drawn by the editor or by
     *   the list after a block changed, re-encoded to WebP of at most 480 px; within the quota).
     *   Does not change the version; the thumbnail is no longer stale.
     * @param TemplateThumbnailRequest $request `thumb`.
     * @param string $id Template.
     * @return JsonResponse 200 { thumb_url }; 404; 422 unreadable image / full quota.
     */
    public function thumbnail(TemplateThumbnailRequest $request, string $id): JsonResponse
    {
        $template = $this->templates($request)->findOrFail((int) $id);
        try {
            $thumb = LibraryImage::thumbnail((string) file_get_contents($request->file('thumb')->getRealPath()));
        } catch (RuntimeException) {
            throw ValidationException::withMessages(['thumb' => 'The thumbnail is not a readable PNG / WebP image.']);
        }
        WorkspaceQuota::ensureRoom($template->user_id, strlen($thumb) - $template->thumb_bytes);

        $old = $template->thumb_path;
        $path = WorkspaceFiles::newPath($template->user_id, 'templates', 'webp');
        WorkspaceFiles::put($path, $thumb);
        try {
            $template->forceFill(['thumb_path' => $path, 'thumb_bytes' => strlen($thumb), 'thumb_stale' => false])->saveQuietly();
        } catch (Throwable $e) {
            WorkspaceFiles::delete([$path]);
            throw $e;
        }
        WorkspaceFiles::delete([$old]);

        return $this->respond(['thumb_url' => WorkspaceFiles::templateThumbUrl($template)]);
    }

    /**
     * @description Copies an own template (document, output, caption pattern, usages) - also to
     *   another size: layers keep their anchors and offsets, so they stay in their corners. The
     *   thumbnail is copied only for the same size (within the quota); a copy without one is
     *   marked `thumb_stale`, so the list of templates draws it.
     * @param DuplicateTemplateRequest $request `name`, optional `width` + `height`.
     * @param string $id Template.
     * @return JsonResponse 201 the copy; 404; 422 full quota.
     */
    public function duplicate(DuplicateTemplateRequest $request, string $id): JsonResponse
    {
        $source = $this->templates($request)->findOrFail((int) $id);
        $width = (int) ($request->input('width') ?? $source->width);
        $height = (int) ($request->input('height') ?? $source->height);

        $thumb = null;
        if ($source->thumb_path !== null && $width === $source->width && $height === $source->height
            && Storage::disk(WorkspaceFiles::DISK)->exists($source->thumb_path)) {
            $thumb = (string) Storage::disk(WorkspaceFiles::DISK)->get($source->thumb_path);
            WorkspaceQuota::ensureRoom($source->user_id, strlen($thumb));
        }

        $path = $thumb !== null ? WorkspaceFiles::newPath($source->user_id, 'templates', 'webp') : null;
        try {
            if ($path !== null) {
                WorkspaceFiles::put($path, $thumb);
            }
            $copy = DB::transaction(function () use ($request, $source, $width, $height, $path, $thumb) {
                $copy = CreatorTemplate::create([
                    'user_id'          => $source->user_id,
                    'section'          => $source->section,
                    'name'             => $request->input('name'),
                    'width'            => $width,
                    'height'           => $height,
                    'schema_version'   => $source->schema_version,
                    'document'         => $source->document,
                    'output_format'    => $source->output_format,
                    'output_quality'   => $source->output_quality,
                    'caption_template' => $source->caption_template,
                    'thumb_path'       => $path,
                    'thumb_bytes'      => $thumb !== null ? strlen($thumb) : 0,
                    // A copy without a thumbnail (another size) is drawn by the list of templates.
                    'thumb_stale'      => $thumb === null || $source->thumb_stale,
                    'version'          => 1,
                ]);
                TemplateUsages::copy($source, $copy);

                return $copy;
            });
        } catch (Throwable $e) {
            WorkspaceFiles::delete([$path]);
            throw $e;
        }
        $this->logAction($request, JsCreatorLog::class, 'create', 'Template', "Template #{$copy->id} copied from #{$source->id}", $copy->id, 'Template');

        return $this->respond(new TemplateDetailResource(self::withBlocks($copy->refresh())), 201);
    }

    /**
     * @description Moves an own template to the trash, or (`force=1`) deletes a template of the
     *   trash for good with its thumbnail and usages.
     * @param Request $request `force`.
     * @param string $id Template.
     * @return JsonResponse 204; 404.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (filter_var($request->query('force', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->templates($request)->onlyTrashed()->findOrFail((int) $id)->deleteWithFiles();
            $this->logAction($request, JsCreatorLog::class, 'hard_delete', 'Template', "Template #{$id} deleted for good", (int) $id, 'Template');
        } else {
            $this->templates($request)->findOrFail((int) $id)->delete();
            $this->logAction($request, JsCreatorLog::class, 'soft_delete', 'Template', "Template #{$id} moved to the trash", (int) $id, 'Template');
        }

        return response()->json(null, 204);
    }

    /**
     * @description Restores a template of the trash.
     * @param Request $request
     * @param string $id Template.
     * @return JsonResponse 200; 404.
     */
    public function restore(Request $request, string $id): JsonResponse
    {
        $template = $this->templates($request)->onlyTrashed()->findOrFail((int) $id);
        $template->restore();
        $this->logAction($request, JsCreatorLog::class, 'restore', 'Template', "Template #{$template->id} restored", $template->id, 'Template');

        return $this->respond(new TemplateResource($template));
    }

    /**
     * @description One action on several own templates (multiselect): `delete` (to the trash),
     *   `restore` / `destroy` (items of the trash, destroy with their thumbnails and usages).
     * @param BulkItemsRequest $request `action`, `ids`.
     * @return JsonResponse { count, skipped: [] }.
     */
    public function bulk(BulkItemsRequest $request): JsonResponse
    {
        $action = (string) $request->input('action');
        $query = $this->templates($request)->whereIn('id', $request->ids());
        $items = ($action === 'delete' ? $query : $query->onlyTrashed())->get();
        $run = fn () => $items->each(fn (CreatorTemplate $template) => match ($action) {
            'delete'  => $template->delete(),
            'restore' => $template->restore(),
            'destroy' => $template->deleteWithFiles(),
        });
        // Files of a deleted item are removed at once, so a destroy does not run in a transaction.
        $action === 'destroy' ? $run() : DB::transaction($run);
        $this->logAction($request, JsCreatorLog::class, self::BULK_EVENTS[$action], 'Template', "Templates in bulk: {$action}. Count: {$items->count()}");

        return $this->respond(['count' => $items->count(), 'skipped' => []]);
    }

    /**
     * @description Deletes every template of the own trash of the section for good.
     * @param Request $request
     * @return JsonResponse 204.
     */
    public function emptyTrash(Request $request): JsonResponse
    {
        $templates = $this->templates($request)->onlyTrashed()->get();
        $templates->each(fn (CreatorTemplate $template) => $template->deleteWithFiles());
        $this->logAction($request, JsCreatorLog::class, 'force_delete_all', 'Template', "Template trash emptied. Count: {$templates->count()}");

        return response()->json(null, 204);
    }

    /**
     * @description Query of the own templates of the section of the route.
     * @param Request $request Request of the signed-in account.
     * @return Builder
     */
    private function templates(Request $request): Builder
    {
        return CreatorTemplate::query()->ownedBy($request->user())->where('section', $this->section($request));
    }

    /**
     * @description Section of the route (route default `section`, one route group per section -
     *   never taken from the URL).
     * @param Request $request
     * @return string
     */
    private function section(Request $request): string
    {
        return (string) $request->route('section');
    }

    /**
     * @description Loads the blocks of the instances of a template (relation `blocks`, used by
     *   TemplateDetailResource) - the own blocks its usages name.
     * @param CreatorTemplate $template Template.
     * @return CreatorTemplate The same template.
     */
    public static function withBlocks(CreatorTemplate $template): CreatorTemplate
    {
        $ids = $template->usages()->where('target_type', CreatorUsage::BLOCK)->pluck('target_id')->all();
        $blocks = $ids === [] ? collect() : CreatorBlock::withTrashed()->ownedBy($template->user_id)->whereIn('id', $ids)->orderBy('id')->get();

        return $template->setRelation('blocks', $blocks);
    }
}
