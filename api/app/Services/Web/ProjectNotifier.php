<?php
/**
 * @file ProjectNotifier.php
 * @path app/Services/Web/ProjectNotifier.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description E-mails of the client project portal, both directions:
 *   - notifyTeam(): client activity in a thread → the administrator of the thread (thread
 *     assignee), else of the project (project assignee), else the project's contact e-mail;
 *   - notifyThreadAssigned() / notifyApprovalDecided(): a thread assigned to an administrator,
 *     a client decision on an approval → the team;
 *   - sendAccess(): an invitation / a requested sign-in code → the client account (sent at once,
 *     not queued - the client waits for it);
 *   - notifyClients(): a supplier reply / a checkpoint status change / a checkpoint due date change
 *     → every client account of the project that turned that kind on in the portal
 *     (WebProjectAccount::NOTIFICATIONS, all off by default) and has an e-mail.
 *   Queued; a failure to queue is reported and never breaks the request that caused it.
 * @note No message text is ever sent - only the thread subject / checkpoint title and a link.
 * @dependencies ProjectThreadActivityMail, ProjectClientUpdateMail, Mail (queue)
 */

namespace App\Services\Web;

use App\Mail\Web\ProjectAccessMail;
use App\Mail\Web\ProjectClientUpdateMail;
use App\Mail\Web\ProjectTeamNotificationMail;
use App\Mail\Web\ProjectThreadActivityMail;
use App\Models\User;
use App\Models\Web\WebProject;
use App\Models\Web\WebProjectApproval;
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
        $recipient = $this->teamRecipient($project, $thread);
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
     * @description Who in the team hears about a thread: its assignee, else the project's assignee,
     *   else the project's contact e-mail (blocked administrators are skipped).
     * @param WebProject $project Project.
     * @param WebProjectThread|null $thread Thread, if the matter belongs to one.
     * @return string|null E-mail address.
     */
    public function teamRecipient(WebProject $project, ?WebProjectThread $thread = null): ?string
    {
        foreach ([$thread?->assignee, $project->assignee] as $user) {
            if ($user && !$user->is_blocked && !empty($user->user_email)) {
                return $user->user_email;
            }
        }

        return $project->contact_email ?: null;
    }

    /**
     * @description A thread was assigned to an administrator by a colleague → e-mail to them (not
     *   when they assigned it to themselves, nor to a blocked account).
     * @param WebProject $project Project of the thread.
     * @param WebProjectThread $thread The thread.
     * @param User $assignee New assignee.
     * @param User|null $by Who assigned it.
     * @return bool Whether an e-mail was queued.
     */
    public function notifyThreadAssigned(WebProject $project, WebProjectThread $thread, User $assignee, ?User $by): bool
    {
        if (($by && $by->id === $assignee->id) || $assignee->is_blocked || empty($assignee->user_email)) {
            return false;
        }

        return $this->queueSafely($assignee->user_email,
            new ProjectTeamNotificationMail($project, ProjectTeamNotificationMail::KIND_THREAD_ASSIGNED, $thread->subject, $by?->full_name));
    }

    /**
     * @description The client decided on an approval → e-mail to the project's assignee (else its
     *   contact e-mail).
     * @param WebProject $project Project.
     * @param WebProjectApproval $approval The approval.
     * @param string $decision approved | changes_requested.
     * @return bool Whether an e-mail was queued.
     */
    public function notifyApprovalDecided(WebProject $project, WebProjectApproval $approval, string $decision): bool
    {
        $recipient = $this->teamRecipient($project);

        return $recipient !== null && $this->queueSafely($recipient,
            new ProjectTeamNotificationMail($project, ProjectTeamNotificationMail::KIND_APPROVAL_DECIDED, $approval->title, $decision));
    }

    /**
     * @description Sends an access e-mail (invitation / sign-in code) at once.
     * @param WebProject $project Project of the portal.
     * @param WebProjectAccount $account Recipient account (must have an e-mail).
     * @param string $kind ProjectAccessMail::KIND_*.
     * @param array{code: string|null, link: string} $issued Plaintext code / link (WebProjectLoginCode::issue()).
     * @param int $validMinutes Validity.
     * @return bool Whether the e-mail was handed over to the mailer.
     */
    public function sendAccess(WebProject $project, WebProjectAccount $account, string $kind, array $issued, int $validMinutes): bool
    {
        if (!$account->hasEmail()) {
            return false;
        }
        try {
            Mail::to($account->email)->send(new ProjectAccessMail($project, $account, $kind, $issued['link'], $issued['code'], $validMinutes));

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }

    /**
     * @description Queues an e-mail; a failure is reported, never thrown.
     * @param string $to Recipient.
     * @param \Illuminate\Mail\Mailable $mail E-mail.
     * @return bool
     */
    private function queueSafely(string $to, \Illuminate\Mail\Mailable $mail): bool
    {
        try {
            Mail::to($to)->queue($mail);

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }

    /**
     * @description A change for the client → every client account of the project that turned this
     *   kind of notification on and has an e-mail.
     * @param WebProject $project Project of the change.
     * @param string $kind ProjectClientUpdateMail::KIND_* (reply, checkpoint, checkpoint_date, update, approval).
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
