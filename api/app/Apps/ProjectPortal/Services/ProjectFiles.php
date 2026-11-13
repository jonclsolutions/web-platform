<?php
/**
 * @file ProjectFiles.php
 * @path app/Apps/ProjectPortal/Services/ProjectFiles.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Every file of a project, newest first: attachments of thread messages, of
 *   updates and of approval requests. For the client only what it may see: no internal notes,
 *   no drafts of updates, no cancelled approval requests.
 * @dependencies CoreAttachment, ProjectThreadMessage, ProjectUpdate, ProjectApproval
 */

namespace App\Apps\ProjectPortal\Services;

use App\Models\Core\CoreAttachment;
use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectApproval;
use App\Apps\ProjectPortal\Models\ProjectThreadMessage;
use App\Apps\ProjectPortal\Models\ProjectUpdate;
use Illuminate\Support\Collection;

class ProjectFiles
{
    /**
     * @description Files of the project with their source loaded (`attachable`, a message with its thread).
     * @param Project $project
     * @param bool $forClient Only what the client may see.
     * @return Collection<int, CoreAttachment>
     */
    public function of(Project $project, bool $forClient): Collection
    {
        $messages = ProjectThreadMessage::whereIn('thread_id', $project->threads()->select('id'))
            ->when($forClient, fn ($q) => $q->visibleToClient())->pluck('id');
        $updates = $forClient ? $project->updates()->published()->pluck('id') : $project->updates()->pluck('id');
        $approvals = $forClient ? $project->approvals()->visibleToClient()->pluck('id') : $project->approvals()->pluck('id');

        return CoreAttachment::query()
            ->where(fn ($q) => $q
                ->where(fn ($m) => $m->where('attachable_type', (new ProjectThreadMessage())->getMorphClass())->whereIn('attachable_id', $messages))
                ->orWhere(fn ($u) => $u->where('attachable_type', (new ProjectUpdate())->getMorphClass())->whereIn('attachable_id', $updates))
                ->orWhere(fn ($a) => $a->where('attachable_type', (new ProjectApproval())->getMorphClass())->whereIn('attachable_id', $approvals)))
            ->with('attachable')
            ->orderByDesc('id')
            ->get()
            ->each(function (CoreAttachment $file) {
                if ($file->attachable instanceof ProjectThreadMessage) {
                    $file->attachable->loadMissing('thread:id,subject');
                }
            });
    }
}
