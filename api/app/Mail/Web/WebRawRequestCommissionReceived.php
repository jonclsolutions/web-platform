<?php
/**
 * @file WebRawRequestCommissionReceived.php
 * @path app/Mail/Web/WebRawRequestCommissionReceived.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Confirmation e-mail sent to the customer after submitting a public commission request.
 * @note The result of `forLang()` is memoized in `template()`: `envelope()` and `content()` both
 * need it, without memoization `WebSiteSetting::first()` would be queried twice per e-mail.
 */

namespace App\Mail\Web;

use App\Models\Web\WebRawRequestCommission;
use App\Support\Mail\CompanyContactInfo;
use App\Support\Mail\RawRequestEmailTemplate;
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

public function envelope(): Envelope
    {
$tpl = $this->template();

return new Envelope(
subject: $tpl['emailSubject'] . ' – ' . $this->requestCommission->thema,
        );
    }

public function content(): Content
    {
return new Content(
view: 'emails.web.raw-request-commission-received',
with: array_merge(
    CompanyContactInfo::get(),
    $this->template()
),
        );
    }

public function attachments(): array
    {
return [];
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