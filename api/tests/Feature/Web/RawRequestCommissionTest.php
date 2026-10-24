<?php

/**
 * @file RawRequestCommissionTest.php
 * @path api/tests/Feature/Web/RawRequestCommissionTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the commission requests (WebRawRequestCommissionController):
 *   the public contact form (validation, attachments, confirmation e-mail, rate limit) and the
 *   admin list / detail / edit / delete / trash.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage / Mail fakes.
 */

namespace Tests\Feature\Web;

use App\Mail\Web\WebRawRequestCommissionReceived;
use App\Models\Web\WebAttachment;
use App\Models\Web\WebRawRequestCommission;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description POST /api/raw_request_commissions and /api/web/raw_request_commissions.
 */
class RawRequestCommissionTest extends TestCase
{
    use WebFixtures;

    /** @var string[] All permissions of the commission requests. */
    private const ALL = ['web-user-requests-view', 'web-user-requests-create', 'web-user-requests-update', 'web-user-requests-delete'];

    /**
     * @description Fake disks for attachments.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
    }

    /**
     * @description A valid request body of the contact form.
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'thema' => 'New website', 'contact_email' => 'client@example.com', 'contact_phone' => '+420 777 123 456',
            'order_description' => 'Please call me.', 'lang' => 'en',
        ], $overrides);
    }

    /**
     * @description The public form stores the request with its attachments (private disk) and
     *   queues the confirmation e-mail in the chosen language - no sign-in needed.
     * @input POST /api/raw_request_commissions with 2 PDF attachments, lang 'en'.
     * @output 201 with 2 attachments (signed download URLs); files stored; mail queued to the
     *   client; web log 'create'.
     */
    public function test_public_form_stores_request_and_attachments(): void
    {
        Mail::fake();

        $response = $this->post('/api/raw_request_commissions', $this->payload([
            'attachments' => [$this->upload('brief.pdf'), $this->upload('logo.png', 5, 'image/png')],
        ]), ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('data.thema', 'New website')
            ->assertJsonCount(2, 'data.attachments');

        $this->assertStringContainsString('/api/attachments/download/', $response->json('data.attachments.0.download_url'));
        $request = WebRawRequestCommission::sole();
        $this->assertSame('en', $request->lang);
        foreach ($request->attachments as $attachment) {
            Storage::disk('private')->assertExists($attachment->path);
            $this->assertStringStartsWith('web/raw_request_commissions/', $attachment->path);
        }
        Mail::assertQueued(WebRawRequestCommissionReceived::class, fn ($mail) => $mail->hasTo('client@example.com'));
        $this->assertWebLog('create', 'New website');
    }

    /**
     * @description The form is validated - also the attachments of the public endpoint
     *   (forbidden extension, forbidden MIME type, too many files).
     * @input Invalid thema / e-mail / phone; an .exe; a file reported as application/x-msdownload; 11 files.
     * @output 422 with the errors; nothing stored.
     */
    public function test_public_form_validation_and_attachment_security(): void
    {
        $this->postJson('/api/raw_request_commissions', ['thema' => 'x', 'contact_email' => 'bad', 'contact_phone' => 'abc'])
            ->assertStatus(422)
            ->assertJsonPath('errors.thema.0', 'The subject must be between 3 and 255 characters.')
            ->assertJsonValidationErrors(['contact_email', 'contact_phone', 'order_description']);

        $this->post('/api/raw_request_commissions', $this->payload(['attachments' => [$this->upload('virus.exe', 1, 'application/pdf')]]), ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors', fn ($e) => str_contains(json_encode($e), 'not allowed for security reasons'));
        $this->post('/api/raw_request_commissions', $this->payload(['attachments' => [$this->upload('doc.pdf', 1, 'application/x-msdownload')]]), ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors', fn ($e) => str_contains(json_encode($e), 'unauthorized type'));
        $this->post('/api/raw_request_commissions', $this->payload(['attachments' => array_map(fn ($i) => $this->upload("f{$i}.pdf", 1), range(1, 11))]), ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors.attachments.0', 'You can upload a maximum of 10 files at once.');

        $this->assertSame(0, WebRawRequestCommission::count());
    }

    /**
     * @description A failing confirmation e-mail does not lose the request - it is logged.
     * @input Mailer broken, valid POST.
     * @output 201; web log 'error' "Failed to send confirmation email".
     */
    public function test_public_form_mail_failure_is_logged(): void
    {
        $this->breakMailer();

        $this->postJson('/api/raw_request_commissions', $this->payload())->assertCreated();

        $this->assertWebLog('error', 'Failed to send confirmation email');
    }

    /**
     * @description A database error answers 500 and is logged.
     * @input web_raw_request_commissions INSERT fails.
     * @output 500 "Request creation failed."; web log 'error'.
     */
    public function test_public_form_database_error(): void
    {
        $this->failOn('web_raw_request_commissions', 'INSERT');

        $this->postJson('/api/raw_request_commissions', $this->payload())->assertStatus(500)->assertJson(['message' => 'Request creation failed.']);
        $this->assertWebLog('error', 'Error creating request');
    }

    /**
     * @description The public form is rate limited per IP (10 / minute).
     * @input 11 valid POSTs from one IP.
     * @output The 11th answers 429.
     */
    public function test_public_form_is_rate_limited(): void
    {
        Mail::fake();
        foreach (range(1, 10) as $i) {
            $this->postJson('/api/raw_request_commissions', $this->payload())->assertCreated();
        }

        $this->postJson('/api/raw_request_commissions', $this->payload())->assertStatus(429);
    }

    /**
     * @description The admin list needs the view permission and supports search, filters,
     *   date ranges, trash and export.
     * @input A (high, 'Logo', a@x.cz, created 10 days ago), B (low, 'Shop', b@y.cz, today), C trashed.
     * @output Every filter returns exactly the expected rows.
     */
    public function test_admin_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/web/raw_request_commissions')->assertStatus(403);

        $this->signIn($this->userWith(['web-user-requests-view']));
        $a = $this->rawRequest(['thema' => 'Logo', 'priority' => 'high', 'contact_email' => 'a@x.cz', 'contact_phone' => '111']);
        $a->forceFill(['created_at' => now()->subDays(10)])->save();
        $b = $this->rawRequest(['thema' => 'Shop', 'priority' => 'low', 'contact_email' => 'b@y.cz', 'status' => 'done']);
        $this->rawRequest(['thema' => 'Old'])->delete();

        $this->getJson('/api/web/raw_request_commissions?per_page=1')->assertOk()
            ->assertJson(['meta' => ['total' => 2, 'last_page' => 2]])->assertJsonPath('data.0.id', $b->id);
        $ids = fn (string $query) => array_column($this->getJson("/api/web/raw_request_commissions?{$query}")->json('data'), 'id');
        $this->assertSame([$a->id], $ids('search=Logo'));
        $this->assertSame([$a->id], $ids("id={$a->id}"));
        $this->assertSame([$b->id], $ids('status=done'));
        $this->assertSame([$a->id], $ids('priority=high'));
        $this->assertSame([$b->id], $ids('contact_email=y.cz'));
        $this->assertSame([$a->id], $ids('contact_phone=111'));
        $this->assertSame([$b->id], $ids('thema=Sho'));
        $this->assertSame([$a->id], $ids('order_description=new&thema=Log'));
        $this->assertSame([$a->id], $ids('created_at=' . now()->subDays(10)->toDateString()));
        $this->assertSame([$b->id], $ids('date_from=' . now()->subDay()->toDateString()));
        $this->assertSame([$a->id], $ids('date_to=' . now()->subDays(5)->toDateString()));
        $this->assertSame(['Old'], array_column($this->getJson('/api/web/raw_request_commissions?only_trashed=1')->json('data'), 'thema'));
        $this->assertCount(2, $this->getJson('/api/web/raw_request_commissions?no_pagination=true')->assertOk()->json('data'));
    }

    /**
     * @description The admin creates a request through the same validation.
     * @input Creator: POST /api/web/raw_request_commissions.
     * @output 201.
     */
    public function test_admin_store(): void
    {
        Mail::fake();
        $this->signIn($this->userWith(['web-user-requests-create']));

        $this->postJson('/api/web/raw_request_commissions', $this->payload(['status' => 'in_progress']))
            ->assertCreated()->assertJsonPath('data.status', 'in_progress');
    }

    /**
     * @description The detail includes trashed requests and their attachments; unknown id 404.
     * @input Trashed request with an attachment; GET it; GET /999.
     * @output 200 with deleted_at and 1 attachment; 404.
     */
    public function test_show(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $request = $this->rawRequest();
        $this->attach($request, 'web/raw_request_commissions/a.pdf');
        $request->delete();

        $this->getJson("/api/web/raw_request_commissions/{$request->id}")->assertOk()
            ->assertJsonCount(1, 'data.attachments')->assertJsonPath('data.deleted_at', fn ($v) => $v !== null);
        $this->getJson('/api/web/raw_request_commissions/999')->assertStatus(404);
    }

    /**
     * @description Editing saves the fields, removes the selected attachments (file too) and
     *   adds new ones; unknown id 404; database error 500.
     * @input Request with attachment X; PUT {thema, status, attachments_removed_ids: [X], attachments: [new]}.
     * @output 200: X gone (row + file), the new file stored; web log 'update'; 404; 500.
     */
    public function test_update(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $request = $this->rawRequest();
        $old = $this->attach($request, 'web/raw_request_commissions/old.pdf');

        $this->post("/api/web/raw_request_commissions/{$request->id}", [
            '_method' => 'PUT', 'thema' => 'Renamed', 'status' => 'done', 'attachments_removed_ids' => [$old->id],
            'attachments' => [$this->upload('new.pdf')],
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('data.thema', 'Renamed')->assertJsonPath('data.attachments.0.original_filename', 'new.pdf');

        $this->assertNull(WebAttachment::find($old->id));
        Storage::disk('private')->assertMissing('web/raw_request_commissions/old.pdf');
        $this->assertWebLog('update', "Updated request ID: {$request->id}");

        $this->putJson('/api/web/raw_request_commissions/999', ['thema' => 'Renamed'])->assertStatus(404);
        $this->putJson("/api/web/raw_request_commissions/{$request->id}", ['thema' => 'x'])->assertStatus(422);
        $this->failOn('web_raw_request_commissions', 'UPDATE');
        $this->putJson("/api/web/raw_request_commissions/{$request->id}", ['thema' => 'Again'])
            ->assertStatus(500)->assertJson(['message' => 'Request update failed.']);
    }

    /**
     * @description Delete: soft (to the trash) or permanent (files deleted); unknown id 404;
     *   database error 500.
     * @input DELETE A; DELETE B ?force_delete=true (B has an attachment); DELETE /999; then failure.
     * @output 204, A trashed; 204, B + file gone; 404; 500.
     */
    public function test_destroy(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $a = $this->rawRequest();
        $b = $this->rawRequest();
        $this->attach($b, 'web/raw_request_commissions/b.pdf');

        $this->deleteJson("/api/web/raw_request_commissions/{$a->id}")->assertNoContent();
        $this->assertSoftDeleted($a);
        $this->deleteJson("/api/web/raw_request_commissions/{$b->id}?force_delete=true")->assertNoContent();
        $this->assertNull(WebRawRequestCommission::withTrashed()->find($b->id));
        Storage::disk('private')->assertMissing('web/raw_request_commissions/b.pdf');
        $this->assertWebLog('hard_delete');
        $this->deleteJson('/api/web/raw_request_commissions/999')->assertStatus(404);

        $c = $this->rawRequest();
        $this->failOn('web_raw_request_commissions', 'UPDATE');
        $this->deleteJson("/api/web/raw_request_commissions/{$c->id}")->assertStatus(500)->assertJson(['message' => 'Request deletion failed.']);
    }

    /**
     * @description Bulk delete: soft and permanent, unknown ids skipped, long id lists cut in
     *   the log, validation, database error.
     * @input A, B (B with an attachment); bulk {ids: [A, 999]}; bulk {ids: [B], force_delete};
     *        60 unknown ids; {ids: []}; failure.
     * @output {deleted 1, skipped 1}; B + file gone; log ends with '...'; 422; 500.
     */
    public function test_bulk_destroy(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $a = $this->rawRequest();
        $b = $this->rawRequest();
        $this->attach($b, 'web/raw_request_commissions/b.pdf');

        $this->postJson('/api/web/raw_request_commissions/bulk-delete', ['ids' => [$a->id, 999]])
            ->assertOk()->assertJson(['data' => ['deleted_count' => 1, 'skipped_count' => 1, 'requested' => 2]]);
        $this->assertSoftDeleted($a);
        $this->postJson('/api/web/raw_request_commissions/bulk-delete', ['ids' => [$b->id], 'force_delete' => true])
            ->assertOk()->assertJsonPath('data.deleted_count', 1);
        Storage::disk('private')->assertMissing('web/raw_request_commissions/b.pdf');
        $this->assertWebLog('hard_delete_bulk');
        $this->postJson('/api/web/raw_request_commissions/bulk-delete', ['ids' => range(1000, 1059)])->assertOk();
        $this->assertWebLog('soft_delete_bulk', '1049...');
        $this->postJson('/api/web/raw_request_commissions/bulk-delete', ['ids' => []])->assertStatus(422);

        $c = $this->rawRequest();
        $this->failOn('web_raw_request_commissions', 'UPDATE');
        $this->postJson('/api/web/raw_request_commissions/bulk-delete', ['ids' => [$c->id]])->assertStatus(500);
        $this->assertWebLog('error', 'bulk deletion');
    }

    /**
     * @description Restore and emptying the trash (files deleted); unknown id 404; database errors 500.
     * @input Trashed A; restore A; trashed B with attachment; force-delete-all; failures.
     * @output 200 (A active); 204 (B + file gone); 404; 500 / 500.
     */
    public function test_restore_and_empty_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $a = $this->rawRequest();
        $a->delete();
        $b = $this->rawRequest();
        $this->attach($b, 'web/raw_request_commissions/b.pdf');
        $b->delete();

        $this->postJson("/api/web/raw_request_commissions/{$a->id}/restore")->assertOk()->assertJsonPath('data.deleted_at', null);
        $this->postJson('/api/web/raw_request_commissions/999/restore')->assertStatus(404);
        $this->deleteJson('/api/web/raw_request_commissions/force-delete-all')->assertNoContent();
        $this->assertNull(WebRawRequestCommission::withTrashed()->find($b->id));
        Storage::disk('private')->assertMissing('web/raw_request_commissions/b.pdf');
        $this->assertWebLog('force_delete_all', 'Count: 1');

        $c = $this->rawRequest();
        $c->delete();
        $this->failOn('web_raw_request_commissions', 'UPDATE');
        $this->postJson("/api/web/raw_request_commissions/{$c->id}/restore")->assertStatus(500)->assertJson(['message' => 'Request restoration failed.']);
        $this->failOn('web_raw_request_commissions', 'DELETE');
        $this->deleteJson('/api/web/raw_request_commissions/force-delete-all')->assertStatus(500)->assertJson(['message' => 'Emptying trash failed.']);
    }
}
