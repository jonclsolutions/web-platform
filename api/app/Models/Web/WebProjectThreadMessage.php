<?php
/**
 * @file WebProjectThreadMessage.php
 * @path app/Models/Web/WebProjectThreadMessage.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Individual message within a WebProjectThread conversation.
 * `author_label` is a display-only snapshot, deliberately not a live FK - see
 * migration for rationale (audit-trail integrity if an admin account later changes).
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class WebProjectThreadMessage extends Model
{
    /**
     * @description Personal data: the audit log notes that these attributes changed, never their
     *   values (App\Support\Audit\ModelChanges) - an erased / purged record leaves no copy in the logs.
     */
    public const AUDIT_MASKED = ['author_label', 'body'];

    protected $fillable = [
        'thread_id',
        'author_type',
        'author_label',
        'body',
    ];

    public function thread(): BelongsTo
    {
        return $this->belongsTo(WebProjectThread::class, 'thread_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(WebAttachment::class, 'attachable');
    }
}