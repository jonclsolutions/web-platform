<?php

/**
 * @file ProjectThreadTest.php
 * @path api/tests/Feature/Web/ProjectThreadTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the admin view of customer conversation threads
 *   (WebProjectThreadController): list across projects, detail with the latest messages
 *   only, "load older messages", admin reply with attachments and the status change.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage fake.
 */

namespace Tests\Feature\Web;

use App\Models\Web\WebProjectThread;
use Illuminate\Support\Facades\Storage;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description /api/web/project-threads.
 */
class ProjectThreadTest extends TestCase
{
    use WebFixtures;

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
        $this->getJson('/api/web/project-threads')->assertStatus(403);

        $this->signIn($this->userWith(['web-projects-view']));
        $p = $this->project(['name' => 'Portal P']);
        $q = $this->project(['name' => 'Portal Q']);
        $a = $this->thread($p, ['priority' => 'high', 'last_message_at' => now()->subHour()]);
        $b = $this->thread($q, ['priority' => 'low', 'status' => 'closed']);

        $ids = fn (string $query) => array_column($this->getJson("/api/web/project-threads?{$query}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$a->id, $b->id], $ids('sort_direction=asc'));
        $this->assertSame([$a->id], $ids("project_id={$p->id}"));
        $this->assertSame([$a->id], $ids('priority=high'));
        $this->assertSame([$b->id], $ids('status=closed'));
        $this->getJson("/api/web/project-threads?project_id={$q->id}")->assertJsonPath('data.0.project_name', 'Portal Q');
        $this->getJson('/api/web/project-threads?per_page=1')->assertJson(['total' => 2, 'last_page' => 2, 'per_page' => 1]);
        $this->getJson('/api/web/project-threads?no_pagination=1')->assertOk()->assertJsonCount(2);
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
        $this->signIn($this->userWith(['web-projects-view']));
        $thread = $this->thread($this->project(), [], array_map(fn ($i) => ['customer', "Message {$i}"], range(1, 52)));

        $show = $this->getJson("/api/web/project-threads/{$thread->id}")->assertOk()
            ->assertJsonPath('has_more_older_messages', true)->assertJsonPath('project_name', 'Client portal')
            ->assertJsonCount(50, 'messages')->assertJsonPath('messages.0.body', 'Message 3')->assertJsonPath('messages.49.body', 'Message 52')->json();

        $this->getJson("/api/web/project-threads/{$thread->id}/messages?before_message_id={$show['messages'][0]['id']}")->assertOk()
            ->assertJsonPath('has_more_older_messages', false)->assertJsonCount(2, 'data')->assertJsonPath('data.0.body', 'Message 1');
        $this->getJson("/api/web/project-threads/{$thread->id}/messages?limit=500")->assertJsonCount(52, 'data')->assertJsonPath('has_more_older_messages', false);
        $this->getJson("/api/web/project-threads/{$thread->id}/messages?limit=10")->assertJsonCount(10, 'data')->assertJsonPath('has_more_older_messages', true);

        $short = $this->thread($this->project(), [], [['admin', 'Only one']]);
        $this->getJson("/api/web/project-threads/{$short->id}")->assertJsonPath('has_more_older_messages', false)->assertJsonPath('messages.0.author_type', 'admin');
        $this->getJson('/api/web/project-threads/999')->assertStatus(404);
        $this->getJson('/api/web/project-threads/999/messages')->assertStatus(404);
    }

    /**
     * @description Admin reply: stored as 'admin' with the admin's e-mail, attachments in
     *   web/project_threads, thread activity bumped; validation; permission; 404.
     * @input Admin admin@firm.cz; POST reply {body, attachments: [a.pdf]}; POST {} ; POST 6 files;
     *        viewer without update; /999.
     * @output 201 {author_type admin, author_label admin@firm.cz, 1 attachment}; last_message_at moved;
     *   422 body; 422 "You can attach at most 5 files."; 403; 404.
     */
    public function test_reply(): void
    {
        $thread = $this->thread($this->project(), ['last_message_at' => now()->subDay()]);
        $this->signIn($this->userWith(['web-projects-view']));
        $this->postJson("/api/web/project-threads/{$thread->id}/reply", ['body' => 'x'])->assertStatus(403);

        $this->signIn($this->userWith(['web-projects-update'], ['user_email' => 'admin@firm.cz']));
        $this->post("/api/web/project-threads/{$thread->id}/reply", ['body' => 'Here you go', 'attachments' => [$this->upload('a.pdf')]], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.author_type', 'admin')
            ->assertJsonPath('data.author_label', 'admin@firm.cz')
            ->assertJsonPath('data.attachments.0.original_filename', 'a.pdf');

        $message = $thread->messages()->sole();
        $this->assertStringStartsWith('web/project_threads/', $message->attachments->sole()->path);
        $this->assertTrue($thread->fresh()->last_message_at->isToday());
        $this->assertWebLog('create', "Admin reply in thread ID: {$thread->id}");

        $this->postJson("/api/web/project-threads/{$thread->id}/reply", [])->assertStatus(422)->assertJsonValidationErrors(['body']);
        $six = array_map(fn ($i) => $this->upload("f{$i}.pdf"), range(1, 6));
        $this->post("/api/web/project-threads/{$thread->id}/reply", ['body' => 'Many', 'attachments' => $six], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors.attachments.0', 'You can attach at most 5 files.');
        $this->postJson('/api/web/project-threads/999/reply', ['body' => 'x'])->assertStatus(404);
    }

    /**
     * @description Status change without a reply; only known statuses; 404.
     * @input PUT status closed; PUT status 'archived'; PUT /999.
     * @output 200 {data.status closed}; 422; 404.
     */
    public function test_update_status(): void
    {
        $this->signIn($this->userWith(['web-projects-update']));
        $thread = $this->thread($this->project());

        $this->putJson("/api/web/project-threads/{$thread->id}/status", ['status' => 'closed'])->assertOk()->assertJsonPath('data.status', 'closed');
        $this->assertSame('closed', WebProjectThread::find($thread->id)->status);
        $this->assertWebLog('update', "to 'closed'");
        $this->putJson("/api/web/project-threads/{$thread->id}/status", ['status' => 'archived'])->assertStatus(422);
        $this->putJson('/api/web/project-threads/999/status', ['status' => 'closed'])->assertStatus(404);
    }
}
