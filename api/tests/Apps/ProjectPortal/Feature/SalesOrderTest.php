<?php

/**
 * @file SalesOrderTest.php
 * @path api/tests/Apps/ProjectPortal/Feature/SalesOrderTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the sales orders (SalesOrderController): the public order
 *   form (with or without a one-time lead link, attachments, confirmation e-mail, rate limit)
 *   and the admin list / edit / delete / trash.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures; Storage / Mail fakes.
 */

namespace Tests\Apps\ProjectPortal\Feature;

use App\Apps\ProjectPortal\Mail\SalesOrderReceivedMail;
use App\Apps\ProjectPortal\Models\SalesOrder;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description POST /api/project-portal/public/sales-orders and /api/project-portal/sales_orders.
 */
class SalesOrderTest extends TestCase
{
    use ProjectFixtures;

    /** @var string[] All sales order permissions. */
    private const ALL = ['project-portal-sales-orders-view', 'project-portal-sales-orders-create', 'project-portal-sales-orders-update', 'project-portal-sales-orders-delete'];

    /**
     * @description Fake attachment disk.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        $this->fakeCaptcha();
    }

    /**
     * @description A valid order form body.
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'client_name' => 'Acme s.r.o.', 'client_email' => 'order@acme.cz', 'order_description' => 'An e-shop',
            'dataProcessingAgreement' => '1', 'tosAgreement' => '1',
        ] + $this->captcha(), $overrides);
    }

    /**
     * @description Without a lead link the order is stored with the agreements, the default
     *   salesman text and its attachments; the confirmation e-mail is queued.
     * @input POST /api/project-portal/public/sales-orders with one attachment.
     * @output 201 {salesman_name 'Order without a lead', agreements true, 1 attachment}; mail queued.
     */
    public function test_public_order_without_lead(): void
    {
        Mail::fake();

        $this->post('/api/project-portal/public/sales-orders', $this->payload(['attachments' => [$this->upload('spec.pdf')]]), ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.salesman_name', 'Order without a lead')
            ->assertJsonPath('data.data_processing_agreement', true)
            ->assertJsonPath('data.tos_agreement', true)
            ->assertJsonCount(1, 'data.attachments');

        Mail::assertQueued(SalesOrderReceivedMail::class, fn ($mail) => $mail->hasTo('order@acme.cz'));
        $this->assertPortalLog('create', 'Created sales order for: Acme s.r.o.');
    }

    /**
     * @description With a lead link the order is bound to the lead, takes over its salesman,
     *   marks the link as used and moves the lead status; the link works once only.
     * @input Lead (salesman Petr) with token T; POST with lead_token T twice; POST with an unknown token.
     * @output 201 {lead_id, salesman 'Petr'}; lead status 'Inquiry form submitted', token used;
     *   then 410 and 404 (logged as rejected).
     */
    public function test_public_order_with_one_time_lead_link(): void
    {
        Mail::fake();
        $lead = $this->lead(['public_token' => 'lead-token', 'salesman_name' => 'Petr']);

        $this->postJson('/api/project-portal/public/sales-orders', $this->payload(['lead_token' => 'lead-token']))
            ->assertCreated()->assertJsonPath('data.lead_id', $lead->id)->assertJsonPath('data.salesman_name', 'Petr');
        $lead->refresh();
        $this->assertSame('Inquiry form submitted', $lead->status);
        $this->assertNotNull($lead->public_token_used_at);

        $this->postJson('/api/project-portal/public/sales-orders', $this->payload(['lead_token' => 'lead-token']))
            ->assertStatus(410)->assertJsonPath('message', 'This form has already been submitted once and the link cannot be used again.');
        $this->postJson('/api/project-portal/public/sales-orders', $this->payload(['lead_token' => 'unknown']))
            ->assertStatus(404)->assertJsonPath('message', 'The link is invalid or has expired.');
        $this->assertSame(1, SalesOrder::count());
        $this->assertPortalLog('error', 'rejected (token)');
    }

    /**
     * @description The public form ignores a `lead_id` (no existence check that could be used to
     *   probe lead ids, finding #2) - only the lead_token binds an order to a lead.
     * @input POST with lead_id of an existing lead; POST with an unknown lead_id 999999.
     * @output both 201 with lead_id null (same answer for existing / unknown ids).
     */
    public function test_public_order_ignores_lead_id(): void
    {
        Mail::fake();
        $lead = $this->lead();
        $this->postJson('/api/project-portal/public/sales-orders', $this->payload(['lead_id' => $lead->id]))->assertCreated()->assertJsonPath('data.lead_id', null);
        $this->postJson('/api/project-portal/public/sales-orders', $this->payload(['lead_id' => 999999]))->assertCreated()->assertJsonPath('data.lead_id', null);
    }

    /**
     * @description Validation: agreements required, attachment type and count; SVG (it can carry a
     *   script) is not accepted any more.
     * @input POST without agreements and with an .exe attachment; valid POST with an SVG attachment.
     * @output 422 dataProcessingAgreement, tosAgreement, attachments.0; 422 attachments.0, nothing stored.
     */
    public function test_public_order_validation(): void
    {
        $this->post('/api/project-portal/public/sales-orders', [
            'client_name' => 'A', 'client_email' => 'a@b.cz', 'order_description' => 'x', 'attachments' => [$this->upload('x.exe', 1, 'application/octet-stream')],
        ] + $this->captcha(), ['Accept' => 'application/json'])->assertStatus(422)
            ->assertJsonValidationErrors(['dataProcessingAgreement', 'tosAgreement', 'attachments.0']);

        $this->post('/api/project-portal/public/sales-orders', $this->payload(['attachments' => [$this->uploadWithContent('logo.svg', self::SVG_XSS)]]), ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors(['attachments.0']);
        $this->assertSame(0, SalesOrder::count());
    }

    /**
     * @description A failing e-mail is logged, a database error answers 500.
     * @input Mailer broken + valid POST; then sales orders INSERT fails.
     * @output 201 + portal log 'error' "Failed to send confirmation email"; 500 "Sales order creation failed.".
     */
    public function test_public_order_mail_and_database_errors(): void
    {
        $this->breakMailer();
        $this->postJson('/api/project-portal/public/sales-orders', $this->payload())->assertCreated();
        $this->assertPortalLog('error', 'Failed to send confirmation email');

        $this->failOn('project_portal_sales_orders', 'INSERT');
        $this->postJson('/api/project-portal/public/sales-orders', $this->payload())->assertStatus(500)->assertJson(['message' => 'Sales order creation failed.']);
    }

    /**
     * @description Admin list: permission, search, filters, trash, export (logged), the lead; no
     *   project data (the project portal finds the project of an order itself).
     * @input A (lead L, ico 123, yesterday), B ('Beta', salesman Karel), C trashed.
     * @output Each filter returns the expected order; lead of A; no project_id key.
     */
    public function test_admin_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/project-portal/sales_orders')->assertStatus(403);

        $this->signIn($this->userWith(['project-portal-sales-orders-view']));
        $lead = $this->lead();
        $a = $this->salesOrder(['lead_id' => $lead->id, 'ico' => '123']);
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $b = $this->salesOrder(['client_name' => 'Beta', 'salesman_name' => 'Karel', 'client_email' => 'x@beta.cz']);
        $this->salesOrder(['client_name' => 'Gone'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/project-portal/sales_orders?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$b->id], $ids('search=Karel'));
        $this->assertSame([$a->id], $ids("lead_id={$lead->id}"));
        $this->assertSame([$a->id], $ids('ico=123'));
        $this->assertSame([$b->id], $ids('client_email=beta'));
        $this->assertSame([$a->id], $ids('created_at=' . now()->subDay()->toDateString()));
        $this->assertSame(['Gone'], array_column($this->getJson('/api/project-portal/sales_orders?only_trashed=1')->json('data'), 'client_name'));
        $this->getJson("/api/project-portal/sales_orders?id={$a->id}")->assertJsonPath('data.0.lead.id', $lead->id)->assertJsonMissingPath('data.0.project_id');
        $this->assertCount(2, $this->getJson('/api/project-portal/sales_orders?no_pagination=1')->json('data'));
        $this->assertPortalLog('export', 'Bulk export of sales orders.');
    }

    /**
     * @description Detail, edit (attachments added), 404s, database errors.
     * @input Order: GET; PUT {client_name, attachments: [a.pdf]}; PUT /999; failing UPDATE.
     * @output 200; 200 with the new attachment; 404; 500.
     */
    public function test_show_and_update(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $order = $this->salesOrder();

        $this->getJson("/api/project-portal/sales_orders/{$order->id}")->assertOk()->assertJsonPath('data.client_name', 'Acme s.r.o.');
        $this->getJson('/api/project-portal/sales_orders/999')->assertStatus(404);
        $this->post("/api/project-portal/sales_orders/{$order->id}", ['_method' => 'PUT', 'client_name' => 'Acme 2', 'attachments' => [$this->upload('a.pdf')]], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.client_name', 'Acme 2')->assertJsonCount(1, 'data.attachments');
        $this->assertPortalLog('update', "Updated sales order ID: {$order->id}");
        $this->putJson('/api/project-portal/sales_orders/999', ['client_name' => 'x'])->assertStatus(404);

        $this->failOn('project_portal_sales_orders', 'UPDATE');
        $this->putJson("/api/project-portal/sales_orders/{$order->id}", ['client_name' => 'Boom'])->assertStatus(500)->assertJson(['message' => 'Sales order update failed.']);
    }

    /**
     * @description Delete (permanent removes files), bulk delete, restore, empty trash,
     *   404s and database errors.
     * @input Orders A, B (attachment), C, D (attachment, trashed); actions in sequence; failures.
     * @output As expected; files deleted.
     */
    public function test_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        [$a, $b, $c, $d] = [$this->salesOrder(), $this->salesOrder(), $this->salesOrder(), $this->salesOrder()];
        $this->attach($b, 'web/sales_orders/b.pdf');
        $this->attach($c, 'web/sales_orders/c.pdf');
        $this->attach($d, 'web/sales_orders/d.pdf');

        $this->deleteJson("/api/project-portal/sales_orders/{$a->id}")->assertNoContent();
        $this->deleteJson("/api/project-portal/sales_orders/{$b->id}?force_delete=1")->assertNoContent();
        Storage::disk('private')->assertMissing('web/sales_orders/b.pdf');
        $this->deleteJson('/api/project-portal/sales_orders/999')->assertStatus(404);
        $this->postJson("/api/project-portal/sales_orders/{$a->id}/restore")->assertOk();
        $this->postJson('/api/project-portal/sales_orders/999/restore')->assertStatus(404);
        $this->postJson('/api/project-portal/sales_orders/bulk-delete', ['ids' => [$a->id, 999]])->assertOk()->assertJsonPath('data.deleted_count', 1);
        $this->postJson('/api/project-portal/sales_orders/bulk-delete', ['ids' => array_merge([$c->id], range(3000, 3060)), 'force_delete' => true])->assertOk();
        Storage::disk('private')->assertMissing('web/sales_orders/c.pdf');
        $this->postJson('/api/project-portal/sales_orders/bulk-delete', [])->assertStatus(422);
        $d->delete();
        $this->deleteJson('/api/project-portal/sales_orders/force-delete-all')->assertNoContent();
        Storage::disk('private')->assertMissing('web/sales_orders/d.pdf');
        $this->assertSame(0, SalesOrder::onlyTrashed()->count());

        $e = $this->salesOrder();
        $f = $this->salesOrder();
        $f->delete();
        $this->failOn('project_portal_sales_orders', 'UPDATE');
        $this->deleteJson("/api/project-portal/sales_orders/{$e->id}")->assertStatus(500);
        $this->postJson('/api/project-portal/sales_orders/bulk-delete', ['ids' => [$e->id]])->assertStatus(500);
        $this->postJson("/api/project-portal/sales_orders/{$f->id}/restore")->assertStatus(500);
        $this->failOn('project_portal_sales_orders', 'DELETE');
        $this->deleteJson('/api/project-portal/sales_orders/force-delete-all')->assertStatus(500);
    }

    /**
     * @description The reminder of orders without a project needs the project view AND the
     *   orders; a project of an order removes the order from it.
     * @input Orders A, B; project of A; account with the projects only; account with the projects
     *   and the orders.
     * @output Projects only: no reminder; with the orders: count 1, link of the orders.
     */
    public function test_orders_without_a_project(): void
    {
        $a = $this->salesOrder();
        $this->salesOrder(['client_name' => 'Beta']);
        $this->project(['order_id' => $a->id]);
        $range = '/api/core/agenda?from=' . now()->toDateString() . '&to=' . now()->addDays(10)->toDateString();

        $this->signIn($this->userWith(['view-project-portal', 'web-projects-view']));
        $this->assertSame([], $this->getJson($range)->assertOk()->json('data.reminders'));

        $this->signIn($this->userWith(['view-project-portal', 'web-projects-view', 'project-portal-sales-orders-view']));
        $reminder = collect($this->getJson($range)->assertOk()->json('data.reminders'))->firstWhere('type', 'orders_without_project');
        $this->assertSame([1, 'project-portal', '/admin/project-portal/sales-orders'], [$reminder['count'], $reminder['module'], $reminder['link']]);
    }

    /**
     * @description The project of an order: the list filters by the order and names the lead and
     *   the order; an order belongs to one project only; unknown ids are refused.
     * @input Lead + order; project A of the order, project B; PUT B with the order of A; PUT A
     *   with its own order; POST with unknown ids.
     * @output order_id filter = [A]; lead_id / order_id of A; 422 order_id; 200; 422 order_id + lead_id.
     */
    public function test_project_of_an_order(): void
    {
        $this->signIn($this->userWith(['web-projects-view', 'web-projects-create', 'web-projects-update']));
        $lead = $this->lead();
        $order = $this->salesOrder(['lead_id' => $lead->id]);
        $a = $this->project(['lead_id' => $lead->id, 'order_id' => $order->id]);
        $b = $this->project();

        $this->assertSame([$a->id], array_column($this->getJson("/api/project-portal/projects?order_id={$order->id}")->json('data'), 'id'));
        $this->getJson("/api/project-portal/projects?id={$a->id}")
            ->assertJsonPath('data.0.lead_id', $lead->id)
            ->assertJsonPath('data.0.order_id', $order->id);
        $this->putJson("/api/project-portal/projects/{$b->id}", ['order_id' => $order->id])->assertStatus(422)->assertJsonValidationErrors(['order_id']);
        $this->putJson("/api/project-portal/projects/{$a->id}", ['order_id' => $order->id])->assertOk();
        $this->postJson('/api/project-portal/projects', ['name' => 'X', 'visibility' => 'public', 'order_id' => 999, 'lead_id' => 999])
            ->assertStatus(422)->assertJsonValidationErrors(['order_id', 'lead_id']);
    }
}
