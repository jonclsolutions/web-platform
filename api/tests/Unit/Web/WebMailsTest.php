<?php

/**
 * @file WebMailsTest.php
 * @path api/tests/Unit/Web/WebMailsTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the web e-mails: subject and rendered content of the raw
 *   request confirmation, the sales order confirmation and the project thread notification.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; resources/views/emails/web.
 */

namespace Tests\Unit\Web;

use App\Mail\Web\ProjectThreadActivityMail;
use App\Mail\Web\WebRawRequestCommissionReceived;
use App\Mail\Web\WebSalesOrderReceived;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description App\Mail\Web\*.
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
     * @description The sales order confirmation has a fixed subject and repeats the order data.
     * @input Sales order of 'Acme s.r.o.'.
     * @output Subject 'Your inquiry has been received.'; HTML contains client name and e-mail.
     */
    public function test_sales_order_confirmation(): void
    {
        $order = $this->salesOrder();

        $mail = new WebSalesOrderReceived($order->load('attachments'));
        $html = $mail->render();

        $mail->assertHasSubject('Your inquiry has been received.');
        $this->assertStringContainsString('Acme s.r.o.', $html);
        $this->assertStringContainsString($order->client_email, $html);
        $this->assertSame([], $mail->attachments());
    }

    /**
     * @description The project notification distinguishes a new thread from a new message and
     *   links to the admin thread list on the frontend.
     * @input Project 'Eshop', thread 'Logo colours'; frontend https://admin.example.com/.
     * @output Subjects 'New request — Eshop: Logo colours' / 'New message — …'; HTML contains
     *   https://admin.example.com/admin/web/project-threads and the subject.
     */
    public function test_project_thread_notification(): void
    {
        config(['app.frontend_url' => 'https://admin.example.com/']);
        $project = $this->project(['name' => 'Eshop']);
        $thread = $this->thread($project);

        $new = new ProjectThreadActivityMail($project, $thread, true);
        $new->assertHasSubject('New request — Eshop: Logo colours');
        $html = $new->render();
        $this->assertStringContainsString('https://admin.example.com/admin/web/project-threads', $html);
        $this->assertStringContainsString('Logo colours', $html);

        (new ProjectThreadActivityMail($project, $thread, false))->assertHasSubject('New message — Eshop: Logo colours');
    }
}
