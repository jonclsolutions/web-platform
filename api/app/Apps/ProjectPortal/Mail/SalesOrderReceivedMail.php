<?php
/**
 * @file SalesOrderReceivedMail.php
 * @path app/Apps/ProjectPortal/Mail/SalesOrderReceivedMail.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Confirmation e-mail sent to the client after submitting a sales order, in the
 * language of the page the order was sent from (VT-15) - texts from SalesOrderEmailTemplate,
 * built like the other confirmation e-mails (shared look of the e-mail views).
 * @dependencies
 * - SalesOrderEmailTemplate: texts of the language; CompanyContactInfo: footer.
 */

namespace App\Apps\ProjectPortal\Mail;

use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Support\Mail\CompanyContactInfo;
use App\Apps\ProjectPortal\Support\SalesOrderEmailTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SalesOrderReceivedMail extends Mailable
{
use Queueable, SerializesModels;

/** @var array|null Memoized result of SalesOrderEmailTemplate::forLang() - envelope and content need it. */
private ?array $resolvedTemplate = null;

public function __construct(
public SalesOrder $order
    ) {}

public function envelope(): Envelope
    {
return new Envelope(
subject: $this->template()['emailSubject'],
        );
    }

public function content(): Content
    {
return new Content(
view: 'project-portal::emails.sales-order-received',
with: array_merge(CompanyContactInfo::get(), $this->template()),
        );
    }

public function attachments(): array
    {
return [];
    }

/**
 * @description Template texts of the order's language (computed once).
 * @return array<string, string>
 */
private function template(): array
    {
return $this->resolvedTemplate ??= SalesOrderEmailTemplate::forLang($this->order->lang);
    }
}
