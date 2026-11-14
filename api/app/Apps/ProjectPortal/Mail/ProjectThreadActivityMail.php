<?php
/**
 * @file ProjectThreadActivityMail.php
 * @path app/Apps/ProjectPortal/Mail/ProjectThreadActivityMail.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notification to the team on EVERY customer activity in a thread - a new thread and
 * every reply, no debounce: to the administrator responsible for the project (`assignee`), else
 * to `project_portal_projects.contact_email` (the supplier's contact of the project); without either no
 * e-mail is created (ProjectNotifier::notifyTeam()). The button opens the project page.
 * @note Contains only the thread subject and a link to the admin, NOT the message text - a
 * sensitive message is not copied into a mailbox.
 * @dependencies project-portal::emails.project-thread-activity; CompanyContactInfo (footer)
 */

namespace App\Apps\ProjectPortal\Mail;

use App\Apps\ProjectPortal\Models\Project;
use App\Support\Mail\CompanyContactInfo;
use App\Apps\ProjectPortal\Models\ProjectThread;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProjectThreadActivityMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Project $project,
        public readonly ProjectThread $thread,
        public readonly bool $isNewThread
    ) {}

    public function envelope(): Envelope
    {
        $subjectPrefix = $this->isNewThread ? 'New request' : 'New message';

        return new Envelope(
            subject: "{$subjectPrefix} — {$this->project->name}: {$this->thread->subject}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'project-portal::emails.project-thread-activity',
            with: array_merge(CompanyContactInfo::get(), [
                'projectName'  => $this->project->name,
                'threadSubject' => $this->thread->subject,
                'isNewThread'  => $this->isNewThread,
                // The conversations of the project in the administration.
                'adminUrl'     => rtrim(config('app.frontend_url', ''), '/') . '/admin/project-portal/projects/' . $this->project->id . '/conversations',
            ]),
        );
    }
}