<?php

/**
 * @file CreatorBlock.php
 * @path app/Apps/JsCreator/Models/CreatorBlock.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Block of an account (js_creator_blocks): a reusable group of layers of one
 *   section with its own canvas size and document (the same layers and fields as a template,
 *   never another block - blocks do not nest) and a WebP thumbnail. Templates use it through
 *   block instances (usage `template` → `block`), so a change of the block shows in every
 *   template; a used block cannot be deleted. `version` rises with every save of the editor.
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
 * @property string|null $thumb_path Thumbnail (WebP) on the private disk.
 * @property int $thumb_bytes Size of the thumbnail (quota).
 * @property bool $thumb_stale The thumbnail has to be drawn again (imported block).
 * @property int $version
 */
class CreatorBlock extends Model
{
    use BelongsToWorkspace, SoftDeletes;

    /** @description Owner type of the usages of a block (its images and fonts). */
    public const USAGE_OWNER = 'block';

    /** @description Name and document never reach the audit log (content of the private workspace). */
    public const AUDIT_MASKED = ['name', 'document'];

    /** @var string The table of the model. */
    protected $table = 'js_creator_blocks';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['user_id', 'section', 'name', 'width', 'height', 'schema_version', 'document', 'thumb_path', 'thumb_bytes', 'thumb_stale', 'version'];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = [
        'user_id' => 'integer', 'width' => 'integer', 'height' => 'integer', 'schema_version' => 'integer', 'document' => 'array', 'thumb_stale' => 'boolean',
        'thumb_bytes' => 'integer', 'version' => 'integer',
    ];

    /**
     * @description Library images and own fonts the block uses.
     * @return HasMany
     */
    public function usages(): HasMany
    {
        return $this->hasMany(CreatorUsage::class, 'owner_id')->where('owner_type', self::USAGE_OWNER);
    }

    /**
     * @description Deletes the block for good with its thumbnail and usages (trash, retention).
     * @return void
     */
    public function deleteWithFiles(): void
    {
        $this->usages()->delete();
        $this->forceDelete();
        WorkspaceFiles::delete([$this->thumb_path]);
    }
}
