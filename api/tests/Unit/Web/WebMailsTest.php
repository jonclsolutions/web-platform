<?php

/**
 * @file WebMailsTest.php
 * @path api/tests/Unit/Web/WebMailsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the web e-mails: subject and rendered content of the raw
 *   request confirmation, the sales order confirmation, the project thread notification of the
 *   team and the update notification of a client account (cz / en), the access e-mail of a
 *   client account (invitation / sign-in code) and the team notification (assigned thread / decision).
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; resources/views/emails/web.
 */

namespace Tests\Unit\Web;

use App\Mail\Web\ProjectAccessMail;
use App\Mail\Web\ProjectClientUpdateMail;
use App\Mail\Web\ProjectTeamNotificationMail;
use App\Mail\Web\ProjectThreadActivityMail;
use App\Mail\Web\WebRawRequestCommissionReceived;
use App\Mail\Web\WebSalesOrderReceived;
use App\Support\Mail\SalesOrderEmailTemplate;
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

    /**
     * @description The project notification distinguishes a new thread from a new message and
     *   links to the admin thread list on the frontend.
     * @input Project 'Eshop', thread 'Logo colours'; frontend https://admin.example.com/.
     * @output Subjects 'New request — Eshop: Logo colours' / 'New message — …'; HTML contains
     *   https://admin.example.com/admin/web/projects/{id}, the subject and the English texts
     *   (no Czech leftovers, finding #10).
     */
    public function test_project_thread_notification(): void
    {
        config(['app.frontend_url' => 'https://admin.example.com/']);
        $project = $this->project(['name' => 'Eshop']);
        $thread = $this->thread($project);

        $new = new ProjectThreadActivityMail($project, $thread, true);
        $new->assertHasSubject('New request — Eshop: Logo colours');
        $html = $new->render();
        $this->assertStringContainsString("https://admin.example.com/admin/web/projects/{$project->id}", $html);
        $this->assertStringContainsString('Logo colours', $html);
        $this->assertStringContainsString('The customer started a new thread:', $html);
        $this->assertStringContainsString('Open in the administration', $html);
        $this->assertStringNotContainsString('Zákazník', $html);

        $reply = new ProjectThreadActivityMail($project, $thread, false);
        $reply->assertHasSubject('New message — Eshop: Logo colours');
        $this->assertStringContainsString('The customer wrote a new message in the thread:', $reply->render());
    }

    /**
     * @description Client notification in the account's language: reply / checkpoint subject and
     *   texts, the portal link with the project token, the item title - never a message text.
     * @input Project 'Eshop'; account cz: reply 'Logo colours'; account en: checkpoint 'Launch' → done.
     * @output 'Nová odpověď v projektu Eshop' + "Dodavatel odpověděl" + /projects/{token};
     *   'Progress update in the project Eshop' + 'changed its status to "Done"' + 'Launch', lang en.
     */
    public function test_project_client_update(): void
    {
        config(['app.frontend_url' => 'https://www.example.com/']);
        $project = $this->project(['name' => 'Eshop']);
        $cz = $project->accounts()->sole();
        $en = $this->portalAccount($project, 'anna', 'Anna', ['language' => 'en']);

        $reply = new ProjectClientUpdateMail($project, $cz, ProjectClientUpdateMail::KIND_REPLY, 'Logo colours');
        $reply->assertHasSubject('Nová odpověď v projektu Eshop');
        $html = $reply->render();
        $this->assertStringContainsString('Dodavatel odpověděl ve vlákně:', $html);
        $this->assertStringContainsString('Logo colours', $html);
        $this->assertStringContainsString("https://www.example.com/projects/{$project->access_token}", $html);

        $step = new ProjectClientUpdateMail($project, $en, ProjectClientUpdateMail::KIND_CHECKPOINT, 'Launch', 'done');
        $step->assertHasSubject('Progress update in the project Eshop');
        $html = $step->render();
        $this->assertStringContainsString('A project step changed its status to &quot;Done&quot;:', $html);
        $this->assertStringContainsString('Launch', $html);
        $this->assertStringContainsString('lang="en"', $html);
        $this->assertStringNotContainsString('Dodavatel', $html);
    }

    /**
     * @description Access e-mails: an invitation (cz, link valid 7 days, login name, no code) and a
     *   sign-in code (en, code shown big, one-time link valid 15 minutes), both with the warning.
     * @input Project 'Eshop' (token t0k); account klient (cz) invite link L1; account anna (en)
     *   code 123456, link L2.
     * @output Subjects 'Pozvánka do portálu projektu Eshop' / 'Sign-in code for the portal of the
     *   project Eshop'; links /projects/t0k?access=L1|L2; '7 dní', 'klient'; '123456', '15 minutes'.
     */
    public function test_project_access_mail(): void
    {
        config(['app.frontend_url' => 'https://www.example.com']);
        $project = $this->project(['name' => 'Eshop', 'access_token' => 't0k']);
        $klient = $project->accounts()->sole();
        $anna = $this->portalAccount($project, 'anna', 'Anna', ['language' => 'en']);

        $invite = new ProjectAccessMail($project, $klient, ProjectAccessMail::KIND_INVITE, 'L1', null, 7 * 24 * 60);
        $invite->assertHasSubject('Pozvánka do portálu projektu Eshop');
        $html = $invite->render();
        $this->assertStringContainsString('https://www.example.com/projects/t0k?access=L1', $html);
        $this->assertStringContainsString('7 dní', $html);
        $this->assertStringContainsString('klient', $html);
        $this->assertStringContainsString('e-mail ignorujte', $html);

        $login = new ProjectAccessMail($project, $anna, ProjectAccessMail::KIND_LOGIN, 'L2', '123456', 15);
        $login->assertHasSubject('Sign-in code for the portal of the project Eshop');
        $html = $login->render();
        $this->assertStringContainsString('123456', $html);
        $this->assertStringContainsString('?access=L2', $html);
        $this->assertStringContainsString('15 minutes', $html);
        $this->assertStringContainsString('lang="en"', $html);
    }

    /**
     * @description Team notifications: an assigned thread and both client decisions, each linking
     *   to its section of the project in the administration.
     * @input Project 'Eshop'; thread 'Hosting' assigned by 'Jana'; approval 'Logo' approved / changes.
     * @output Subjects 'Thread assigned to you — Eshop' / 'Approved — Eshop: Logo' / 'Changes requested — Eshop: Logo';
     *   links …/conversations and …/approvals.
     */
    public function test_project_team_notification(): void
    {
        config(['app.frontend_url' => 'https://admin.example.com']);
        $project = $this->project(['name' => 'Eshop']);

        $assigned = new ProjectTeamNotificationMail($project, ProjectTeamNotificationMail::KIND_THREAD_ASSIGNED, 'Hosting', 'Jana');
        $assigned->assertHasSubject('Thread assigned to you — Eshop');
        $this->assertStringContainsString("https://admin.example.com/admin/web/projects/{$project->id}/conversations", $assigned->render());
        $this->assertStringContainsString('Jana assigned you this thread:', $assigned->render());

        (new ProjectTeamNotificationMail($project, ProjectTeamNotificationMail::KIND_APPROVAL_DECIDED, 'Logo', 'approved'))->assertHasSubject('Approved — Eshop: Logo');
        $changes = new ProjectTeamNotificationMail($project, ProjectTeamNotificationMail::KIND_APPROVAL_DECIDED, 'Logo', 'changes_requested');
        $changes->assertHasSubject('Changes requested — Eshop: Logo');
        $this->assertStringContainsString("/admin/web/projects/{$project->id}/approvals", $changes->render());
        $this->assertStringContainsString('The client requested changes to:', $changes->render());
    }
}
