<?php
/**
 * @file CreatorOutput.php
 * @path app/Apps/JsCreator/Models/CreatorOutput.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Generated output of an account (js_creator_outputs): the post made from a template
 *   - its files by page (CreatorOutputFile), the text of the post, the name of the template at
 *   the time of generating, size and format. An output never changes its picture; it can be
 *   renamed, moved to another folder, downloaded and deleted.
 *   Trash: an output deleted by itself has `trash_root_id` null (an item of the trash); an output
 *   deleted with its folder has `trash_root_id` = that folder and is restored / deleted for good
 *   with it (FolderTree).
 * @dependencies BelongsToWorkspace, SoftDeletes, CreatorOutputFile, WorkspaceFiles.
 */

namespace App\Apps\JsCreator\Models;

use App\Apps\JsCreator\Models\Concerns\BelongsToWorkspace;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $user_id Owner.
 * @property int|null $folder_id Folder (null = top level).
 * @property string $section Section id (JsCreatorSections::SECTIONS).
 * @property string $name
 * @property int|null $template_id Template (null after it was deleted for good).
 * @property string $template_name Name of the template when generated.
 * @property string|null $caption Text of the post.
 * @property int $width
 * @property int $height
 * @property string $format png | jpg.
 * @property int $page_count
 * @property int $size_bytes Files + thumbnails (quota).
 * @property int|null $trash_root_id Folder whose deletion trashed the output.
 */
class CreatorOutput extends Model
{
    use BelongsToWorkspace, SoftDeletes;

    /** @description Name, text of the post and template name never reach the audit log (content of the private workspace). */
    public const AUDIT_MASKED = ['name', 'caption', 'template_name'];

    /** @var string The table of the model. */
    protected $table = 'js_creator_outputs';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = [
        'user_id', 'folder_id', 'section', 'name', 'template_id', 'template_name', 'caption', 'width', 'height', 'format',
        'page_count', 'size_bytes',
    ];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = [
        'user_id' => 'integer', 'folder_id' => 'integer', 'template_id' => 'integer', 'width' => 'integer', 'height' => 'integer',
        'page_count' => 'integer', 'size_bytes' => 'integer', 'trash_root_id' => 'integer',
    ];

    /**
     * @description Files of the output, first page first.
     * @return HasMany
     */
    public function files(): HasMany
    {
        return $this->hasMany(CreatorOutputFile::class, 'output_id')->orderBy('page');
    }

    /**
     * @description Outputs the user deleted himself - the items of the trash (outputs trashed
     *   with their folder are restored / deleted with it).
     * @param Builder $query
     * @return Builder
     */
    public function scopeTrashItems(Builder $query): Builder
    {
        return $query->onlyTrashed()->whereNull('trash_root_id');
    }

    /**
     * @description Deletes the output for good with its files (trash, retention, folder deleted
     *   for good).
     * @return void
     */
    public function deleteWithFiles(): void
    {
        $paths = $this->files()->get()->flatMap(fn (CreatorOutputFile $file) => [$file->path, $file->thumb_path])->all();
        $this->forceDelete();
        WorkspaceFiles::delete($paths);
    }
}
