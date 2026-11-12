<?php
/**
 * @file ProjectThreadActivityMail.php
 * @path app/Mail/Web/ProjectThreadActivityMail.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notification to the team on EVERY customer activity in a thread - a new thread and
 * every reply, no debounce: to the administrator responsible for the project (`assignee`), else
 * to `web_projects.contact_email` (the supplier's contact of the project); without either no
 * e-mail is created (ProjectNotifier::notifyTeam()). The button opens the project page.
 * @note Contains only the thread subject and a link to the admin, NOT the message text - a
 * sensitive message is not copied into a mailbox.
 */

namespace App\Mail\Web;

use App\Models\Web\WebProject;
use App\Models\Web\WebProjectThread;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProjectThreadActivityMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly WebProject $project,
        public readonly WebProjectThread $thread,
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
            view: 'emails.web.project-thread-activity',
            with: [
                'projectName'  => $this->project->name,
                'threadSubject' => $this->thread->subject,
                'isNewThread'  => $this->isNewThread,
                // The conversations of the project in the administration.
                'adminUrl'     => rtrim(config('app.frontend_url', ''), '/') . '/admin/web/projects/' . $this->project->id . '/conversations',
            ],
        );
    }
}