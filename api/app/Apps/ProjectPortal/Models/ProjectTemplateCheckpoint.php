<?php
/**
 * @file ProjectTemplateCheckpoint.php
 * @path app/Apps/ProjectPortal/Models/ProjectTemplateCheckpoint.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Checkpoint of a project template: title, description and the due date as days
 *   after the start of the project (null = no date).
 * @dependencies ProjectTemplate
 */

namespace App\Apps\ProjectPortal\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectTemplateCheckpoint extends Model
{
    /** @description Database table of the model. */
    protected $table = 'project_portal_project_template_checkpoints';

    protected $fillable = ['template_id', 'label', 'description', 'offset_days', 'sort_order'];

    protected $casts = ['offset_days' => 'integer', 'sort_order' => 'integer'];

    public function template(): BelongsTo
    {
        return $this->belongsTo(ProjectTemplate::class, 'template_id');
    }
}
