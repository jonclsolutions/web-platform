<?php
/**
 * @file CreatorAsset.php
 * @path app/Apps/JsCreator/Models/CreatorAsset.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Image of the library of an account (js_creator_assets): logos, backgrounds and
 *   photos for the fixed elements of templates. The stored file is re-encoded by LibraryImage
 *   (no metadata, at most 4000 px), with a WebP thumbnail; both are on the private disk and are
 *   shown only through signed URLs (WorkspaceFiles).
 * @dependencies BelongsToWorkspace, SoftDeletes, WorkspaceFiles.
 */

namespace App\Apps\JsCreator\Models;

use App\Apps\JsCreator\Models\Concerns\BelongsToWorkspace;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $user_id Owner.
 * @property string $name Display name (from the uploaded file name).
 * @property string $path Stored image on the private disk.
 * @property string $thumb_path Thumbnail (WebP) on the private disk.
 * @property string $mime image/jpeg | image/png | image/webp.
 * @property int $width
 * @property int $height
 * @property int $size_bytes Image + thumbnail (quota).
 */
class CreatorAsset extends Model
{
    use BelongsToWorkspace, SoftDeletes;

    /** @var string The table of the model. */
    protected $table = 'js_creator_assets';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['user_id', 'name', 'path', 'thumb_path', 'mime', 'width', 'height', 'size_bytes'];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = ['user_id' => 'integer', 'width' => 'integer', 'height' => 'integer', 'size_bytes' => 'integer'];

    /**
     * @description Deletes the image for good with its files (trash, retention).
     * @return void
     */
    public function deleteWithFiles(): void
    {
        $this->forceDelete();
        WorkspaceFiles::delete([$this->path, $this->thumb_path]);
    }
}
