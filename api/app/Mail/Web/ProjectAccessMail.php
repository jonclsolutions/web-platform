<?php
/**
 * @file ProjectAccessMail.php
 * @path app/Mail/Web/ProjectAccessMail.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Access e-mail of a client account of the project portal, in the account's
 *   language (cz / en, built-in texts):
 *   - KIND_INVITE: invitation sent by the administration - the project, the login name and a
 *     one-time sign-in link valid 7 days (later sign-ins: password or "send me a code");
 *   - KIND_LOGIN: a sign-in requested by the client - a 6-digit code and a one-time link, valid
 *     15 minutes.
 * @security The code / link are one-time (WebProjectLoginCode) and never stored in plaintext;
 *   the e-mail says what to do when the client did not ask for it.
 * @dependencies emails.web.project-access, CompanyContactInfo (footer)
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

class ProjectAccessMail extends Mailable
{
    use Queueable, SerializesModels;

    public const KIND_INVITE = 'invite';
    public const KIND_LOGIN = 'login';

    /** @description Built-in texts; {project}, {name}, {username}, {minutes}, {days} are replaced. */
    private const TEXTS = [
        'cz' => [
            'subject_invite' => 'Pozvánka do portálu projektu {project}',
            'intro_invite'   => 'Dobrý den {name}, byli jste pozváni do portálu projektu {project}. Zde sledujete postup, schvalujete výstupy a komunikujete s námi.',
            'button_invite'  => 'Otevřít portál a přihlásit se',
            'note_invite'    => 'Odkaz platí {days} dní a lze ho použít jednou. Vaše přihlašovací jméno je {username}. Příště se přihlásíte jednorázovým kódem, který si necháte poslat na tento e-mail, nebo heslem, pokud vám ho dodavatel nastavil.',
            'subject_login'  => 'Přihlašovací kód do portálu projektu {project}',
            'intro_login'    => 'Dobrý den {name}, váš přihlašovací kód do portálu projektu {project} je:',
            'button_login'   => 'Přihlásit se jedním kliknutím',
            'note_login'     => 'Kód i odkaz platí {minutes} minut a lze je použít jen jednou.',
            'outro'          => 'Pokud jste o nic nežádali, e-mail ignorujte – bez kódu nebo odkazu se k vašemu účtu nikdo nepřihlásí. Kód nikomu nesdělujte.',
        ],
        'en' => [
            'subject_invite' => 'Invitation to the portal of the project {project}',
            'intro_invite'   => 'Hello {name}, you were invited to the portal of the project {project}. Here you follow the progress, approve deliverables and talk to us.',
            'button_invite'  => 'Open the portal and sign in',
            'note_invite'    => 'The link is valid for {days} days and works once. Your login name is {username}. Next time sign in with a one-time code sent to this e-mail, or with a password if the supplier set one for you.',
            'subject_login'  => 'Sign-in code for the portal of the project {project}',
            'intro_login'    => 'Hello {name}, your sign-in code for the portal of the project {project} is:',
            'button_login'   => 'Sign in with one click',
            'note_login'     => 'The code and the link are valid for {minutes} minutes and work only once.',
            'outro'          => 'If you did not ask for anything, ignore this e-mail – nobody can sign in to your account without the code or the link. Never share the code.',
        ],
    ];

    /**
     * @param WebProject $project Project of the portal.
     * @param WebProjectAccount $account Recipient account (language, name).
     * @param string $kind KIND_INVITE | KIND_LOGIN.
     * @param string $link Plaintext one-time link token.
     * @param string|null $code Plaintext 6-digit code (KIND_LOGIN).
     * @param int $validMinutes Validity of the code / link.
     */
    public function __construct(
        public readonly WebProject $project,
        public readonly WebProjectAccount $account,
        public readonly string $kind,
        public readonly string $link,
        public readonly ?string $code,
        public readonly int $validMinutes,
    ) {}

    /**
     * @description Text of the account's language with the placeholders replaced.
     * @param string $key Text key.
     * @return string
     */
    private function localized(string $key): string
    {
        $texts = self::TEXTS[$this->account->language] ?? self::TEXTS['cz'];

        return strtr($texts[$key], [
            '{project}'  => $this->project->name,
            '{name}'     => $this->account->display_name,
            '{username}' => $this->account->username,
            '{minutes}'  => (string) $this->validMinutes,
            '{days}'     => (string) intdiv($this->validMinutes, 24 * 60),
        ]);
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->localized('subject_' . $this->kind));
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.web.project-access',
            with: array_merge(CompanyContactInfo::get(), [
                'emailHtmlLang' => $this->account->language === 'en' ? 'en' : 'cs',
                'projectName'   => $this->project->name,
                'intro'         => $this->localized('intro_' . $this->kind),
                'code'          => $this->code,
                'buttonText'    => $this->localized('button_' . $this->kind),
                'note'          => $this->localized('note_' . $this->kind),
                'outro'         => $this->localized('outro'),
                'accessUrl'     => rtrim((string) config('app.frontend_url', ''), '/') . '/projects/' . $this->project->access_token
                    . '?access=' . $this->link,
            ]),
        );
    }
}
