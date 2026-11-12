<?php
/**
 * @file ProjectFiles.php
 * @path app/Services/Web/ProjectFiles.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Every file of a project, newest first: attachments of thread messages, of
 *   updates and of approval requests. For the client only what it may see: no internal notes,
 *   no drafts of updates, no cancelled approval requests.
 * @dependencies WebAttachment, WebProjectThreadMessage, WebProjectUpdate, WebProjectApproval
 */

namespace App\Services\Web;

use App\Models\Web\{WebAttachment, WebProject, WebProjectApproval, WebProjectThreadMessage, WebProjectUpdate};
use Illuminate\Support\Collection;

class ProjectFiles
{
    /**
     * @description Files of the project with their source loaded (`attachable`, a message with its thread).
     * @param WebProject $project
     * @param bool $forClient Only what the client may see.
     * @return Collection<int, WebAttachment>
     */
    public function of(WebProject $project, bool $forClient): Collection
    {
        $messages = WebProjectThreadMessage::whereIn('thread_id', $project->threads()->select('id'))
            ->when($forClient, fn ($q) => $q->visibleToClient())->pluck('id');
        $updates = $forClient ? $project->updates()->published()->pluck('id') : $project->updates()->pluck('id');
        $approvals = $forClient ? $project->approvals()->visibleToClient()->pluck('id') : $project->approvals()->pluck('id');

        return WebAttachment::query()
            ->where(fn ($q) => $q
                ->where(fn ($m) => $m->where('attachable_type', WebProjectThreadMessage::class)->whereIn('attachable_id', $messages))
                ->orWhere(fn ($u) => $u->where('attachable_type', WebProjectUpdate::class)->whereIn('attachable_id', $updates))
                ->orWhere(fn ($a) => $a->where('attachable_type', WebProjectApproval::class)->whereIn('attachable_id', $approvals)))
            ->with('attachable')
            ->orderByDesc('id')
            ->get()
            ->each(function (WebAttachment $file) {
                if ($file->attachable instanceof WebProjectThreadMessage) {
                    $file->attachable->loadMissing('thread:id,subject');
                }
            });
    }
}
