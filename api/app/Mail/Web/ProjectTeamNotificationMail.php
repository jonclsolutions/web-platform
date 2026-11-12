<?php
/**
 * @file ProjectTeamNotificationMail.php
 * @path app/Mail/Web/ProjectTeamNotificationMail.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Internal notification to an administrator about the client portal (English, like
 *   the other team e-mails):
 *   - KIND_THREAD_ASSIGNED: a colleague assigned a thread to them;
 *   - KIND_APPROVAL_DECIDED: the client approved an approval request / requested changes.
 *   Only the title of the item, the decision and a link to the project in the administration -
 *   never a message text or the client's comment.
 * @dependencies emails.web.project-team-notification
 */

namespace App\Mail\Web;

use App\Models\Web\WebProject;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProjectTeamNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public const KIND_THREAD_ASSIGNED = 'thread_assigned';
    public const KIND_APPROVAL_DECIDED = 'approval_decided';

    /** @description Section of the project page in the administration, per kind. */
    private const SECTIONS = [
        self::KIND_THREAD_ASSIGNED  => 'conversations',
        self::KIND_APPROVAL_DECIDED => 'approvals',
    ];

    /**
     * @param WebProject $project Project of the item.
     * @param string $kind KIND_THREAD_ASSIGNED | KIND_APPROVAL_DECIDED.
     * @param string $itemTitle Thread subject / approval title.
     * @param string|null $detail Who assigned the thread / the decision (approved | changes_requested).
     */
    public function __construct(
        public readonly WebProject $project,
        public readonly string $kind,
        public readonly string $itemTitle,
        public readonly ?string $detail = null,
    ) {}

    /**
     * @description Subject and introduction of the kind.
     * @return array{0: string, 1: string}
     */
    private function texts(): array
    {
        if ($this->kind === self::KIND_THREAD_ASSIGNED) {
            return ["Thread assigned to you — {$this->project->name}", $this->detail ? "{$this->detail} assigned you this thread:" : 'You were assigned this thread:'];
        }
        $approved = $this->detail === 'approved';

        return [
            ($approved ? 'Approved' : 'Changes requested') . " — {$this->project->name}: {$this->itemTitle}",
            $approved ? 'The client approved:' : 'The client requested changes to:',
        ];
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->texts()[0]);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.web.project-team-notification',
            with: [
                'projectName' => $this->project->name,
                'intro'       => $this->texts()[1],
                'itemTitle'   => $this->itemTitle,
                'adminUrl'    => rtrim((string) config('app.frontend_url', ''), '/') . '/admin/web/projects/' . $this->project->id
                    . '/' . (self::SECTIONS[$this->kind] ?? 'overview'),
            ],
        );
    }
}
