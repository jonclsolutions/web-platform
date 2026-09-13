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
 *
 * @refactor-note (2026-09-11) BACKLOG "vlákna přijímají přílohy": `attachments()`
 * polymorfní vztah přidán - znovupoužívá STÁVAJÍCÍ `WebAttachment` model (žádná nová
 * tabulka, žádná migrace) přesně stejným způsobem jako
 * `WebRawRequestCommission`/`WebSalesOrder`/atd. Ukládání/mazání jde přes sdílený
 * `HandlesAttachments` trait v obou controllerech (admin `WebProjectThreadController`
 * i customer-facing `WebProjectPublicController`).
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

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

    public function attachments(): MorphMany
    {
        return $this->morphMany(WebAttachment::class, 'attachable');
    }
}