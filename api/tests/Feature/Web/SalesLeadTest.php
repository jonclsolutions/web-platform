<?php

/**
 * @file SalesLeadTest.php
 * @path api/tests/Feature/Web/SalesLeadTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the sales leads (WebSalesLeadController): list, create with
 *   the salesman from the signed-in account, validated edit, delete / restore / trash, the
 *   order form link and the public lookup by token.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures.
 */

namespace Tests\Feature\Web;

use App\Models\Core\CoreSecurityEvent;
use App\Http\Resources\Web\WebSalesLeadResource;
use App\Models\Web\WebSalesLead;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description /api/web/sales_leads and GET /api/public/sales-leads/{token}.
 */
class SalesLeadTest extends TestCase
{
    use WebFixtures;

    /** @var string[] All sales lead permissions. */
    private const ALL = ['web-sales-leads-view', 'web-sales-leads-create', 'web-sales-leads-update', 'web-sales-leads-delete'];

    /**
     * @description A valid create payload.
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge(['subject_name' => 'Acme', 'source_channel' => 'referral', 'priority' => 'high', 'status' => 'new'], $overrides);
    }

    /**
     * @description List: permission, search, exact and partial filters, dates, sorting, trash, export.
     * @input A (Acme / Praha / high / referral / last contact 2026-10-01), B (Beta, yesterday), C trashed.
     * @output Each filter returns the expected lead; export logged.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/web/sales_leads')->assertStatus(403);

        $this->signIn($this->userWith(['web-sales-leads-view']));
        $a = $this->lead(['subject_name' => 'Acme', 'location' => 'Praha', 'priority' => 'high', 'source_channel' => 'referral', 'last_contact_date' => '2026-10-01']);
        $b = $this->lead(['subject_name' => 'Beta', 'salesman_name' => 'Karel', 'contact_email' => 'b@beta.cz']);
        $b->forceFill(['created_at' => now()->subDay()])->save();
        $this->lead(['subject_name' => 'Gone'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/web/sales_leads?{$q}")->json('data'), 'id');
        $this->assertSame([$a->id, $b->id], $ids('sort_direction=nope'));
        $this->assertSame([$b->id, $a->id], $ids('sort_direction=asc'));
        $this->assertSame([$a->id], $ids('search=Praha'));
        $this->assertSame([$a->id], $ids('priority=high'));
        $this->assertSame([$a->id], $ids('source_channel=referral'));
        $this->assertSame([$b->id], $ids('salesman_name=Kar'));
        $this->assertSame([$b->id], $ids('contact_email=beta'));
        $this->assertSame([$b->id], $ids('created_at=' . now()->subDay()->toDateString()));
        $this->assertSame([$a->id], $ids('last_contact_date=2026-10-01'));
        $this->assertSame(['Gone'], array_column($this->getJson('/api/web/sales_leads?only_trashed=1')->json('data'), 'subject_name'));
        $this->getJson('/api/web/sales_leads?per_page=1')->assertJson(['meta' => ['total' => 2, 'last_page' => 2]]);
        $this->getJson('/api/web/sales_leads?no_pagination=1')->assertOk()->assertJsonCount(2, 'data');
        $this->assertWebLog('export', 'Bulk export of sales leads.');
    }

    /**
     * @description Create: the salesman and owner default to the signed-in account; given
     *   values win; validation; database error.
     * @input Creator Petr: POST valid; POST with salesman_name 'Other'; POST invalid; failing INSERT.
     * @output 201 salesman 'Petr' + user_id; 201 'Other'; 422; 500.
     */
    public function test_store(): void
    {
        $me = $this->signIn($this->userWith(['web-sales-leads-create'], ['full_name' => 'Petr']));

        $this->postJson('/api/web/sales_leads', $this->payload())->assertCreated()
            ->assertJsonPath('data.salesman_name', 'Petr')->assertJsonPath('data.user_id', $me->id)
            ->assertJsonPath('data.salesman.name', 'Petr');
        $this->postJson('/api/web/sales_leads', $this->payload(['salesman_name' => 'Other']))->assertCreated()->assertJsonPath('data.salesman_name', 'Other');
        $this->assertWebLog('create', 'Created new lead: Acme');
        $this->postJson('/api/web/sales_leads', ['subject_name' => 'A', 'source_channel' => 'tv'])
            ->assertStatus(422)->assertJsonValidationErrors(['subject_name', 'source_channel', 'priority', 'status']);

        $this->failOn('web_sales_leads', 'INSERT');
        $this->postJson('/api/web/sales_leads', $this->payload())->assertStatus(500)->assertJson(['message' => 'Lead creation failed.']);
    }

    /**
     * @description Edit is validated (only known statuses / channels, existing user) - nothing
     *   unvalidated reaches the record; detail includes trashed; 404; database error.
     * @input Lead: PUT {status: closed_won, next_step}; PUT {status: hacked, user_id: 999};
     *        PUT {public_token: 'x'} (not editable); GET; PUT /999; failure.
     * @output 200; 422 (status, user_id); token unchanged; 200; 404; 500.
     */
    public function test_show_and_validated_update(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $lead = $this->lead();

        $this->putJson("/api/web/sales_leads/{$lead->id}", ['status' => 'closed_won', 'next_step' => 'Invoice'])
            ->assertOk()->assertJsonPath('data.status', 'closed_won')->assertJsonPath('data.next_step', 'Invoice');
        $this->assertWebLog('update', "Updated lead ID: {$lead->id}");
        $this->putJson("/api/web/sales_leads/{$lead->id}", ['status' => 'hacked', 'user_id' => 999])
            ->assertStatus(422)->assertJsonValidationErrors(['status', 'user_id']);
        $this->putJson("/api/web/sales_leads/{$lead->id}", ['public_token' => 'stolen'])->assertOk();
        $this->assertNull($lead->fresh()->public_token);

        $lead->delete();
        $this->getJson("/api/web/sales_leads/{$lead->id}")->assertOk()->assertJsonPath('data.deleted_at', fn ($v) => $v !== null);
        $this->getJson('/api/web/sales_leads/999')->assertStatus(404);
        $this->putJson('/api/web/sales_leads/999', ['next_step' => 'x'])->assertStatus(404);

        $other = $this->lead();
        $this->failOn('web_sales_leads', 'UPDATE');
        $this->putJson("/api/web/sales_leads/{$other->id}", ['next_step' => 'Boom'])->assertStatus(500)->assertJson(['message' => 'Lead update failed.']);
    }

    /**
     * @description Delete, bulk delete, restore, empty trash, 404s and database errors.
     * @input Leads A, B, C; actions in sequence; then failing writes.
     * @output As expected.
     */
    public function test_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        [$a, $b, $c] = [$this->lead(), $this->lead(), $this->lead()];

        $this->deleteJson("/api/web/sales_leads/{$a->id}")->assertNoContent();
        $this->deleteJson("/api/web/sales_leads/{$b->id}?force_delete=1")->assertNoContent();
        $this->assertNull(WebSalesLead::withTrashed()->find($b->id));
        $this->deleteJson('/api/web/sales_leads/999')->assertStatus(404);
        $this->postJson("/api/web/sales_leads/{$a->id}/restore")->assertOk();
        $this->postJson('/api/web/sales_leads/999/restore')->assertStatus(404);
        $this->postJson('/api/web/sales_leads/bulk-delete', ['ids' => [$a->id, 999]])->assertOk()->assertJsonPath('data.skipped_count', 1);
        $this->postJson('/api/web/sales_leads/bulk-delete', ['ids' => array_merge([$c->id], range(2000, 2060)), 'force_delete' => true])->assertOk();
        $this->assertWebLog('hard_delete_bulk', '...');
        $this->postJson('/api/web/sales_leads/bulk-delete', [])->assertStatus(422);
        $this->deleteJson('/api/web/sales_leads/force-delete-all')->assertNoContent();
        $this->assertSame(0, WebSalesLead::onlyTrashed()->count());

        $d = $this->lead();
        $e = $this->lead();
        $e->delete();
        $this->failOn('web_sales_leads', 'UPDATE');
        $this->deleteJson("/api/web/sales_leads/{$d->id}")->assertStatus(500);
        $this->postJson('/api/web/sales_leads/bulk-delete', ['ids' => [$d->id]])->assertStatus(500);
        $this->postJson("/api/web/sales_leads/{$e->id}/restore")->assertStatus(500);
        $this->postJson("/api/web/sales_leads/{$d->id}/generate-link")->assertStatus(500)->assertJson(['message' => 'Link generation failed.']);
        $this->failOn('web_sales_leads', 'DELETE');
        $this->deleteJson('/api/web/sales_leads/force-delete-all')->assertStatus(500);
    }

    /**
     * @description The order form link: one unguessable token per lead (reused on the next
     *   call), URL on the frontend; unknown lead 404.
     * @input Frontend URL https://www.example.com/; generate-link twice; for /999.
     * @output Same 40-char token both times, url …/order_form/{token}; 404.
     */
    public function test_generate_link(): void
    {
        config(['app.frontend_url' => 'https://www.example.com/']);
        $this->signIn($this->userWith(['web-sales-leads-update']));
        $lead = $this->lead();

        $first = $this->postJson("/api/web/sales_leads/{$lead->id}/generate-link")->assertOk()->json('data');
        $second = $this->postJson("/api/web/sales_leads/{$lead->id}/generate-link")->json('data');

        $this->assertSame(40, strlen($first['token']));
        $this->assertSame($first['token'], $second['token']);
        $this->assertSame("https://www.example.com/order_form/{$first['token']}", $first['url']);
        $this->assertWebLog('generate_link');
        $this->postJson('/api/web/sales_leads/999/generate-link')->assertStatus(404);
    }

    /**
     * @description The public lookup by token prefills the order form with a few contact
     *   fields only; unknown and already used tokens are refused and recorded.
     * @input Lead with token T; lead with a used token U; GET T, U, 'nope'.
     * @output 200 {id, subject_name, contact_person, contact_email, contact_phone}; 410; 404;
     *   two sales_lead_token_invalid events.
     */
    public function test_public_show_by_token(): void
    {
        $lead = $this->lead(['public_token' => 'token-t']);
        $this->lead(['public_token' => 'token-u', 'public_token_used_at' => now()]);

        $this->getJson('/api/public/sales-leads/token-t')->assertOk()->assertExactJson(['data' => [
            'id' => $lead->id, 'subject_name' => 'Acme s.r.o.', 'contact_person' => 'Jan Acme', 'contact_email' => 'jan@acme.cz', 'contact_phone' => '777123456',
        ]]);
        $this->getJson('/api/public/sales-leads/token-u')->assertStatus(410);
        $this->getJson('/api/public/sales-leads/nope')->assertStatus(404);
        $this->assertSame(2, (int) CoreSecurityEvent::where('event_type', 'sales_lead_token_invalid')->sum('occurrences'));
    }

    /**
     * @description A lead without priority / status is returned with the slug defaults (finding #52 -
     *   were the Czech 'Neutrální' / 'nové', outside the validated vocabulary).
     * @input WebSalesLeadResource of an unsaved lead with priority and status null.
     * @output priority 'neutral', status 'new'.
     */
    public function test_resource_defaults_are_slugs(): void
    {
        $data = (new WebSalesLeadResource(new WebSalesLead()))->toArray(request());

        $this->assertSame('neutral', $data['priority']);
        $this->assertSame('new', $data['status']);
    }
}
