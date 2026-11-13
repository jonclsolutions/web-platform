<?php
/**
 * @file ProjectCheckpoint.php
 * @path app/Apps/ProjectPortal/Models/ProjectCheckpoint.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Freeform per-project checklist item (e.g. "UI design", "Deploy") with a title,
 * a description and an optional due date - managed by an admin (status, order), visible
 * read-only to the client in the portal. `internal_note` is for the team only (never returned
 * by the client portal - ProjectCheckpointPublicResource).
 */

namespace App\Apps\ProjectPortal\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectCheckpoint extends Model
{
    /** @description Database table of the model. */
    protected $table = 'web_project_checkpoints';

    public const STATUSES = ['new', 'active', 'done'];

    protected $fillable = [
        'project_id',
        'label',
        'description',
        'due_date',
        'internal_note',
        'status',
        'status_changed_at',
        'sort_order',
    ];

    protected $casts = [
        'status_changed_at' => 'datetime',
        'due_date' => 'date',
        'sort_order' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    /**
     * @description Sets the new state and records `status_changed_at` - the one place where
     * `status` should change, so the timestamp is never forgotten.
     */
    public function setStatus(string $status): void
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new \InvalidArgumentException("Invalid checkpoint status: {$status}");
        }
        $this->status = $status;
        $this->status_changed_at = now();
        $this->save();
    }
}