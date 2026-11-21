<?php
/**
 * @file FolderController.php
 * @path app/Apps/JsCreator/Http/Controllers/FolderController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Folders of the OWN workspace (one tree for every section): list, trash list,
 *   create, rename / move, delete to the trash with the subtree, restore, delete for good, empty
 *   the trash. Every query is limited to the signed-in account (another account's folder = 404,
 *   also for the sysadmin); the tree rules are in FolderTree.
 * @note The audit log names only the id of a folder, never its name (the log must not show the
 *   content of a workspace to whoever reads it).
 * @dependencies FolderTree, CreatorFolder, FolderResource, LogsActivity (JsCreatorLog).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Http\Requests\StoreFolderRequest;
use App\Apps\JsCreator\Http\Requests\UpdateFolderRequest;
use App\Apps\JsCreator\Http\Resources\FolderResource;
use App\Apps\JsCreator\Models\CreatorFolder;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\FolderTree;
use App\Http\Controllers\Controller;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class FolderController extends Controller
{
    use LogsActivity;

    /**
     * @description Folders of the account - all of them (the frontend builds the tree), or with
     *   `only_trashed=1` the items of the trash (folders the user deleted, newest first).
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $folders = filter_var($request->query('only_trashed', false), FILTER_VALIDATE_BOOLEAN)
            ? CreatorFolder::trashRoots()->ownedBy($userId)->orderByDesc('deleted_at')->get()
            : CreatorFolder::query()->ownedBy($userId)->orderBy('name')->get();

        return $this->respond(FolderResource::collection($folders));
    }

    /**
     * @description Creates a folder (top level, or inside an own folder).
     * @param StoreFolderRequest $request `name`, `parent_id`.
     * @return JsonResponse 201; 404 another account's parent; 422 too deep / name taken.
     */
    public function store(StoreFolderRequest $request): JsonResponse
    {
        $userId = $request->user()->id;
        $parentId = $request->filled('parent_id') ? $this->ownFolder($userId, (int) $request->input('parent_id'))->id : null;
        $tree = new FolderTree($userId);

        if ($tree->levelOf($parentId) + 1 > CreatorFolder::MAX_DEPTH) {
            throw ValidationException::withMessages(['parent_id' => 'The folder would be deeper than ' . CreatorFolder::MAX_DEPTH . ' levels.']);
        }
        $this->ensureFreeName($tree, $parentId, $request->input('name'));

        $folder = CreatorFolder::create(['user_id' => $userId, 'parent_id' => $parentId, 'name' => $request->input('name')]);
        $this->logAction($request, JsCreatorLog::class, 'create', 'Folder', "Folder #{$folder->id} created", $folder->id, 'Folder');

        return $this->respond(new FolderResource($folder), 201);
    }

    /**
     * @description Renames and / or moves an own folder (`parent_id` null = to the top level).
     * @param UpdateFolderRequest $request `name`?, `parent_id`?
     * @param string $id Folder.
     * @return JsonResponse 200; 404; 422 into itself / too deep / name taken.
     */
    public function update(UpdateFolderRequest $request, string $id): JsonResponse
    {
        $userId = $request->user()->id;
        $folder = $this->ownFolder($userId, (int) $id);
        $tree = new FolderTree($userId);

        $parentId = $folder->parent_id;
        if ($request->has('parent_id')) {
            $parentId = $request->filled('parent_id') ? $this->ownFolder($userId, (int) $request->input('parent_id'))->id : null;
        }
        if ($parentId !== $folder->parent_id) {
            if ($parentId !== null && $tree->isWithin($folder->id, $parentId)) {
                throw ValidationException::withMessages(['parent_id' => 'A folder cannot move into itself or its own subfolder.']);
            }
            if ($tree->levelOf($parentId) + $tree->heightOf($folder->id) > CreatorFolder::MAX_DEPTH) {
                throw ValidationException::withMessages(['parent_id' => 'The folder would be deeper than ' . CreatorFolder::MAX_DEPTH . ' levels.']);
            }
        }
        $name = $request->input('name', $folder->name);
        $this->ensureFreeName($tree, $parentId, $name, $folder->id);

        $moved = $parentId !== $folder->parent_id;
        $folder->fill(['parent_id' => $parentId, 'name' => $name])->save();
        $this->logAction($request, JsCreatorLog::class, 'update', 'Folder', "Folder #{$folder->id} " . ($moved ? 'moved' : 'renamed'), $folder->id, 'Folder');

        return $this->respond(new FolderResource($folder));
    }

    /**
     * @description Moves an own folder with its subtree to the trash, or (`force=1`) deletes an
     *   item of the trash for good.
     * @param Request $request `force`.
     * @param string $id Folder.
     * @return JsonResponse 204; 404.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $userId = $request->user()->id;
        $tree = new FolderTree($userId);

        if (filter_var($request->query('force', false), FILTER_VALIDATE_BOOLEAN)) {
            $tree->forceDelete(CreatorFolder::trashRoots()->ownedBy($userId)->findOrFail((int) $id));
            $this->logAction($request, JsCreatorLog::class, 'hard_delete', 'Folder', "Folder #{$id} deleted for good", (int) $id, 'Folder');
        } else {
            $tree->trash($this->ownFolder($userId, (int) $id));
            $this->logAction($request, JsCreatorLog::class, 'soft_delete', 'Folder', "Folder #{$id} moved to the trash", (int) $id, 'Folder');
        }

        return response()->json(null, 204);
    }

    /**
     * @description Restores an item of the trash with its subtree.
     * @param Request $request
     * @param string $id Folder (item of the trash).
     * @return JsonResponse 200; 404.
     */
    public function restore(Request $request, string $id): JsonResponse
    {
        $userId = $request->user()->id;
        $folder = CreatorFolder::trashRoots()->ownedBy($userId)->findOrFail((int) $id);
        (new FolderTree($userId))->restore($folder);
        $this->logAction($request, JsCreatorLog::class, 'restore', 'Folder', "Folder #{$folder->id} restored", $folder->id, 'Folder');

        return $this->respond(new FolderResource($folder->fresh()));
    }

    /**
     * @description Deletes every folder of the own trash for good.
     * @param Request $request
     * @return JsonResponse 204.
     */
    public function emptyTrash(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $tree = new FolderTree($userId);
        $roots = CreatorFolder::trashRoots()->ownedBy($userId)->get();
        $roots->each(fn (CreatorFolder $root) => $tree->forceDelete($root));
        $this->logAction($request, JsCreatorLog::class, 'force_delete_all', 'Folder', "Folder trash emptied. Count: {$roots->count()}");

        return response()->json(null, 204);
    }

    /**
     * @description Own folder outside the trash.
     * @param int $userId Account.
     * @param int $id Folder.
     * @return CreatorFolder
     */
    private function ownFolder(int $userId, int $id): CreatorFolder
    {
        return CreatorFolder::query()->ownedBy($userId)->findOrFail($id);
    }

    /**
     * @description Refuses a name another folder of the same parent already has.
     * @param FolderTree $tree Tree of the account.
     * @param int|null $parentId Parent.
     * @param string $name Name.
     * @param int|null $exceptId The renamed folder.
     * @return void
     * @throws ValidationException
     */
    private function ensureFreeName(FolderTree $tree, ?int $parentId, string $name, ?int $exceptId = null): void
    {
        if ($tree->nameTaken($parentId, $name, $exceptId)) {
            throw ValidationException::withMessages(['name' => 'A folder with this name already exists here.']);
        }
    }
}
