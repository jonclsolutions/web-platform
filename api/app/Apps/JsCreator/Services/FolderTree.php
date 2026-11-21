<?php
/**
 * @file FolderTree.php
 * @path app/Apps/JsCreator/Services/FolderTree.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Rules of the folder tree of ONE account (every query is limited to its folders):
 *   - depth: a top-level folder is level 1, the deepest allowed is CreatorFolder::MAX_DEPTH;
 *   - a folder cannot move into itself or its own subfolder;
 *   - names are unique among the folders of one parent (case-insensitive, trash not counted);
 *   - trash: deleting a folder moves its whole subtree to the trash as one item (every folder
 *     of it gets `trash_root_id` = the deleted folder); a restore brings the subtree back (to the
 *     top level when the parent no longer exists, with " (2)" … when the name is taken), a
 *     permanent deletion removes the subtree (the foreign key deletes the subfolders).
 * @dependencies CreatorFolder.
 */

namespace App\Apps\JsCreator\Services;

use App\Apps\JsCreator\Models\CreatorFolder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class FolderTree
{
    /** @var Collection<int, CreatorFolder>|null Every folder of the account (trash included), by id. */
    private ?Collection $all = null;

    /**
     * @param int $userId Owner of the tree.
     */
    public function __construct(private readonly int $userId)
    {
    }

    /**
     * @description Level of a folder (0 = the top, i.e. no folder; a top-level folder is 1).
     * @param int|null $folderId Folder.
     * @return int
     */
    public function levelOf(?int $folderId): int
    {
        $level = 0;
        $seen = [];
        while ($folderId !== null && !isset($seen[$folderId]) && ($folder = $this->folders()->get($folderId))) {
            $seen[$folderId] = true;
            $level++;
            $folderId = $folder->parent_id;
        }

        return $level;
    }

    /**
     * @description Number of levels of the subtree of a folder (1 = no subfolders).
     * @param int $folderId Folder.
     * @return int
     */
    public function heightOf(int $folderId): int
    {
        $children = $this->children($folderId, false);

        return 1 + ($children->isEmpty() ? 0 : $children->max(fn (CreatorFolder $child) => $this->heightOf($child->id)));
    }

    /**
     * @description Whether $candidateId is the folder itself or one of its subfolders.
     * @param int $folderId Folder.
     * @param int $candidateId Folder to test.
     * @return bool
     */
    public function isWithin(int $folderId, int $candidateId): bool
    {
        return in_array($candidateId, [$folderId, ...$this->descendantIds($folderId, false)], true);
    }

    /**
     * @description Whether a sibling (not in the trash) already has the name.
     * @param int|null $parentId Parent (null = top level).
     * @param string $name Name.
     * @param int|null $exceptId Folder ignored (the renamed one).
     * @return bool
     */
    public function nameTaken(?int $parentId, string $name, ?int $exceptId = null): bool
    {
        $needle = mb_strtolower(trim($name));

        return $this->children($parentId, false)
            ->contains(fn (CreatorFolder $f) => $f->id !== $exceptId && mb_strtolower($f->name) === $needle);
    }

    /**
     * @description Moves a folder and its subtree to the trash.
     * @param CreatorFolder $folder Folder of the account (not in the trash).
     * @return void
     */
    public function trash(CreatorFolder $folder): void
    {
        $ids = [$folder->id, ...$this->descendantIds($folder->id, false)];
        CreatorFolder::query()->ownedBy($this->userId)->whereIn('id', $ids)
            ->update(['deleted_at' => now(), 'trash_root_id' => $folder->id, 'updated_at' => now()]);
        $this->all = null;
    }

    /**
     * @description Restores a deleted folder with the subtree deleted with it.
     * @param CreatorFolder $root Item of the trash (CreatorFolder::trashRoots()).
     * @return void
     */
    public function restore(CreatorFolder $root): void
    {
        DB::transaction(function () use ($root) {
            $parentId = $root->parent_id;
            if ($parentId !== null && !CreatorFolder::query()->ownedBy($this->userId)->whereKey($parentId)->exists()) {
                $parentId = null;
            }

            CreatorFolder::onlyTrashed()->ownedBy($this->userId)->where('trash_root_id', $root->id)
                ->update(['deleted_at' => null, 'trash_root_id' => null, 'updated_at' => now()]);
            $this->all = null;

            $root->refresh();
            $root->parent_id = $parentId;
            $root->name = $this->freeName($parentId, $root->name, $root->id);
            $root->save();
            $this->all = null;
        });
    }

    /**
     * @description Deletes a trashed folder and its subtree for good.
     * @param CreatorFolder $root Item of the trash.
     * @return void
     */
    public function forceDelete(CreatorFolder $root): void
    {
        // Deepest folders first (reverse breadth-first order) - no row ever waits for the
        // cascade of its parent key.
        $ids = [$root->id, ...$this->descendantIds($root->id, true)];
        DB::transaction(function () use ($ids) {
            foreach (array_reverse($ids) as $id) {
                CreatorFolder::withTrashed()->ownedBy($this->userId)->whereKey($id)->forceDelete();
            }
        });
        $this->all = null;
    }

    /**
     * @description A name that is free among the siblings: the name itself, or "name (2)", "(3)" ….
     * @param int|null $parentId Parent.
     * @param string $name Wanted name.
     * @param int|null $exceptId Folder ignored.
     * @return string
     */
    public function freeName(?int $parentId, string $name, ?int $exceptId = null): string
    {
        $candidate = $name;
        for ($n = 2; $this->nameTaken($parentId, $candidate, $exceptId); $n++) {
            $suffix = " ({$n})";
            $candidate = mb_substr($name, 0, 120 - mb_strlen($suffix)) . $suffix;
        }

        return $candidate;
    }

    /**
     * @description Ids of the subfolders of a folder, breadth first.
     * @param int $folderId Folder.
     * @param bool $withTrashed Also subfolders in the trash.
     * @return array<int, int>
     */
    public function descendantIds(int $folderId, bool $withTrashed): array
    {
        $ids = [];
        $queue = [$folderId];
        while ($queue !== []) {
            $current = array_shift($queue);
            foreach ($this->children($current, $withTrashed) as $child) {
                if (!in_array($child->id, $ids, true)) {
                    $ids[] = $child->id;
                    $queue[] = $child->id;
                }
            }
        }

        return $ids;
    }

    /**
     * @description Direct subfolders.
     * @param int|null $parentId Parent (null = top level).
     * @param bool $withTrashed Also folders in the trash.
     * @return Collection<int, CreatorFolder>
     */
    private function children(?int $parentId, bool $withTrashed): Collection
    {
        return $this->folders()->filter(fn (CreatorFolder $f) => $f->parent_id === $parentId && ($withTrashed || $f->deleted_at === null))->values();
    }

    /**
     * @description Every folder of the account, loaded once.
     * @return Collection<int, CreatorFolder>
     */
    private function folders(): Collection
    {
        return $this->all ??= CreatorFolder::withTrashed()->ownedBy($this->userId)->get()->keyBy('id');
    }
}
