<?php
/**
 * @file ProjectUpdate.php
 * @path app/Apps/ProjectPortal/Models/ProjectUpdate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Update from the supplier to the client ("what we did this week", a release, an
 *   outage) - title, text and files. A draft (published_at null) is visible to the team only;
 *   publishing shows it in the portal (section Updates, news feed) and e-mails the client
 *   accounts that turned update notifications on - only at the first publication
 *   (first_published_at), not again after it was taken back to a draft and published again.
 * @dependencies Project, User, CoreAttachment
 */

namespace App\Apps\ProjectPortal\Models;

use App\Models\Core\CoreAttachment;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class ProjectUpdate extends Model
{
    /** @description Database table of the model. */
    protected $table = 'project_portal_project_updates';

    protected $fillable = ['project_id', 'title', 'body', 'author_id', 'author_label', 'published_at', 'first_published_at'];

    protected $casts = ['published_at' => 'datetime', 'first_published_at' => 'datetime'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(CoreAttachment::class, 'attachable');
    }

    /**
     * @description Only published updates (what the client sees).
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return void
     */
    public function scopePublished($query): void
    {
        $query->whereNotNull('published_at')->where('published_at', '<=', now());
    }
}
