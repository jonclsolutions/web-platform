<?php
/**
 * @file WebProjectTemplate.php
 * @path app/Models/Web/WebProjectTemplate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Template of a project: a named list of checkpoints (title, description, due date
 *   as days after the start) used when a project is created or added to an existing one, or
 *   saved from an existing project.
 * @dependencies WebProjectTemplateCheckpoint, WebProject
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class WebProjectTemplate extends Model
{
    protected $fillable = ['name', 'description'];

    public function checkpoints(): HasMany
    {
        return $this->hasMany(WebProjectTemplateCheckpoint::class, 'template_id')->orderBy('sort_order')->orderBy('id');
    }

    /**
     * @description Adds the template's checkpoints at the end of a project; a due date is the
     *   start date + offset_days.
     * @param WebProject $project Target project.
     * @param Carbon|null $start Start of the due dates (default today).
     * @return int Number of added checkpoints.
     */
    public function applyTo(WebProject $project, ?Carbon $start = null): int
    {
        $start = ($start ?? now())->copy()->startOfDay();
        $position = ($project->checkpoints()->max('sort_order') ?? -1) + 1;
        $count = 0;
        foreach ($this->checkpoints as $item) {
            $project->checkpoints()->create([
                'label'       => $item->label,
                'description' => $item->description,
                'due_date'    => $item->offset_days !== null ? $start->copy()->addDays($item->offset_days)->toDateString() : null,
                'status'      => 'new',
                'sort_order'  => $position++,
            ]);
            $count++;
        }

        return $count;
    }
}
