<?php
/**
 * @file ProjectApproval.php
 * @path app/Apps/ProjectPortal/Models/ProjectApproval.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Request for the client's approval (a design, a text, a release …): title,
 *   description, files, optional checkpoint and due date. The client approves it or requests
 *   changes with a comment; every decision is kept (ProjectApprovalDecision) with the account
 *   and time - the record of what the client agreed to. The supplier can ask again after changes
 *   (pending again) or cancel the request.
 * @property string $status pending | approved | changes_requested | cancelled
 * @dependencies Project, ProjectCheckpoint, ProjectApprovalDecision, CoreAttachment, User
 */

namespace App\Apps\ProjectPortal\Models;

use App\Models\Core\CoreAttachment;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class ProjectApproval extends Model
{
    /** @description Database table of the model. */
    protected $table = 'web_project_approvals';

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_CHANGES = 'changes_requested';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUSES = [self::STATUS_PENDING, self::STATUS_APPROVED, self::STATUS_CHANGES, self::STATUS_CANCELLED];

    /** @description Decisions the client can make. */
    public const DECISIONS = [self::STATUS_APPROVED, self::STATUS_CHANGES];

    protected $fillable = [
        'project_id', 'checkpoint_id', 'title', 'description', 'status', 'due_date',
        'requested_by', 'requested_by_label', 'requested_at', 'decided_at',
    ];

    protected $casts = [
        'due_date'     => 'date',
        'requested_at' => 'datetime',
        'decided_at'   => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function checkpoint(): BelongsTo
    {
        return $this->belongsTo(ProjectCheckpoint::class, 'checkpoint_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function decisions(): HasMany
    {
        return $this->hasMany(ProjectApprovalDecision::class, 'approval_id')->orderBy('id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(CoreAttachment::class, 'attachable');
    }

    /**
     * @description Requests the client cannot see (cancelled ones are hidden from the portal).
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return void
     */
    public function scopeVisibleToClient($query): void
    {
        $query->where('status', '!=', self::STATUS_CANCELLED);
    }
}
