<?php
/**
 * @file CreatorUsage.php
 * @path app/Apps/JsCreator/Models/CreatorUsage.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description What a template uses (js_creator_usages): a library image (`asset`) or an own font
 *   (`font`). Kept by TemplateUsages on every save, so the library can refuse to delete a used
 *   file and list where it is used - also for templates in the trash (they can be restored).
 * @note Owner type `template` now; blocks (stage 4) add their own owner / target type.
 * @dependencies BelongsToWorkspace, CreatorTemplate.
 */

namespace App\Apps\JsCreator\Models;

use App\Apps\JsCreator\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id Owner.
 * @property string $owner_type template.
 * @property int $owner_id
 * @property string $target_type asset | font.
 * @property int $target_id
 */
class CreatorUsage extends Model
{
    use BelongsToWorkspace;

    /** @description Target type of a library image. */
    public const ASSET = 'asset';

    /** @description Target type of an own font. */
    public const FONT = 'font';

    /** @var string The table of the model. */
    protected $table = 'js_creator_usages';

    /** @var bool Rows without timestamps. */
    public $timestamps = false;

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['user_id', 'owner_type', 'owner_id', 'target_type', 'target_id'];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = ['user_id' => 'integer', 'owner_id' => 'integer', 'target_id' => 'integer'];

    /**
     * @description The template that uses the target (also in the trash).
     * @return BelongsTo
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(CreatorTemplate::class, 'owner_id')->withTrashed();
    }
}
