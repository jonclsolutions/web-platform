<?php
/**
 * @file CreatorFont.php
 * @path app/Apps/JsCreator/Models/CreatorFont.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Own font of an account (js_creator_fonts) - one face (family, weight, style) of
 *   a TTF / OTF / WOFF / WOFF2 file. The server only checks the type of the file (FontFile); the
 *   font is read by the browser alone. Visible only to its owner.
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
 * @property string $family Name of the family chosen by the owner.
 * @property int $weight 100 … 900.
 * @property string $style normal | italic.
 * @property string $format ttf | otf | woff | woff2 (detected from the content).
 * @property string $path File on the private disk.
 * @property int $size_bytes
 */
class CreatorFont extends Model
{
    use BelongsToWorkspace, SoftDeletes;

    /** @description Allowed weights. */
    public const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

    /** @description Allowed styles. */
    public const STYLES = ['normal', 'italic'];

    /** @var string The table of the model. */
    protected $table = 'js_creator_fonts';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['user_id', 'family', 'weight', 'style', 'format', 'path', 'size_bytes'];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = ['user_id' => 'integer', 'weight' => 'integer', 'size_bytes' => 'integer'];

    /**
     * @description Deletes the font for good with its file (trash, retention).
     * @return void
     */
    public function deleteWithFiles(): void
    {
        $this->forceDelete();
        WorkspaceFiles::delete([$this->path]);
    }
}
