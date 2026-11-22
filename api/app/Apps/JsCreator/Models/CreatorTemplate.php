<?php
/**
 * @file CreatorTemplate.php
 * @path app/Apps/JsCreator/Models/CreatorTemplate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Template of an account (js_creator_templates): one section, one size, the document
 *   of the editor (validated by TemplateDocument), output format, caption pattern and a WebP
 *   thumbnail (made by the browser, re-encoded by the API). `version` rises with every save of
 *   the editor; a save based on an older version is refused.
 * @dependencies BelongsToWorkspace, SoftDeletes, CreatorUsage, WorkspaceFiles.
 */

namespace App\Apps\JsCreator\Models;

use App\Apps\JsCreator\Models\Concerns\BelongsToWorkspace;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $user_id Owner.
 * @property string $section Section id (JsCreatorSections::SECTIONS).
 * @property string $name
 * @property int $width
 * @property int $height
 * @property int $schema_version
 * @property array<string, mixed> $document
 * @property string $output_format png | jpg.
 * @property int $output_quality 1-100 (JPG).
 * @property string|null $caption_template Pattern of the post text (`{{key}}` = value of a field).
 * @property string|null $thumb_path Thumbnail (WebP) on the private disk.
 * @property int $thumb_bytes Size of the thumbnail (quota).
 * @property int $version
 */
class CreatorTemplate extends Model
{
    use BelongsToWorkspace, SoftDeletes;

    /** @description Owner type of the usages of a template. */
    public const USAGE_OWNER = 'template';

    /** @description Name, document and caption pattern never reach the audit log (content of the private workspace). */
    public const AUDIT_MASKED = ['name', 'document', 'caption_template'];

    /** @var string The table of the model. */
    protected $table = 'js_creator_templates';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = [
        'user_id', 'section', 'name', 'width', 'height', 'schema_version', 'document', 'output_format', 'output_quality',
        'caption_template', 'thumb_path', 'thumb_bytes', 'version',
    ];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = [
        'user_id' => 'integer', 'width' => 'integer', 'height' => 'integer', 'schema_version' => 'integer', 'document' => 'array',
        'output_quality' => 'integer', 'thumb_bytes' => 'integer', 'version' => 'integer',
    ];

    /**
     * @description Library images and own fonts the template uses.
     * @return HasMany
     */
    public function usages(): HasMany
    {
        return $this->hasMany(CreatorUsage::class, 'owner_id')->where('owner_type', self::USAGE_OWNER);
    }

    /**
     * @description Deletes the template for good with its thumbnail and usages (trash, retention).
     * @return void
     */
    public function deleteWithFiles(): void
    {
        $this->usages()->delete();
        $this->forceDelete();
        WorkspaceFiles::delete([$this->thumb_path]);
    }
}
