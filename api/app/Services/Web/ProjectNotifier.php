<?php
/**
 * @file ProjectNotifier.php
 * @path app/Services/Web/ProjectNotifier.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description E-mails of the client project portal, both directions:
 *   - notifyTeam(): client activity in a thread → the responsible administrator (assignee), else
 *     the project's contact e-mail;
 *   - notifyClients(): a supplier reply / a checkpoint status change / a checkpoint due date change
 *     → every client account of the project that turned that kind on in the portal
 *     (WebProjectAccount::NOTIFICATIONS, all off by default) and has an e-mail.
 *   Queued; a failure to queue is reported and never breaks the request that caused it.
 * @note No message text is ever sent - only the thread subject / checkpoint title and a link.
 * @dependencies ProjectThreadActivityMail, ProjectClientUpdateMail, Mail (queue)
 */

namespace App\Services\Web;

use App\Mail\Web\ProjectClientUpdateMail;
use App\Mail\Web\ProjectThreadActivityMail;
use App\Models\Web\WebProject;
use App\Models\Web\WebProjectAccount;
use App\Models\Web\WebProjectThread;
use Illuminate\Support\Facades\Mail;

class ProjectNotifier
{
    /**
     * @description Client activity in a thread (new thread / new message) → the team.
     * @param WebProject $project Project of the thread.
     * @param WebProjectThread $thread The thread.
     * @param bool $isNewThread The client opened the thread (else wrote a message).
     * @return void
     */
    public function notifyTeam(WebProject $project, WebProjectThread $thread, bool $isNewThread): void
    {
        $recipient = $project->assignee?->user_email ?: $project->contact_email;
        if (empty($recipient)) {
            return;
        }

        try {
            Mail::to($recipient)->queue(new ProjectThreadActivityMail($project, $thread, $isNewThread));
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * @description A change for the client → every client account of the project that turned this
     *   kind of notification on and has an e-mail.
     * @param WebProject $project Project of the change.
     * @param string $kind ProjectClientUpdateMail::KIND_REPLY | KIND_CHECKPOINT | KIND_CHECKPOINT_DATE.
     * @param string $itemTitle Thread subject / checkpoint title.
     * @param string|null $status New checkpoint status (KIND_CHECKPOINT).
     * @param string|null $dueDate New due date, null = removed (KIND_CHECKPOINT_DATE).
     * @return int Number of queued e-mails.
     */
    public function notifyClients(WebProject $project, string $kind, string $itemTitle, ?string $status = null, ?string $dueDate = null): int
    {
        $column = WebProjectAccount::NOTIFICATIONS[$kind] ?? null;
        if ($column === null) {
            return 0;
        }
        $accounts = $project->accounts()->where($column, true)->whereNotNull('email')->where('email', '!=', '')->get();
        $queued = 0;

        foreach ($accounts as $account) {
            try {
                Mail::to($account->email)->queue(new ProjectClientUpdateMail($project, $account, $kind, $itemTitle, $status, $dueDate));
                $queued++;
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return $queued;
    }
}
