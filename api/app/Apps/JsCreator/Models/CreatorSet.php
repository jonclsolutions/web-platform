<?php

/**
 * @file CreatorSet.php
 * @path app/Apps/JsCreator/Models/CreatorSet.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Set of an account (js_creator_sets): templates of one section in different sizes
 *   (js_creator_set_templates, in their order) that share their fields - one filling generates
 *   one output per template. Optional caption pattern (null = the pattern of the first
 *   template). A template deleted for good leaves the set (foreign key); a template in the
 *   trash stays in it and is skipped when generating.
 * @dependencies BelongsToWorkspace, SoftDeletes, CreatorTemplate.
 */

namespace App\Apps\JsCreator\Models;

use App\Apps\JsCreator\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $user_id Owner.
 * @property string $section Section id (JsCreatorSections::SECTIONS).
 * @property string $name
 * @property string|null $caption_template Pattern of the post text (`{{key}}` = value of a field).
 */
class CreatorSet extends Model
{
    use BelongsToWorkspace, SoftDeletes;

    /** @description Most templates of a set. */
    public const MAX_TEMPLATES = 10;

    /** @description Name and caption pattern never reach the audit log (content of the private workspace). */
    public const AUDIT_MASKED = ['name', 'caption_template'];

    /** @var string The table of the model. */
    protected $table = 'js_creator_sets';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['user_id', 'section', 'name', 'caption_template'];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = ['user_id' => 'integer'];

    /**
     * @description Templates of the set in their order (also those in the trash).
     * @return BelongsToMany
     */
    public function templates(): BelongsToMany
    {
        return $this->belongsToMany(CreatorTemplate::class, 'js_creator_set_templates', 'set_id', 'template_id')
            ->withPivot('position')->orderBy('js_creator_set_templates.position')->withTrashed();
    }
}
