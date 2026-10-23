<?php

/**
 * @file SupportTicketTest.php
 * @path api/tests/Feature/Web/SupportTicketTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the support tickets (WebSupportTicketController): list with
 *   filters and export, create with the reporter taken from the signed-in account and one
 *   attachment, edit (attachment replaced), delete / bulk delete / restore / trash.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage fake.
 */

namespace Tests\Feature\Web;

use App\Models\Web\WebSupportTicket;
use Illuminate\Support\Facades\Storage;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description /api/web/support_tickets.
 */
class SupportTicketTest extends TestCase
{
    use WebFixtures;

    /** @var string[] All support ticket permissions. */
    private const ALL = ['web-support-tickets-view', 'web-support-tickets-create', 'web-support-tickets-update', 'web-support-tickets-delete'];

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
     * @description List: permission, newest first, search, filters (id, priority, category,
     *   status = state), sort direction fallback, trash, export (logged).
     * @input A (bug, high, open, 'Printer jam'), B (it, low, new, 'VPN'), C trashed.
     * @output Each filter returns the expected ticket; export returns 2 and writes 'export'.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/web/support_tickets')->assertStatus(403);

        $this->signIn($this->userWith(['web-support-tickets-view']));
        $a = $this->ticket(['category' => 'bug', 'priority' => 'high', 'state' => 'open', 'subject' => 'Printer jam']);
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $b = $this->ticket(['category' => 'it', 'priority' => 'low', 'subject' => 'VPN', 'user_plain' => 'petr@x.cz']);
        $this->ticket(['subject' => 'Gone'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/web/support_tickets?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids('sort_direction=bogus'));
        $this->assertSame([$a->id, $b->id], $ids('sort_direction=ASC'));
        $this->assertSame([$a->id], $ids('search=jam'));
        $this->assertSame([$b->id], $ids('search=petr@'));
        $this->assertSame([$a->id], $ids("id={$a->id}"));
        $this->assertSame([$a->id], $ids('priority=high'));
        $this->assertSame([$b->id], $ids('category=it'));
        $this->assertSame([$a->id], $ids('status=open'));
        $this->assertSame(['Gone'], array_column($this->getJson('/api/web/support_tickets?only_trashed=1')->json('data'), 'subject'));
        $this->getJson('/api/web/support_tickets?per_page=1')->assertJson(['total' => 2, 'last_page' => 2]);
        $this->getJson('/api/web/support_tickets?no_pagination=true')->assertOk()->assertJsonCount(2);
        $this->assertWebLog('export', 'Bulk export of support tickets.');
    }

    /**
     * @description Creating fills the reporter from the signed-in account (unless given), the
     *   state defaults to 'new', one attachment is stored.
     * @input Creator Jana (jana@corp.cz): POST {category, subject, description, attachment: log.txt}.
     * @output 201 with user_id, user_name_plain 'Jana', user_plain e-mail, state 'new', 1 attachment.
     */
    public function test_store_uses_signed_in_reporter(): void
    {
        $me = $this->signIn($this->userWith(['web-support-tickets-create'], ['full_name' => 'Jana', 'user_email' => 'jana@corp.cz']));

        $this->post('/api/web/support_tickets', [
            'category' => 'bug', 'subject' => 'Crash', 'description' => 'Boom', 'attachment' => $this->upload('log.txt', 2, 'text/plain'),
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('user_id', $me->id)
            ->assertJsonPath('user_name_plain', 'Jana')
            ->assertJsonPath('user_plain', 'jana@corp.cz')
            ->assertJsonPath('state', 'new')
            ->assertJsonCount(1, 'attachments');

        $this->postJson('/api/web/support_tickets', [
            'category' => 'it', 'subject' => 'For Petr', 'description' => 'x', 'user_name_plain' => 'Petr', 'user_plain' => 'petr@corp.cz',
        ])->assertCreated()->assertJsonPath('user_plain', 'petr@corp.cz');
        $this->assertWebLog('create', 'New ticket: Crash');
    }

    /**
     * @description Validation (category, attachment type) and a database error on create.
     * @input POST with category 'nope' and an .exe; then the INSERT fails.
     * @output 422 (category, attachment); 500 "Ticket creation failed.".
     */
    public function test_store_validation_and_error(): void
    {
        $this->signIn($this->userWith(['web-support-tickets-create']));

        $this->post('/api/web/support_tickets', [
            'category' => 'nope', 'subject' => 'S', 'description' => 'D', 'attachment' => $this->upload('tool.exe', 1, 'application/octet-stream'),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors(['category', 'attachment']);

        $this->failOn('web_support_tickets', 'INSERT');
        $this->postJson('/api/web/support_tickets', ['category' => 'it', 'subject' => 'S', 'description' => 'D'])
            ->assertStatus(500)->assertJson(['message' => 'Ticket creation failed.']);
    }

    /**
     * @description Detail (also trashed), edit with the attachment replaced (old file deleted),
     *   unknown id 404, database error 500.
     * @input Ticket with attachment old.pdf: GET; PUT {state: closed, attachment: new.pdf}; PUT /999; failure.
     * @output 200; 200 state closed, only new.pdf left, old.pdf deleted; 404; 500.
     */
    public function test_show_and_update(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $ticket = $this->ticket();
        $this->attach($ticket, 'web/tickets/old.pdf');

        $this->getJson("/api/web/support_tickets/{$ticket->id}")->assertOk()->assertJsonCount(1, 'attachments');
        $this->getJson('/api/web/support_tickets/999')->assertStatus(404);

        $this->post("/api/web/support_tickets/{$ticket->id}", [
            '_method' => 'PUT', 'state' => 'closed', 'attachment' => $this->upload('new.pdf'),
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('state', 'closed')
            ->assertJsonCount(1, 'attachments')
            ->assertJsonPath('attachments.0.original_filename', 'new.pdf');
        Storage::disk('private')->assertMissing('web/tickets/old.pdf');
        $this->assertWebLog('update', "Update ticket ID: {$ticket->id}");

        $this->putJson('/api/web/support_tickets/999', ['state' => 'closed'])->assertStatus(404);
        $this->failOn('web_support_tickets', 'UPDATE');
        $this->putJson("/api/web/support_tickets/{$ticket->id}", ['state' => 'open'])->assertStatus(500)->assertJson(['message' => 'Ticket update failed.']);
    }

    /**
     * @description Delete (soft / permanent with files), bulk delete, restore, empty trash,
     *   404s and database errors.
     * @input Tickets A, B (attachment), C, D; the actions in sequence; then failing writes.
     * @output 204 / 200 / {deleted, skipped} as expected; files deleted; 404; 500 for each action.
     */
    public function test_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        [$a, $b, $c, $d] = [$this->ticket(), $this->ticket(), $this->ticket(), $this->ticket()];
        $this->attach($b, 'web/tickets/b.pdf');

        $this->deleteJson("/api/web/support_tickets/{$a->id}")->assertNoContent();
        $this->assertSoftDeleted($a);
        $this->deleteJson("/api/web/support_tickets/{$b->id}?force_delete=1")->assertNoContent();
        Storage::disk('private')->assertMissing('web/tickets/b.pdf');
        $this->deleteJson('/api/web/support_tickets/999')->assertStatus(404);

        $this->postJson("/api/web/support_tickets/{$a->id}/restore")->assertOk()->assertJsonPath('deleted_at', null);
        $this->postJson('/api/web/support_tickets/999/restore')->assertStatus(404);

        $this->postJson('/api/web/support_tickets/bulk-delete', ['ids' => [$c->id, 999]])->assertOk()
            ->assertJson(['data' => ['deleted_count' => 1, 'skipped_count' => 1, 'requested' => 2]]);
        $this->attach($d, 'web/tickets/d.pdf');
        $this->postJson('/api/web/support_tickets/bulk-delete', ['ids' => range(1, 60), 'force_delete' => true])->assertOk();
        Storage::disk('private')->assertMissing('web/tickets/d.pdf');
        $this->assertWebLog('hard_delete_bulk', '50...');
        $this->postJson('/api/web/support_tickets/bulk-delete', ['ids' => []])->assertStatus(422);

        $e = $this->ticket();
        $e->delete();
        $this->deleteJson('/api/web/support_tickets/force-delete-all')->assertNoContent();
        $this->assertSame(0, WebSupportTicket::onlyTrashed()->count());
        $this->assertWebLog('force_delete_all');

        $f = $this->ticket();
        $this->failOn('web_support_tickets', 'UPDATE');
        $this->deleteJson("/api/web/support_tickets/{$f->id}")->assertStatus(500);
        $this->postJson('/api/web/support_tickets/bulk-delete', ['ids' => [$f->id]])->assertStatus(500);
    }

    /**
     * @description Restore and emptying the trash answer 500 on a database error.
     * @input Trashed ticket; UPDATE fails (restore), DELETE fails (empty trash).
     * @output 500 "Ticket restoration failed." and "Emptying trash failed.".
     */
    public function test_restore_and_trash_errors(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $ticket = $this->ticket();
        $ticket->delete();

        $this->failOn('web_support_tickets', 'UPDATE');
        $this->postJson("/api/web/support_tickets/{$ticket->id}/restore")->assertStatus(500)->assertJson(['message' => 'Ticket restoration failed.']);
        $this->failOn('web_support_tickets', 'DELETE');
        $this->deleteJson('/api/web/support_tickets/force-delete-all')->assertStatus(500)->assertJson(['message' => 'Emptying trash failed.']);
    }
}
