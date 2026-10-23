<?php

/**
 * @file SalesOrderTest.php
 * @path api/tests/Feature/Web/SalesOrderTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the sales orders (WebSalesOrderController): the public order
 *   form (with or without a one-time lead link, attachments, confirmation e-mail, rate limit)
 *   and the admin list / edit / delete / trash.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage / Mail fakes.
 */

namespace Tests\Feature\Web;

use App\Mail\Web\WebSalesOrderReceived;
use App\Models\Web\WebSalesOrder;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description POST /api/sales_orders and /api/web/sales_orders.
 */
class SalesOrderTest extends TestCase
{
    use WebFixtures;

    /** @var string[] All sales order permissions. */
    private const ALL = ['web-sales-orders-view', 'web-sales-orders-create', 'web-sales-orders-update', 'web-sales-orders-delete'];

    /**
     * @description Fake attachment disk.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
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
        ], $overrides);
    }

    /**
     * @description Without a lead link the order is stored with the agreements, the default
     *   salesman text and its attachments; the confirmation e-mail is queued.
     * @input POST /api/sales_orders with one attachment.
     * @output 201 {salesman_name 'Web inquiry (without lead)', agreements true, 1 attachment}; mail queued.
     */
    public function test_public_order_without_lead(): void
    {
        Mail::fake();

        $this->post('/api/sales_orders', $this->payload(['attachments' => [$this->upload('spec.pdf')]]), ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('salesman_name', 'Web inquiry (without lead)')
            ->assertJsonPath('data_processing_agreement', true)
            ->assertJsonPath('tos_agreement', true)
            ->assertJsonCount(1, 'attachments');

        Mail::assertQueued(WebSalesOrderReceived::class, fn ($mail) => $mail->hasTo('order@acme.cz'));
        $this->assertWebLog('create', 'Created sales order for: Acme s.r.o.');
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

        $this->postJson('/api/sales_orders', $this->payload(['lead_token' => 'lead-token']))
            ->assertCreated()->assertJsonPath('lead_id', $lead->id)->assertJsonPath('salesman_name', 'Petr');
        $lead->refresh();
        $this->assertSame('Inquiry form submitted', $lead->status);
        $this->assertNotNull($lead->public_token_used_at);

        $this->postJson('/api/sales_orders', $this->payload(['lead_token' => 'lead-token']))
            ->assertStatus(410)->assertJsonPath('message', 'This form has already been submitted once and the link cannot be used again.');
        $this->postJson('/api/sales_orders', $this->payload(['lead_token' => 'unknown']))
            ->assertStatus(404)->assertJsonPath('message', 'The link is invalid or has expired.');
        $this->assertSame(1, WebSalesOrder::count());
        $this->assertWebLog('error', 'rejected (token)');
    }

    /**
     * @description Validation: agreements required, attachment type and count.
     * @input POST without agreements and with an .exe attachment.
     * @output 422 dataProcessingAgreement, tosAgreement, attachments.0.
     */
    public function test_public_order_validation(): void
    {
        $this->post('/api/sales_orders', [
            'client_name' => 'A', 'client_email' => 'a@b.cz', 'order_description' => 'x', 'attachments' => [$this->upload('x.exe', 1, 'application/octet-stream')],
        ], ['Accept' => 'application/json'])->assertStatus(422)
            ->assertJsonValidationErrors(['dataProcessingAgreement', 'tosAgreement', 'attachments.0']);
    }

    /**
     * @description A failing e-mail is logged, a database error answers 500.
     * @input Mailer broken + valid POST; then sales orders INSERT fails.
     * @output 201 + web log 'error' "Failed to send confirmation email"; 500 "Sales order creation failed.".
     */
    public function test_public_order_mail_and_database_errors(): void
    {
        $this->breakMailer();
        $this->postJson('/api/sales_orders', $this->payload())->assertCreated();
        $this->assertWebLog('error', 'Failed to send confirmation email');

        $this->failOn('web_sales_orders', 'INSERT');
        $this->postJson('/api/sales_orders', $this->payload())->assertStatus(500)->assertJson(['message' => 'Sales order creation failed.']);
    }

    /**
     * @description Admin list: permission, search, filters, trash, export (logged), project id.
     * @input A (lead L, ico 123, yesterday, has a project), B ('Beta', salesman Karel), C trashed.
     * @output Each filter returns the expected order; project_id of A is set.
     */
    public function test_admin_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/web/sales_orders')->assertStatus(403);

        $this->signIn($this->userWith(['web-sales-orders-view']));
        $lead = $this->lead();
        $a = $this->salesOrder(['lead_id' => $lead->id, 'ico' => '123']);
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $project = $this->project(['order_id' => $a->id]);
        $b = $this->salesOrder(['client_name' => 'Beta', 'salesman_name' => 'Karel', 'client_email' => 'x@beta.cz']);
        $this->salesOrder(['client_name' => 'Gone'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/web/sales_orders?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$b->id], $ids('search=Karel'));
        $this->assertSame([$a->id], $ids("lead_id={$lead->id}"));
        $this->assertSame([$a->id], $ids('ico=123'));
        $this->assertSame([$b->id], $ids('client_email=beta'));
        $this->assertSame([$a->id], $ids('created_at=' . now()->subDay()->toDateString()));
        $this->assertSame(['Gone'], array_column($this->getJson('/api/web/sales_orders?only_trashed=1')->json('data'), 'client_name'));
        $this->getJson("/api/web/sales_orders?id={$a->id}")->assertJsonPath('data.0.project_id', $project->id)->assertJsonPath('data.0.lead.id', $lead->id);
        $this->assertCount(2, $this->getJson('/api/web/sales_orders?no_pagination=1')->json('data'));
        $this->assertWebLog('export', 'Bulk export of sales orders.');
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

        $this->getJson("/api/web/sales_orders/{$order->id}")->assertOk()->assertJsonPath('client_name', 'Acme s.r.o.');
        $this->getJson('/api/web/sales_orders/999')->assertStatus(404);
        $this->post("/api/web/sales_orders/{$order->id}", ['_method' => 'PUT', 'client_name' => 'Acme 2', 'attachments' => [$this->upload('a.pdf')]], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('client_name', 'Acme 2')->assertJsonCount(1, 'attachments');
        $this->assertWebLog('update', "Updated sales order ID: {$order->id}");
        $this->putJson('/api/web/sales_orders/999', ['client_name' => 'x'])->assertStatus(404);

        $this->failOn('web_sales_orders', 'UPDATE');
        $this->putJson("/api/web/sales_orders/{$order->id}", ['client_name' => 'Boom'])->assertStatus(500)->assertJson(['message' => 'Sales order update failed.']);
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

        $this->deleteJson("/api/web/sales_orders/{$a->id}")->assertNoContent();
        $this->deleteJson("/api/web/sales_orders/{$b->id}?force_delete=1")->assertNoContent();
        Storage::disk('private')->assertMissing('web/sales_orders/b.pdf');
        $this->deleteJson('/api/web/sales_orders/999')->assertStatus(404);
        $this->postJson("/api/web/sales_orders/{$a->id}/restore")->assertOk();
        $this->postJson('/api/web/sales_orders/999/restore')->assertStatus(404);
        $this->postJson('/api/web/sales_orders/bulk-delete', ['ids' => [$a->id, 999]])->assertOk()->assertJsonPath('data.deleted_count', 1);
        $this->postJson('/api/web/sales_orders/bulk-delete', ['ids' => array_merge([$c->id], range(3000, 3060)), 'force_delete' => true])->assertOk();
        Storage::disk('private')->assertMissing('web/sales_orders/c.pdf');
        $this->postJson('/api/web/sales_orders/bulk-delete', [])->assertStatus(422);
        $d->delete();
        $this->deleteJson('/api/web/sales_orders/force-delete-all')->assertNoContent();
        Storage::disk('private')->assertMissing('web/sales_orders/d.pdf');
        $this->assertSame(0, WebSalesOrder::onlyTrashed()->count());

        $e = $this->salesOrder();
        $f = $this->salesOrder();
        $f->delete();
        $this->failOn('web_sales_orders', 'UPDATE');
        $this->deleteJson("/api/web/sales_orders/{$e->id}")->assertStatus(500);
        $this->postJson('/api/web/sales_orders/bulk-delete', ['ids' => [$e->id]])->assertStatus(500);
        $this->postJson("/api/web/sales_orders/{$f->id}/restore")->assertStatus(500);
        $this->failOn('web_sales_orders', 'DELETE');
        $this->deleteJson('/api/web/sales_orders/force-delete-all')->assertStatus(500);
    }
}
