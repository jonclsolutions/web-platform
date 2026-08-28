<?php
/**
 * @file WebProjectThreadMessage.php
 * @path app/Models/Web/WebProjectThreadMessage.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Individual message within a WebProjectThread conversation.
 * `author_label` is a display-only snapshot, deliberately not a live FK - see
 * migration for rationale (audit-trail integrity if an admin account later changes).
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebProjectThreadMessage extends Model
{
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
}