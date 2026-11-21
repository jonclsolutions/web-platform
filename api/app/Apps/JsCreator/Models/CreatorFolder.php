<?php
/**
 * @file CreatorFolder.php
 * @path app/Apps/JsCreator/Models/CreatorFolder.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Folder of the workspace of an account (js_creator_folders) - one tree shared by
 *   every section (images now, videos / GIFs later). Deleting a folder moves its whole subtree to
 *   the trash: every folder of it gets `trash_root_id` = the deleted folder, so the subtree is
 *   restored or deleted for good as one item (FolderTree).
 * @dependencies BelongsToWorkspace, SoftDeletes.
 */

namespace App\Apps\JsCreator\Models;

use App\Apps\JsCreator\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $user_id Owner.
 * @property int|null $parent_id Parent folder (null = top level).
 * @property string $name
 * @property int|null $trash_root_id Deleted folder whose deletion trashed this one.
 */
class CreatorFolder extends Model
{
    use BelongsToWorkspace, SoftDeletes;

    /** @description Deepest allowed level (a top-level folder is level 1). */
    public const MAX_DEPTH = 10;

    /** @var string The table of the model. */
    protected $table = 'js_creator_folders';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['user_id', 'parent_id', 'name'];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = ['user_id' => 'integer', 'parent_id' => 'integer', 'trash_root_id' => 'integer'];

    /**
     * @description Trashed folders the user deleted himself - the items of the trash (folders
     *   trashed together with their parent are restored / deleted with it).
     * @param Builder $query
     * @return Builder
     */
    public function scopeTrashRoots(Builder $query): Builder
    {
        return $query->onlyTrashed()->whereColumn('trash_root_id', 'id');
    }
}
