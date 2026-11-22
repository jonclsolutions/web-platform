<?php

/**
 * @file CreatorPreset.php
 * @path app/Apps/JsCreator/Models/CreatorPreset.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Saved filling of the form of generating of an account (js_creator_presets):
 *   texts of the fields, library images of image fields, crops (per template) and the text of
 *   the post typed by hand - for one template (`template_id`) or one set (`set_id`). Photos of
 *   the computer are never part of it (they never leave the browser).
 * @dependencies BelongsToWorkspace, PresetValues (shape of `values`).
 */

namespace App\Apps\JsCreator\Models;

use App\Apps\JsCreator\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $user_id Owner.
 * @property string $section Section id (JsCreatorSections::SECTIONS).
 * @property int|null $template_id Template of the preset.
 * @property int|null $set_id Set of the preset.
 * @property string $name
 * @property array $payload Values: texts, images, crops and caption (PresetValues; the API calls them `values`).
 */
class CreatorPreset extends Model
{
    use BelongsToWorkspace;

    /** @description Most presets of one template / set. */
    public const MAX_PER_OWNER = 50;

    /** @description Name and values never reach the audit log (content of the private workspace). */
    public const AUDIT_MASKED = ['name', 'payload'];

    /** @var string The table of the model. */
    protected $table = 'js_creator_presets';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['user_id', 'section', 'template_id', 'set_id', 'name', 'payload'];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = ['user_id' => 'integer', 'template_id' => 'integer', 'set_id' => 'integer', 'payload' => 'array'];
}
