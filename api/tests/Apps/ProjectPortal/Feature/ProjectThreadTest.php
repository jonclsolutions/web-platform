<?php

/**
 * @file ProjectThreadTest.php
 * @path api/tests/Apps/ProjectPortal/Feature/ProjectThreadTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the admin view of customer conversation threads
 *   (ProjectThreadController): list across projects, detail with the latest messages
 *   only, "load older messages", admin reply with attachments, internal notes of the team,
 *   client e-mail notifications and the status change.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures; Storage fake.
 */

namespace Tests\Apps\ProjectPortal\Feature;

use App\Apps\ProjectPortal\Mail\ProjectClientUpdateMail;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\ProjectThread;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description /api/project-portal/project-threads.
 */
class ProjectThreadTest extends TestCase
{
    use ProjectFixtures;

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
     * @description List across all projects: permission, newest activity first, filters,
     *   project name, pagination, export.
     * @input Project P: thread A (high, active, older activity); project Q: thread B (low, closed).
     * @output [B, A]; project_id / priority / status filters; project_name; total 2 / last_page 2.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/project-portal/project-threads')->assertStatus(403);

        $this->signIn($this->userWith(['project-portal-projects-view']));
        $p = $this->project(['name' => 'Portal P']);
        $q = $this->project(['name' => 'Portal Q']);
        $a = $this->thread($p, ['priority' => 'high', 'last_message_at' => now()->subHour()]);
        $b = $this->thread($q, ['priority' => 'low', 'status' => 'closed']);

        $ids = fn (string $query) => array_column($this->getJson("/api/project-portal/project-threads?{$query}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$a->id, $b->id], $ids('sort_direction=asc'));
        $this->assertSame([$a->id], $ids("project_id={$p->id}"));
        $this->assertSame([$a->id], $ids('priority=high'));
        $this->assertSame([$b->id], $ids('status=closed'));
        $this->getJson("/api/project-portal/project-threads?project_id={$q->id}")->assertJsonPath('data.0.project_name', 'Portal Q');
        $this->getJson('/api/project-portal/project-threads?per_page=1')->assertJson(['meta' => ['total' => 2, 'last_page' => 2, 'per_page' => 1]]);
        $this->getJson('/api/project-portal/project-threads?no_pagination=1')->assertOk()->assertJsonCount(2, 'data');
    }

    /**
     * @description The detail returns only the latest page of messages (oldest first) and says
     *   whether older ones exist; the older page is fetched by the oldest loaded id.
     * @input Thread with 52 messages; GET detail; GET messages?before_message_id=<oldest loaded>;
     *        GET messages?limit=500 (capped to 100); thread with 1 message; /999.
     * @output 50 messages (#3…#52), has_more true; then #1…#2, has_more false; 52; has_more false; 404.
     */
    public function test_show_and_older_messages(): void
    {
        $this->signIn($this->userWith(['project-portal-projects-view']));
        $thread = $this->thread($this->project(), [], array_map(fn ($i) => ['customer', "Message {$i}"], range(1, 52)));

        $show = $this->getJson("/api/project-portal/project-threads/{$thread->id}")->assertOk()
            ->assertJsonPath('meta.has_more_older_messages', true)->assertJsonPath('data.project_name', 'Client portal')
            ->assertJsonCount(50, 'data.messages')->assertJsonPath('data.messages.0.body', 'Message 3')->assertJsonPath('data.messages.49.body', 'Message 52')->json('data');

        $this->getJson("/api/project-portal/project-threads/{$thread->id}/messages?before_message_id={$show['messages'][0]['id']}")->assertOk()
            ->assertJsonPath('meta.has_more_older_messages', false)->assertJsonCount(2, 'data')->assertJsonPath('data.0.body', 'Message 1');
        $this->getJson("/api/project-portal/project-threads/{$thread->id}/messages?limit=500")->assertJsonCount(52, 'data')->assertJsonPath('meta.has_more_older_messages', false);
        $this->getJson("/api/project-portal/project-threads/{$thread->id}/messages?limit=10")->assertJsonCount(10, 'data')->assertJsonPath('meta.has_more_older_messages', true);

        $short = $this->thread($this->project(), [], [['admin', 'Only one']]);
        $this->getJson("/api/project-portal/project-threads/{$short->id}")->assertJsonPath('meta.has_more_older_messages', false)->assertJsonPath('data.messages.0.author_type', 'admin');
        $this->getJson('/api/project-portal/project-threads/999')->assertStatus(404);
        $this->getJson('/api/project-portal/project-threads/999/messages')->assertStatus(404);
    }

    /**
     * @description Admin reply: stored as 'admin' under the admin's full name (and user id),
     *   attachments in web/project_threads, thread activity bumped, now waiting on the client;
     *   validation; permission; 404.
     * @input Admin "Jana Nová"; POST reply {body, attachments: [a.pdf]}; POST {} ; POST 6 files;
     *        viewer without update; /999.
     * @output 201 {author_type admin, author_label "Jana Nová", is_internal false, 1 attachment};
     *   last_message_at moved; waiting_on customer; 422 body; 422 "You can attach at most 5 files."; 403; 404.
     */
    public function test_reply(): void
    {
        $thread = $this->thread($this->project(), ['last_message_at' => now()->subDay()]);
        $this->signIn($this->userWith(['project-portal-projects-view']));
        $this->postJson("/api/project-portal/project-threads/{$thread->id}/reply", ['body' => 'x'])->assertStatus(403);

        $admin = $this->userWith(['project-portal-projects-update'], ['full_name' => 'Jana Nová']);
        $this->signIn($admin);
        $this->post("/api/project-portal/project-threads/{$thread->id}/reply", ['body' => 'Here you go', 'attachments' => [$this->upload('a.pdf')]], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.author_type', 'admin')
            ->assertJsonPath('data.author_label', 'Jana Nová')
            ->assertJsonPath('data.is_internal', false)
            ->assertJsonPath('data.attachments.0.original_filename', 'a.pdf');

        $message = $thread->messages()->sole();
        $this->assertSame($admin->id, (int) $message->user_id);
        $this->assertStringStartsWith('web/project_threads/', $message->attachments->sole()->path);
        $this->assertTrue($thread->fresh()->last_message_at->isToday());
        $this->assertSame('customer', $thread->fresh()->waitingOn());
        // Messages are the conversation itself - a reply writes no audit log row.
        $this->assertSame(0, ProjectPortalLog::count());

        $this->postJson("/api/project-portal/project-threads/{$thread->id}/reply", [])->assertStatus(422)->assertJsonValidationErrors(['body']);
        $six = array_map(fn ($i) => $this->upload("f{$i}.pdf"), range(1, 6));
        $this->post("/api/project-portal/project-threads/{$thread->id}/reply", ['body' => 'Many', 'attachments' => $six], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors.attachments.0', 'You can attach at most 5 files.');
        $this->postJson('/api/project-portal/project-threads/999/reply', ['body' => 'x'])->assertStatus(404);
    }

    /**
     * @description Internal note of the team: stored as internal, does not move the thread's
     *   activity nor "whose turn", e-mails no client; a public reply e-mails only the opted-in
     *   accounts that have an e-mail, in their language, without the message text.
     * @input Thread waiting on the supplier, accounts: klient (no e-mail), anna (e-mail,
     *   en, reply e-mails on), petr (e-mail, only checkpoint e-mails on); POST internal note; POST public reply.
     * @output Note: is_internal true, last_message_at / waiting_on unchanged, no mail. Reply: one
     *   ProjectClientUpdateMail to anna, kind reply, item = thread subject, waiting on the client.
     */
    public function test_internal_note_and_client_notification(): void
    {
        Mail::fake();
        $project = $this->project();
        $this->portalAccount($project, 'anna', 'Anna', ['email' => 'anna@client.cz', 'notify_replies' => true, 'language' => 'en']);
        $this->portalAccount($project, 'petr', 'Petr', ['email' => 'petr@client.cz', 'notify_checkpoint_status' => true, 'notify_checkpoint_dates' => true]);
        $thread = $this->thread($project, ['last_message_at' => now()->subDay()], [['customer', 'Question']]);
        $this->signIn($this->userWith(['project-portal-projects-update']));

        $this->postJson("/api/project-portal/project-threads/{$thread->id}/reply", ['body' => 'Ask Petr first', 'is_internal' => true])
            ->assertCreated()->assertJsonPath('data.is_internal', true);
        $fresh = $thread->fresh();
        $this->assertFalse($fresh->last_message_at->isToday());
        $this->assertSame('supplier', $fresh->waitingOn());
        $this->assertNotNull($fresh->admin_last_read_at);
        Mail::assertNothingQueued();
        Mail::assertNothingSent();

        $this->postJson("/api/project-portal/project-threads/{$thread->id}/reply", ['body' => 'Secret detail'])->assertCreated();
        $this->assertSame('customer', $thread->fresh()->waitingOn());
        Mail::assertQueued(ProjectClientUpdateMail::class, 1);
        Mail::assertQueued(ProjectClientUpdateMail::class, function (ProjectClientUpdateMail $mail) use ($thread) {
            return $mail->hasTo('anna@client.cz') && $mail->kind === ProjectClientUpdateMail::KIND_REPLY
                && $mail->itemTitle === $thread->subject && !str_contains($mail->render(), 'Secret detail');
        });
    }

    /**
     * @description Status change without a reply, logged as closing / reopening (an unchanged
     *   status writes no row); only known statuses; 404.
     * @input PUT status closed (twice); PUT active; PUT status 'archived'; PUT /999.
     * @output 200 {data.status closed}; logs thread_close once, thread_reopen; 422; 404.
     */
    public function test_update_status(): void
    {
        $this->signIn($this->userWith(['project-portal-projects-update']));
        $thread = $this->thread($this->project());

        $this->putJson("/api/project-portal/project-threads/{$thread->id}/status", ['status' => 'closed'])->assertOk()->assertJsonPath('data.status', 'closed');
        $this->assertSame('closed', ProjectThread::find($thread->id)->status);
        $this->assertPortalLog('thread_close', "Closed thread #{$thread->id} of project #{$thread->project_id}");
        $this->putJson("/api/project-portal/project-threads/{$thread->id}/status", ['status' => 'closed'])->assertOk();
        $this->assertSame(1, ProjectPortalLog::count(), 'an unchanged status writes no row');
        $this->putJson("/api/project-portal/project-threads/{$thread->id}/status", ['status' => 'active'])->assertOk();
        $this->assertPortalLog('thread_reopen', "Reopened thread #{$thread->id}");
        $this->putJson("/api/project-portal/project-threads/{$thread->id}/status", ['status' => 'archived'])->assertStatus(422);
        $this->putJson('/api/project-portal/project-threads/999/status', ['status' => 'closed'])->assertStatus(404);
    }

    /**
     * @description New client messages for the administration: counted per thread and per project
     *   (projects filter `unread`), cleared when an admin opens the thread; an admin reply marks it
     *   read too; admin messages never count; a message older than the last read is not new.
     * @input Project P: thread A (2 customer messages + 1 admin), thread B read 1 hour ago with one
     *   older and one newer customer message; project Q without messages.
     * @output threads: A 2, B 1; projects: P 3, Q 0; ?unread=1 → [P]; GET A → A 0, P 1; reply in
     *   B → P 0; ?unread=1 → [].
     */
    public function test_unread_messages_for_the_administration(): void
    {
        $this->signIn($this->userWith(['project-portal-projects-view', 'project-portal-projects-update']));
        $p = $this->project(['name' => 'P']);
        $q = $this->project(['name' => 'Q']);
        $a = $this->thread($p, [], [['customer', 'hi'], ['customer', 'are you there?'], ['admin', 'yes']]);
        $b = $this->thread($p, ['admin_last_read_at' => now()->subHour()]);
        $b->messages()->create(['author_type' => 'customer', 'body' => 'old'])->forceFill(['created_at' => now()->subHours(2)])->saveQuietly();
        $b->messages()->create(['author_type' => 'customer', 'body' => 'new']);

        $threadCounts = fn () => array_column($this->getJson("/api/project-portal/project-threads?project_id={$p->id}&no_pagination=1")->json('data'), 'admin_unread_count', 'id');
        $projectCounts = fn () => array_column($this->getJson('/api/project-portal/projects?no_pagination=1')->json('data'), 'unread_messages_count', 'name');
        $unreadProjects = fn () => array_column($this->getJson('/api/project-portal/projects?no_pagination=1&unread=1')->json('data'), 'name');

        $this->assertSame([$a->id => 2, $b->id => 1], $threadCounts() + []);
        $this->assertEquals(['P' => 3, 'Q' => 0], $projectCounts());
        $this->assertSame(['P'], $unreadProjects());
        $this->getJson("/api/project-portal/projects/{$p->id}")->assertJsonPath('data.unread_messages_count', 3);

        $this->getJson("/api/project-portal/project-threads/{$a->id}")->assertOk();
        $this->assertSame(0, $threadCounts()[$a->id]);
        $this->assertSame(1, $projectCounts()['P']);

        $this->postJson("/api/project-portal/project-threads/{$b->id}/reply", ['body' => 'on it'])->assertCreated();
        $this->assertSame(0, $projectCounts()['P']);
        $this->assertSame([], $unreadProjects());
    }
}
