<?php
/**
 * @file WebRawRequestCommissionReceived.php
 * @path app/Apps/Web/Mail/WebRawRequestCommissionReceived.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Confirmation e-mail sent to the customer after submitting a public commission request.
 * @note The result of `forLang()` is memoized in `template()`: `envelope()` and `content()` both
 * need it, without memoization `WebSiteSetting::first()` would be queried twice per e-mail.
 */

namespace App\Apps\Web\Mail;

use App\Apps\Web\Models\WebRawRequestCommission;
use App\Support\Mail\CompanyContactInfo;
use App\Apps\Web\Support\RawRequestEmailTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WebRawRequestCommissionReceived extends Mailable
{
    use Queueable, SerializesModels;

    /** @var array|null Memoized result of RawRequestEmailTemplate::forLang() (see the file header). */
    private ?array $resolvedTemplate = null;

    public function __construct(
        public WebRawRequestCommission $requestCommission
    ) {}

    /**
     * @description Subject: the subject of the template + the name of the topic (not its slug).
     */
    public function envelope(): Envelope
    {
        $tpl = $this->template();

        return new Envelope(
            subject: $tpl['emailSubject'] . ' – ' . $this->themaLabel(),
        );
    }

    /**
     * @description Body: company contacts, the template texts and the name of the topic
     *   (`$emailThema`).
     */
    public function content(): Content
    {
        return new Content(
            view: 'web::emails.raw-request-commission-received',
            with: array_merge(
                CompanyContactInfo::get(),
                $this->template(),
                ['emailThema' => $this->themaLabel()]
            ),
        );
    }

    public function attachments(): array
    {
        return [];
    }

    /**
     * @description Name of the topic in the language of the request (see
     *   RawRequestEmailTemplate::themaLabel()).
     */
    private function themaLabel(): string
    {
        return RawRequestEmailTemplate::themaLabel($this->requestCommission->thema, $this->requestCommission->lang);
    }

    /**
     * @description Returns (and computes the first time) the template content for the language of
     * this record - memoized, see the file header.
     */
    private function template(): array
    {
        return $this->resolvedTemplate ??= RawRequestEmailTemplate::forLang($this->requestCommission->lang);
    }
}
