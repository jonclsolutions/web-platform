<?php
/**
 * @file AssetController.php
 * @path app/Apps/JsCreator/Http/Controllers/AssetController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Images of the OWN library: list (search, sorting, trash), upload (re-encoded by
 *   LibraryImage, within the quota), rename, delete to the trash, restore, delete for good, empty
 *   the trash. Every query is limited to the signed-in account (another account's image = 404,
 *   also for the sysadmin).
 * @note The audit log names only the id of an image, never its name. An image used by a template
 *   (also one in the trash) cannot be deleted - 409 `in_use` with the templates (TemplateUsages);
 *   the list sends them as `used_by` of every image.
 * @dependencies LibraryImage, WorkspaceFiles, WorkspaceQuota, TemplateUsages, CreatorAsset,
 *   AssetResource, AppliesSafeSorting, LogsActivity (JsCreatorLog).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Http\Requests\StoreAssetsRequest;
use App\Apps\JsCreator\Http\Requests\UpdateAssetRequest;
use App\Apps\JsCreator\Http\Resources\AssetResource;
use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorUsage;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\TemplateUsages;
use App\Apps\JsCreator\Services\WorkspaceQuota;
use App\Apps\JsCreator\Support\LibraryImage;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use App\Http\Controllers\Controller;
use App\Traits\AppliesSafeSorting;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class AssetController extends Controller
{
    use AppliesSafeSorting, LogsActivity;

    /** @description Images per page of the list. */
    private const PER_PAGE = 48;

    /**
     * @description Page of the own images (`only_trashed`, `search` in the name, `ids` = only these
     *   images (comma separated, at most 200 - the images a template uses), `sort_by`,
     *   `sort_direction`, `page`), each with the templates that use it (`used_by`).
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $query = CreatorAsset::query()->ownedBy($request->user());
        if (filter_var($request->query('only_trashed', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->onlyTrashed();
        }
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where('name', 'like', '%' . addcslashes(mb_substr($search, 0, 100), '%_\\') . '%');
        }
        $ids = $request->query('ids');
        if (is_string($ids) && $ids !== '') {
            $query->whereIn('id', array_slice(array_map('intval', explode(',', $ids)), 0, 200));
        }
        $this->applySorting($query, $request, 'created_at');
        $page = $query->paginate(is_string($ids) && $ids !== '' ? 200 : self::PER_PAGE);
        $usedBy = TemplateUsages::usedBy(CreatorUsage::ASSET, collect($page->items())->pluck('id')->all());
        foreach ($page->items() as $asset) {
            $asset->setRelation('usedBy', collect($usedBy[$asset->id] ?? []));
        }

        return $this->respondPaginated($page, AssetResource::class);
    }

    /**
     * @description Uploads images to the library: all files are processed first, the quota is
     *   checked for their total size, then they are stored together.
     * @param StoreAssetsRequest $request `files[]`.
     * @return JsonResponse 201 the new images; 422 unreadable / too large image or full quota.
     */
    public function store(StoreAssetsRequest $request): JsonResponse
    {
        $userId = $request->user()->id;
        $processed = [];
        foreach ($request->file('files') as $index => $file) {
            try {
                $processed[] = ['name' => $this->displayName($file)] + LibraryImage::process((string) file_get_contents($file->getRealPath()));
            } catch (RuntimeException $e) {
                throw ValidationException::withMessages(["files.{$index}" => $e->getMessage() === 'too_large'
                    ? 'The image has too many pixels (at most ' . (LibraryImage::MAX_PIXELS / 1_000_000) . ' megapixels).'
                    : 'The file is not a readable image.']);
            }
        }
        WorkspaceQuota::ensureRoom($userId, array_sum(array_map(fn (array $p) => strlen($p['image']) + strlen($p['thumb']), $processed)));

        $stored = [];
        try {
            $assets = DB::transaction(function () use ($processed, $userId, &$stored) {
                return array_map(function (array $p) use ($userId, &$stored) {
                    $path = WorkspaceFiles::newPath($userId, 'library', $p['extension']);
                    $thumb = WorkspaceFiles::newPath($userId, 'thumbs', 'webp');
                    WorkspaceFiles::put($path, $p['image']);
                    $stored[] = $path;
                    WorkspaceFiles::put($thumb, $p['thumb']);
                    $stored[] = $thumb;

                    return CreatorAsset::create([
                        'user_id' => $userId, 'name' => $p['name'], 'path' => $path, 'thumb_path' => $thumb, 'mime' => $p['mime'],
                        'width' => $p['width'], 'height' => $p['height'], 'size_bytes' => strlen($p['image']) + strlen($p['thumb']),
                    ]);
                }, $processed);
            });
        } catch (Throwable $e) {
            WorkspaceFiles::delete($stored);
            throw $e;
        }

        foreach ($assets as $asset) {
            $this->logAction($request, JsCreatorLog::class, 'create', 'Asset', "Library image #{$asset->id} uploaded", $asset->id, 'Asset', ['files']);
        }

        return $this->respond(AssetResource::collection($assets), 201);
    }

    /**
     * @description Renames an own image.
     * @param UpdateAssetRequest $request `name`.
     * @param string $id Image.
     * @return JsonResponse 200; 404.
     */
    public function update(UpdateAssetRequest $request, string $id): JsonResponse
    {
        $asset = CreatorAsset::query()->ownedBy($request->user())->findOrFail((int) $id);
        $asset->update(['name' => $request->input('name')]);
        $this->logAction($request, JsCreatorLog::class, 'update', 'Asset', "Library image #{$asset->id} renamed", $asset->id, 'Asset');

        return $this->respond(new AssetResource($asset));
    }

    /**
     * @description Moves an own image to the trash, or (`force=1`) deletes an image of the trash
     *   for good with its files. A used image stays.
     * @param Request $request `force`.
     * @param string $id Image.
     * @return JsonResponse 204; 404; 409 `in_use` (used by a template).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (filter_var($request->query('force', false), FILTER_VALIDATE_BOOLEAN)) {
            $asset = CreatorAsset::onlyTrashed()->ownedBy($request->user())->findOrFail((int) $id);
            TemplateUsages::ensureUnused(CreatorUsage::ASSET, $asset->id);
            $asset->deleteWithFiles();
            $this->logAction($request, JsCreatorLog::class, 'hard_delete', 'Asset', "Library image #{$id} deleted for good", (int) $id, 'Asset');
        } else {
            $asset = CreatorAsset::query()->ownedBy($request->user())->findOrFail((int) $id);
            TemplateUsages::ensureUnused(CreatorUsage::ASSET, $asset->id);
            $asset->delete();
            $this->logAction($request, JsCreatorLog::class, 'soft_delete', 'Asset', "Library image #{$id} moved to the trash", (int) $id, 'Asset');
        }

        return response()->json(null, 204);
    }

    /**
     * @description Restores an image of the trash.
     * @param Request $request
     * @param string $id Image.
     * @return JsonResponse 200; 404.
     */
    public function restore(Request $request, string $id): JsonResponse
    {
        $asset = CreatorAsset::onlyTrashed()->ownedBy($request->user())->findOrFail((int) $id);
        $asset->restore();
        $this->logAction($request, JsCreatorLog::class, 'restore', 'Asset', "Library image #{$asset->id} restored", $asset->id, 'Asset');

        return $this->respond(new AssetResource($asset));
    }

    /**
     * @description Deletes every image of the own trash for good.
     * @param Request $request
     * @return JsonResponse 204.
     */
    public function emptyTrash(Request $request): JsonResponse
    {
        $assets = CreatorAsset::onlyTrashed()->ownedBy($request->user())->get();
        $assets->each(fn (CreatorAsset $asset) => $asset->deleteWithFiles());
        $this->logAction($request, JsCreatorLog::class, 'force_delete_all', 'Asset', "Library image trash emptied. Count: {$assets->count()}");

        return response()->json(null, 204);
    }


    /**
     * @description Name of a new image: the file name without its extension and control
     *   characters (at most 150 characters; "image" when nothing is left).
     * @param UploadedFile $file Upload.
     * @return string
     */
    private function displayName(UploadedFile $file): string
    {
        $name = trim((string) preg_replace('/[\x00-\x1F\x7F]+/', '', pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)));

        return mb_substr($name !== '' ? $name : 'image', 0, 150);
    }
}
