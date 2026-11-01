<?php
/**
 * @file ProjectThreadActivityMail.php
 * @path app/Mail/Web/ProjectThreadActivityMail.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notification to `web_projects.contact_email` (the e-mail of the project, not a
 * field of the customer) on EVERY customer activity in a thread - a new thread and every reply,
 * no debounce. Without `contact_email` on the project no e-mail is created (see
 * WebProjectPublicController).
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
                'adminUrl'     => rtrim(config('app.frontend_url', ''), '/') . '/admin/web/project-threads',
            ],
        );
    }
}