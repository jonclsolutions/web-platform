<?php
/**
 * @file WebSalesOrderReceived.php
 * @path app/Mail/Web/WebSalesOrderReceived.php
 * @project RPSW Web
 * @description Confirmation email sent to the client after submitting a sales order (realizace) request.
 */

namespace App\Mail\Web;

use App\Models\Web\WebSalesOrder;
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
        );
    }

    public function attachments(): array
    {
        return [];
    }
}