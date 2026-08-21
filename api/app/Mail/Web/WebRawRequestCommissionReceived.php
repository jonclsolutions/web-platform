<?php
/**
 * @file WebRawRequestCommissionReceived.php
 * @path app/Mail/Web/WebRawRequestCommissionReceived.php
 * @project RPSW Web
 * @description Confirmation email sent to the customer after submitting a public commission request.
 * @refactor-note (2026-08-19) BACKLOG "hezčí a přehlednější maily": šablona přepracována
 * (viz emails/web/raw-request-commission-received.blade.php) a doplněna o firemní
 * kontakt v patičce - `content()` teď předává `CompanyContactInfo::get()` přes
 * `Content::with()`, stejně jako auth maily (PasswordResetRequested apod.).
 */

namespace App\Mail\Web;

use App\Models\Web\WebRawRequestCommission;
use App\Support\Mail\CompanyContactInfo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WebRawRequestCommissionReceived extends Mailable
{
use Queueable, SerializesModels;

public function __construct(
public WebRawRequestCommission $requestCommission
    ) {}

public function envelope(): Envelope
    {
return new Envelope(
subject: 'Vaše poptávka byla přijata – ' . $this->requestCommission->thema,
        );
    }

public function content(): Content
    {
return new Content(
view: 'emails.web.raw-request-commission-received',
with: CompanyContactInfo::get(),
        );
    }

public function attachments(): array
    {
return [];
    }
}