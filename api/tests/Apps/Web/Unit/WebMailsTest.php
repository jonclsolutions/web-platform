<?php

/**
 * @file WebMailsTest.php
 * @path api/tests/Apps/Web/Unit/WebMailsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the web e-mails: subject and rendered content of the raw
 *   request confirmation and the sales order confirmation.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Web\Support\WebFixtures; views web::emails.*.
 */

namespace Tests\Apps\Web\Unit;

use App\Apps\Web\Mail\WebRawRequestCommissionReceived;
use App\Apps\Web\Mail\WebSalesOrderReceived;
use App\Apps\Web\Support\SalesOrderEmailTemplate;
use Tests\Apps\Web\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description App\Apps\Web\Mail\*.
 */
class WebMailsTest extends TestCase
{
    use WebFixtures;

    /**
     * @description The raw request confirmation uses the template texts (default subject
     *   without settings) plus the topic, and lists the request data and attachment names.
     * @input Raw request 'Website redesign' with attachment brief.pdf, no site settings.
     * @output Subject 'Your request has been received – Website redesign'; HTML contains e-mail,
     *   description and brief.pdf; no attachments on the mail itself.
     */
    public function test_raw_request_confirmation(): void
    {
        $request = $this->rawRequest();
        $request->attachments()->create(['disk' => 'private', 'path' => 'web/x/brief.pdf', 'original_filename' => 'brief.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => 1]);

        $mail = new WebRawRequestCommissionReceived($request->load('attachments'));
        $html = $mail->render();

        $mail->assertHasSubject('Your request has been received – Website redesign');
        $this->assertStringContainsString('client@example.com', $html);
        $this->assertStringContainsString('We need a new website.', $html);
        $this->assertStringContainsString('brief.pdf', $html);
        $this->assertSame([], $mail->attachments());
    }

    /**
     * @description Without a stored template the sales order confirmation uses the built-in
     *   default subject and repeats the order data.
     * @input Sales order of 'Acme s.r.o.', no site settings.
     * @output Subject SalesOrderEmailTemplate default; HTML contains client name and e-mail.
     */
    public function test_sales_order_confirmation(): void
    {
        $order = $this->salesOrder();

        $mail = new WebSalesOrderReceived($order->load('attachments'));
        $html = $mail->render();

        $mail->assertHasSubject(SalesOrderEmailTemplate::DEFAULTS['subject']);
        $this->assertStringContainsString('Acme s.r.o.', $html);
        $this->assertStringContainsString($order->client_email, $html);
        $this->assertSame([], $mail->attachments());
    }
}
