<?php
/**
 * @file WebSalesOrderReceived.php
 * @path app/Mail/Web/WebSalesOrderReceived.php
 * @project RPSW Web
 * @description Confirmation email sent to the client after submitting a sales order (realizace) request.
 * @refactor-note (2026-08-19) BACKLOG "hezčí a přehlednější maily": šablona přepracována
 * (viz emails/web/sales-order-received.blade.php) a doplněna o firemní kontakt
 * v patičce - `content()` teď předává `CompanyContactInfo::get()` přes `Content::with()`,
 * stejně jako auth maily a WebRawRequestCommissionReceived.
 */

namespace App\Mail\Web;

use App\Models\Web\WebSalesOrder;
use App\Support\Mail\CompanyContactInfo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WebSalesOrderReceived extends Mailable
{
use Queueable, SerializesModels;

public function __construct(
public WebSalesOrder $order
    ) {}

public function envelope(): Envelope
    {
return new Envelope(
subject: 'Vaše poptávka byla přijata',
        );
    }

public function content(): Content
    {
return new Content(
view: 'emails.web.sales-order-received',
with: CompanyContactInfo::get(),
        );
    }

public function attachments(): array
    {
return [];
    }
}