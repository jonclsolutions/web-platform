<?php
/**
 * @file ProjectThreadMessage.php
 * @path app/Apps/ProjectPortal/Models/ProjectThreadMessage.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Individual message within a ProjectThread conversation.
 * `author_label` is a display-only snapshot of the author's name (client account display name /
 * administrator's full name), kept when the account is removed later; `account_id` / `user_id`
 * link the author while the account exists. An internal note (`is_internal`) is written by the
 * administration for the team only - the client portal never returns it.
 */

namespace App\Apps\ProjectPortal\Models;

use App\Models\Core\CoreAttachment;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class ProjectThreadMessage extends Model
{
    /** @description Database table of the model. */
    protected $table = 'project_portal_project_thread_messages';

    /**
     * @description Personal data: the audit log notes that these attributes changed, never their
     *   values (App\Support\Audit\ModelChanges) - an erased / purged record leaves no copy in the logs.
     */
    public const AUDIT_MASKED = ['author_label', 'body'];

    protected $fillable = [
        'thread_id',
        'author_type',
        'author_label',
        'account_id',
        'user_id',
        'is_internal',
        'body',
    ];

    protected $casts = [
        'is_internal' => 'boolean',
    ];

    public function thread(): BelongsTo
    {
        return $this->belongsTo(ProjectThread::class, 'thread_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(CoreAttachment::class, 'attachable');
    }

    /**
     * @description Messages the client may see (no internal notes).
     * @param \Illuminate\Database\Eloquent\Builder $query Message query.
     * @return void
     */
    public function scopeVisibleToClient($query): void
    {
        $query->where('is_internal', false);
    }
}