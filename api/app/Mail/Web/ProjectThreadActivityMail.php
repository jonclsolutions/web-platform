<?php
/**
 * @file ProjectThreadActivityMail.php
 * @path app/Mail/Web/ProjectThreadActivityMail.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Notifikace na `web_projects.contact_email` (e-mail připnutý k
 * projektu, NE zákazníkovo vlastní kontaktní pole - viz backlog "informovat o
 * aktivitě zákazníka ve vlákně, protože admin panel se nekontroluje denně")
 * - odesílá se při KAŽDÉ zákaznické aktivitě ve vlákně: založení nového vlákna i
 * každá další odpověď v "ping-pongu", bez debounce. Pokud `contact_email` na
 * projektu chybí, e-mail se prostě nevytváří (viz volající kód v
 * WebProjectPublicController).
 * @note Obsahuje ZÁMĚRNĚ jen téma vlákna a odkaz do administrace, NE text zprávy
 * samotné - kdyby zákazník napsal něco citlivého, nechceme to duplikovat do
 * e-mailové schránky (horší kontrola nad mazáním/šifrováním než v databázi).
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