<?php
/**
 * @file WebProjectTemplateCheckpoint.php
 * @path app/Models/Web/WebProjectTemplateCheckpoint.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Checkpoint of a project template: title, description and the due date as days
 *   after the start of the project (null = no date).
 * @dependencies WebProjectTemplate
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebProjectTemplateCheckpoint extends Model
{
    protected $fillable = ['template_id', 'label', 'description', 'offset_days', 'sort_order'];

    protected $casts = ['offset_days' => 'integer', 'sort_order' => 'integer'];

    public function template(): BelongsTo
    {
        return $this->belongsTo(WebProjectTemplate::class, 'template_id');
    }
}
