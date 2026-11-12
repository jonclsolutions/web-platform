<?php
/**
 * @file ProjectClientUpdateMail.php
 * @path app/Mail/Web/ProjectClientUpdateMail.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notification to a client account that something changed in the project portal: a
 *   new reply of the supplier in a thread, a checkpoint changed its status, a checkpoint got a
 *   new / changed / removed due date, an update was published, an approval is requested. Sent only for the kinds the client turned on in the portal
 *   (WebProjectAccount::NOTIFICATIONS). In the account's language (cz / en, built-in texts).
 * @note Contains only the project name, the title of the item (thread, checkpoint, update,
 *   approval) and a link to its section of the portal - never the text of a message / update (a sensitive message is not copied into a mailbox).
 * @dependencies emails.web.project-client-update, CompanyContactInfo (footer)
 */

namespace App\Mail\Web;

use App\Models\Web\WebProject;
use App\Models\Web\WebProjectAccount;
use App\Support\Mail\CompanyContactInfo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProjectClientUpdateMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @description What happened: a new reply in a thread / a checkpoint changed its status. */
    public const KIND_REPLY = 'reply';
    public const KIND_CHECKPOINT = 'checkpoint';
    public const KIND_CHECKPOINT_DATE = 'checkpoint_date';
    public const KIND_UPDATE = 'update';
    public const KIND_APPROVAL = 'approval';

    /** @description Section of the portal the button opens, per kind. */
    private const SECTIONS = [
        self::KIND_REPLY           => 'threads',
        self::KIND_CHECKPOINT      => 'checkpoints',
        self::KIND_CHECKPOINT_DATE => 'checkpoints',
        self::KIND_UPDATE          => 'updates',
        self::KIND_APPROVAL        => 'approvals',
    ];

    /**
     * @description Built-in texts per language. {project}, {status} and {date} are replaced.
     */
    private const TEXTS = [
        'cz' => [
            'subject_reply'      => 'Nová odpověď v projektu {project}',
            'subject_checkpoint' => 'Změna postupu v projektu {project}',
            'intro_reply'        => 'Dodavatel odpověděl ve vlákně:',
            'intro_checkpoint'   => 'Krok projektu změnil stav na „{status}“:',
            'subject_checkpoint_date' => 'Změna termínu v projektu {project}',
            'intro_checkpoint_date'   => 'Krok projektu má nový termín {date}:',
            'intro_checkpoint_date_removed' => 'U kroku projektu byl zrušen termín:',
            'subject_update'     => 'Nová aktualita v projektu {project}',
            'intro_update'       => 'Dodavatel zveřejnil aktualitu:',
            'subject_approval'   => 'Prosíme o schválení v projektu {project}',
            'intro_approval'     => 'Dodavatel vás žádá o schválení:',
            'button'             => 'Otevřít portál projektu',
            'outro'              => 'Tato upozornění jste si zapnuli v portálu projektu. Vypnete je tamtéž v části Můj účet.',
            'status_new'         => 'Nezahájeno',
            'status_active'      => 'Rozpracováno',
            'status_done'        => 'Hotovo',
        ],
        'en' => [
            'subject_reply'      => 'New reply in the project {project}',
            'subject_checkpoint' => 'Progress update in the project {project}',
            'intro_reply'        => 'The supplier replied in the thread:',
            'intro_checkpoint'   => 'A project step changed its status to "{status}":',
            'subject_checkpoint_date' => 'Date change in the project {project}',
            'intro_checkpoint_date'   => 'A project step has a new due date {date}:',
            'intro_checkpoint_date_removed' => 'The due date of a project step was removed:',
            'subject_update'     => 'New update in the project {project}',
            'intro_update'       => 'The supplier published an update:',
            'subject_approval'   => 'Your approval is requested in the project {project}',
            'intro_approval'     => 'The supplier asks for your approval:',
            'button'             => 'Open the project portal',
            'outro'              => 'You turned these notifications on in the project portal. Turn them off there in My account.',
            'status_new'         => 'Not started',
            'status_active'      => 'In progress',
            'status_done'        => 'Done',
        ],
    ];

    /**
     * @param WebProject $project Project of the change.
     * @param WebProjectAccount $account Recipient account (language).
     * @param string $kind KIND_REPLY | KIND_CHECKPOINT | KIND_CHECKPOINT_DATE | KIND_UPDATE | KIND_APPROVAL.
     * @param string $itemTitle Thread subject / checkpoint title.
     * @param string|null $status New checkpoint status (KIND_CHECKPOINT).
     * @param string|null $dueDate New due date Y-m-d, null = removed (KIND_CHECKPOINT_DATE).
     */
    public function __construct(
        public readonly WebProject $project,
        public readonly WebProjectAccount $account,
        public readonly string $kind,
        public readonly string $itemTitle,
        public readonly ?string $status = null,
        public readonly ?string $dueDate = null,
    ) {}

    /**
     * @description Texts of the account's language ('cz' when unknown).
     * @return array<string, string>
     */
    private function languageTexts(): array
    {
        return self::TEXTS[$this->account->language] ?? self::TEXTS['cz'];
    }

    /**
     * @description Replaces the placeholders of a text.
     * @param string $key Text key.
     * @return string
     */
    private function localized(string $key): string
    {
        $texts = $this->languageTexts();

        return strtr($texts[$key], [
            '{project}' => $this->project->name,
            '{status}'  => $texts['status_' . $this->status] ?? (string) $this->status,
            '{date}'    => $this->formattedDueDate(),
        ]);
    }

    /**
     * @description The new due date in the account's language (24. 12. 2026 / 12/24/2026).
     * @return string
     */
    private function formattedDueDate(): string
    {
        if (!$this->dueDate) {
            return '';
        }
        $date = \Illuminate\Support\Carbon::parse($this->dueDate);

        return $this->account->language === 'en' ? $date->format('n/j/Y') : $date->format('j. n. Y');
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->localized('subject_' . $this->kind));
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.web.project-client-update',
            with: array_merge(CompanyContactInfo::get(), [
                'emailHtmlLang' => $this->account->language === 'en' ? 'en' : 'cs',
                'projectName'   => $this->project->name,
                'intro'         => $this->localized('intro_' . $this->kind
                    . ($this->kind === self::KIND_CHECKPOINT_DATE && !$this->dueDate ? '_removed' : '')),
                'itemTitle'     => $this->itemTitle,
                'buttonText'    => $this->localized('button'),
                'outro'         => $this->localized('outro'),
                'portalUrl'     => rtrim((string) config('app.frontend_url', ''), '/') . '/projects/' . $this->project->access_token
                    . '?section=' . (self::SECTIONS[$this->kind] ?? 'overview'),
            ]),
        );
    }
}
