<?php

/**
 * @file BlockController.php
 * @path app/Apps/JsCreator/Http/Controllers/BlockController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description OWN blocks of one section (`<section>/blocks`, the section comes from the route):
 *   list (search, sorting, trash; each block with the templates that use it), detail with the
 *   document, new (empty, or the layers of "block from the selection"), save of the block
 *   editor (document validated by DocumentCheck - no block instances inside a block; version
 *   check; the templates using the block get a stale thumbnail), thumbnail, copy (also to
 *   another size), delete to the trash, restore, delete for good, empty the trash.
 *   A block used by a template (also one in the trash) cannot be deleted: 409 `in_use` with
 *   those templates. Every query is limited to the signed-in account and the section (another
 *   account's block = 404, also for the sysadmin).
 * @note Changing a block changes every template that uses it (instances draw the current
 *   block); outputs generated before stay as they are. The audit log names only ids.
 * @dependencies DocumentCheck, TemplateDocument, TemplateUsages, WorkspaceQuota, WorkspaceFiles,
 *   LibraryImage, CreatorBlock, CreatorTemplate, BlockResource, BlockDetailResource,
 *   AppliesSafeSorting, LogsActivity (JsCreatorLog).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Http\Requests\BulkItemsRequest;
use App\Apps\JsCreator\Http\Requests\DuplicateTemplateRequest;
use App\Apps\JsCreator\Http\Requests\StoreBlockRequest;
use App\Apps\JsCreator\Http\Requests\TemplateThumbnailRequest;
use App\Apps\JsCreator\Http\Requests\UpdateBlockRequest;
use App\Apps\JsCreator\Http\Resources\BlockDetailResource;
use App\Apps\JsCreator\Http\Resources\BlockResource;
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

class BlockController extends Controller
{
    use AppliesSafeSorting, LogsActivity;

    /** @description Blocks per page of the list. */
    private const PER_PAGE = 48;

    /**
     * @description Page of the own blocks of the section (`only_trashed`, `search` in the name,
     *   `sort_by` name | updated_at | created_at, `sort_direction`, `page`), each with `used_by`.
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $query = $this->blocks($request);
        if (filter_var($request->query('only_trashed', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->onlyTrashed();
        }
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where('name', 'like', '%' . addcslashes(mb_substr($search, 0, 100), '%_\\') . '%');
        }
        $this->applySorting($query, $request, 'updated_at');

        $page = $query->paginate(self::PER_PAGE);
        $usedBy = TemplateUsages::usedBy(CreatorUsage::BLOCK, collect($page->items())->pluck('id')->all());
        foreach ($page->items() as $block) {
            $block->setRelation('usedBy', collect($usedBy[$block->id] ?? []));
        }

        return $this->respondPaginated($page, BlockResource::class);
    }

    /**
     * @description An own block outside the trash with its document and the templates using it.
     * @param Request $request
     * @param string $id Block.
     * @return JsonResponse 200; 404.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        return $this->respond(new BlockDetailResource($this->withUsedBy($this->blocks($request)->findOrFail((int) $id))));
    }

    /**
     * @description New block: empty (transparent background), or with the document sent by "block
     *   from the selection" (validated, no instances).
     * @param StoreBlockRequest $request `name`, `width`, `height`, optional `document`.
     * @return JsonResponse 201 the block with its document; 422 invalid document.
     */
    public function store(StoreBlockRequest $request): JsonResponse
    {
        $section = $this->section($request);
        $document = $request->document();
        $checked = $document !== null ? DocumentCheck::validate($document, $request->user()->id, $section, false) : null;

        $block = DB::transaction(function () use ($request, $section, $document, $checked) {
            $block = CreatorBlock::create([
                'user_id'        => $request->user()->id,
                'section'        => $section,
                'name'           => $request->input('name'),
                'width'          => (int) $request->input('width'),
                'height'         => (int) $request->input('height'),
                'schema_version' => TemplateDocument::SCHEMA,
                'document'       => $document ?? TemplateDocument::empty(true),
                'version'        => 1,
            ]);
            if ($checked !== null) {
                TemplateUsages::sync($block, $checked->assetIds(), $checked->fontIds());
            }

            return $block;
        });
        $this->logAction($request, JsCreatorLog::class, 'create', 'Block', "Block #{$block->id} created", $block->id, 'Block');

        return $this->respond(new BlockDetailResource($this->withUsedBy($block->refresh())), 201);
    }

    /**
     * @description Saves the block editor: name, size and document. Refused when the block was
     *   saved meanwhile (another tab) or when the document is invalid / uses what is not own /
     *   contains a block instance. The templates using the block get a stale thumbnail.
     * @param UpdateBlockRequest $request
     * @param string $id Block.
     * @return JsonResponse 200 the block with its document and `used_by`; 404; 409
     *   `version_conflict` with `current_version`; 422 invalid document.
     */
    public function update(UpdateBlockRequest $request, string $id): JsonResponse
    {
        $block = $this->blocks($request)->findOrFail((int) $id);
        $document = $request->document();
        $checked = DocumentCheck::validate($document, $request->user()->id, $block->section, false);

        $saved = DB::transaction(function () use ($request, $block, $document, $checked) {
            $updated = CreatorBlock::query()->whereKey($block->id)->where('version', (int) $request->input('version'))->update([
                'name'           => $request->input('name'),
                'width'          => (int) $request->input('width'),
                'height'         => (int) $request->input('height'),
                'schema_version' => TemplateDocument::SCHEMA,
                'document'       => json_encode($document, TemplateDocument::JSON_FLAGS),
                'version'        => DB::raw('version + 1'),
                'updated_at'     => now(),
            ]);
            if ($updated === 1) {
                TemplateUsages::sync($block, $checked->assetIds(), $checked->fontIds());
                CreatorTemplate::withTrashed()->ownedBy($block->user_id)->whereIn('id', TemplateUsages::templatesOfBlock($block->id))
                    ->update(['thumb_stale' => true]);
            }

            return $updated === 1;
        });

        if (!$saved) {
            return response()->json([
                'message'         => 'The block was saved meanwhile (e.g. in another tab). Load its current state.',
                'error_code'      => 'version_conflict',
                'current_version' => (int) CreatorBlock::query()->whereKey($block->id)->value('version'),
            ], 409);
        }
        $this->logAction($request, JsCreatorLog::class, 'update', 'Block', "Block #{$block->id} saved", $block->id, 'Block');

        return $this->respond(new BlockDetailResource($this->withUsedBy($block->refresh())));
    }

    /**
     * @description Replaces the thumbnail of an own block (PNG / WebP drawn by the editor,
     *   re-encoded to WebP of at most 480 px; within the quota). Does not change the version.
     * @param TemplateThumbnailRequest $request `thumb`.
     * @param string $id Block.
     * @return JsonResponse 200 { thumb_url }; 404; 422 unreadable image / full quota.
     */
    public function thumbnail(TemplateThumbnailRequest $request, string $id): JsonResponse
    {
        $block = $this->blocks($request)->findOrFail((int) $id);
        try {
            $thumb = LibraryImage::thumbnail((string) file_get_contents($request->file('thumb')->getRealPath()));
        } catch (RuntimeException) {
            throw ValidationException::withMessages(['thumb' => 'The thumbnail is not a readable PNG / WebP image.']);
        }
        WorkspaceQuota::ensureRoom($block->user_id, strlen($thumb) - $block->thumb_bytes);

        $old = $block->thumb_path;
        $path = WorkspaceFiles::newPath($block->user_id, 'blocks', 'webp');
        WorkspaceFiles::put($path, $thumb);
        try {
            $block->forceFill(['thumb_path' => $path, 'thumb_bytes' => strlen($thumb), 'thumb_stale' => false])->saveQuietly();
        } catch (Throwable $e) {
            WorkspaceFiles::delete([$path]);
            throw $e;
        }
        WorkspaceFiles::delete([$old]);

        return $this->respond(['thumb_url' => WorkspaceFiles::blockThumbUrl($block)]);
    }

    /**
     * @description Copies an own block (document, usages) - also to another size: layers keep
     *   their anchors and offsets. The thumbnail is copied only for the same size (within the quota).
     * @param DuplicateTemplateRequest $request `name`, optional `width` + `height`.
     * @param string $id Block.
     * @return JsonResponse 201 the copy; 404; 422 full quota.
     */
    public function duplicate(DuplicateTemplateRequest $request, string $id): JsonResponse
    {
        $source = $this->blocks($request)->findOrFail((int) $id);
        $width = (int) ($request->input('width') ?? $source->width);
        $height = (int) ($request->input('height') ?? $source->height);

        $thumb = null;
        if ($source->thumb_path !== null && $width === $source->width && $height === $source->height
            && Storage::disk(WorkspaceFiles::DISK)->exists($source->thumb_path)) {
            $thumb = (string) Storage::disk(WorkspaceFiles::DISK)->get($source->thumb_path);
            WorkspaceQuota::ensureRoom($source->user_id, strlen($thumb));
        }

        $path = $thumb !== null ? WorkspaceFiles::newPath($source->user_id, 'blocks', 'webp') : null;
        try {
            if ($path !== null) {
                WorkspaceFiles::put($path, $thumb);
            }
            $copy = DB::transaction(function () use ($request, $source, $width, $height, $path, $thumb) {
                $copy = CreatorBlock::create([
                    'user_id'        => $source->user_id,
                    'section'        => $source->section,
                    'name'           => $request->input('name'),
                    'width'          => $width,
                    'height'         => $height,
                    'schema_version' => $source->schema_version,
                    'document'       => $source->document,
                    'thumb_path'     => $path,
                    'thumb_bytes'    => $thumb !== null ? strlen($thumb) : 0,
                    'version'        => 1,
                ]);
                TemplateUsages::copy($source, $copy);

                return $copy;
            });
        } catch (Throwable $e) {
            WorkspaceFiles::delete([$path]);
            throw $e;
        }
        $this->logAction($request, JsCreatorLog::class, 'create', 'Block', "Block #{$copy->id} copied from #{$source->id}", $copy->id, 'Block');

        return $this->respond(new BlockDetailResource($this->withUsedBy($copy->refresh())), 201);
    }

    /**
     * @description Moves an own block to the trash, or (`force=1`) deletes a block of the trash for
     *   good with its thumbnail and usages. A block used by a template stays.
     * @param Request $request `force`.
     * @param string $id Block.
     * @return JsonResponse 204; 404; 409 `in_use` (with the templates).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (filter_var($request->query('force', false), FILTER_VALIDATE_BOOLEAN)) {
            $block = $this->blocks($request)->onlyTrashed()->findOrFail((int) $id);
            TemplateUsages::ensureUnused(CreatorUsage::BLOCK, $block->id);
            $block->deleteWithFiles();
            $this->logAction($request, JsCreatorLog::class, 'hard_delete', 'Block', "Block #{$id} deleted for good", (int) $id, 'Block');
        } else {
            $block = $this->blocks($request)->findOrFail((int) $id);
            TemplateUsages::ensureUnused(CreatorUsage::BLOCK, $block->id);
            $block->delete();
            $this->logAction($request, JsCreatorLog::class, 'soft_delete', 'Block', "Block #{$id} moved to the trash", (int) $id, 'Block');
        }

        return response()->json(null, 204);
    }

    /**
     * @description Restores a block of the trash.
     * @param Request $request
     * @param string $id Block.
     * @return JsonResponse 200; 404.
     */
    public function restore(Request $request, string $id): JsonResponse
    {
        $block = $this->blocks($request)->onlyTrashed()->findOrFail((int) $id);
        $block->restore();
        $this->logAction($request, JsCreatorLog::class, 'restore', 'Block', "Block #{$block->id} restored", $block->id, 'Block');

        return $this->respond(new BlockResource($block));
    }

    /**
     * @description One action on several own blocks (multiselect): `delete` (to the trash),
     *   `restore` / `destroy` (items of the trash for good). A block used by a template is
     *   skipped (neither to the trash nor deleted) and named in `skipped` with its templates.
     * @param BulkItemsRequest $request `action`, `ids`.
     * @return JsonResponse { count, skipped: [{ id, name, used_by }] }.
     */
    public function bulk(BulkItemsRequest $request): JsonResponse
    {
        $action = (string) $request->input('action');
        $query = $this->blocks($request)->whereIn('id', $request->ids());
        $items = ($action === 'delete' ? $query : $query->onlyTrashed())->get();
        $used = $action === 'restore' ? [] : TemplateUsages::usedBy(CreatorUsage::BLOCK, $items->pluck('id')->all());
        [$skipped, $done] = $items->partition(fn (CreatorBlock $block) => isset($used[$block->id]));
        $run = fn () => $done->each(fn (CreatorBlock $block) => match ($action) {
            'delete'  => $block->delete(),
            'restore' => $block->restore(),
            'destroy' => $block->deleteWithFiles(),
        });
        // Files of a deleted item are removed at once, so a destroy does not run in a transaction.
        $action === 'destroy' ? $run() : DB::transaction($run);
        $this->logAction($request, JsCreatorLog::class, TemplateController::BULK_EVENTS[$action], 'Block', "Blocks in bulk: {$action}. Count: {$done->count()}");

        return $this->respond([
            'count'   => $done->count(),
            'skipped' => $skipped->map(fn (CreatorBlock $block) => ['id' => $block->id, 'name' => $block->name, 'used_by' => $used[$block->id]])->values()->all(),
        ]);
    }

    /**
     * @description Deletes every unused block of the own trash of the section for good (a block in
     *   the trash is never used - templates refuse blocks of the trash).
     * @param Request $request
     * @return JsonResponse 204.
     */
    public function emptyTrash(Request $request): JsonResponse
    {
        $blocks = $this->blocks($request)->onlyTrashed()->get();
        $used = TemplateUsages::usedBy(CreatorUsage::BLOCK, $blocks->pluck('id')->all());
        $deleted = $blocks->reject(fn (CreatorBlock $block) => isset($used[$block->id]));
        $deleted->each(fn (CreatorBlock $block) => $block->deleteWithFiles());
        $this->logAction($request, JsCreatorLog::class, 'force_delete_all', 'Block', "Block trash emptied. Count: {$deleted->count()}");

        return response()->json(null, 204);
    }

    /**
     * @description Query of the own blocks of the section of the route.
     * @param Request $request Request of the signed-in account.
     * @return Builder
     */
    private function blocks(Request $request): Builder
    {
        return CreatorBlock::query()->ownedBy($request->user())->where('section', $this->section($request));
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
     * @description Loads the templates that use a block (relation `usedBy` of BlockResource).
     * @param CreatorBlock $block Block.
     * @return CreatorBlock The same block.
     */
    private function withUsedBy(CreatorBlock $block): CreatorBlock
    {
        return $block->setRelation('usedBy', collect(TemplateUsages::usedBy(CreatorUsage::BLOCK, [$block->id])[$block->id] ?? []));
    }
}
