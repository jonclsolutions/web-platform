<?php
/**
 * @file CreatorOutputFile.php
 * @path app/Apps/JsCreator/Models/CreatorOutputFile.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description File of one page of an output (js_creator_output_files): the image converted by
 *   the API to the format of the template and its WebP thumbnail, both on the private disk,
 *   shown only through signed URLs (WorkspaceFiles). Deleted with its output (foreign key).
 * @dependencies CreatorOutput.
 */

namespace App\Apps\JsCreator\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $output_id
 * @property int $page 1 = the first page.
 * @property string $path File on the private disk.
 * @property string $thumb_path Thumbnail (WebP) on the private disk.
 * @property string $mime image/png | image/jpeg.
 * @property int $size_bytes File + thumbnail.
 */
class CreatorOutputFile extends Model
{
    /** @var string The table of the model. */
    protected $table = 'js_creator_output_files';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['output_id', 'page', 'path', 'thumb_path', 'mime', 'size_bytes'];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = ['output_id' => 'integer', 'page' => 'integer', 'size_bytes' => 'integer'];

    /**
     * @description The output of the file.
     * @return BelongsTo
     */
    public function output(): BelongsTo
    {
        return $this->belongsTo(CreatorOutput::class, 'output_id')->withTrashed();
    }
}
