<?php

/**
 * @file ProjectPortalTest.php
 * @path api/tests/Feature/Web/ProjectPortalTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the public customer project portal (WebProjectPublicController
 *   + CheckProjectSession middleware): password login by access token, the 24h sliding
 *   session, project detail, logout, threads (list, detail with read marker, older / newer
 *   messages, new thread, new message, status) and the e-mail to the project contact.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage / Mail fakes.
 */

namespace Tests\Feature\Web;

use App\Mail\Web\ProjectThreadActivityMail;
use App\Models\Core\CoreSecurityEvent;
use App\Models\Web\WebProject;
use App\Models\Web\WebProjectSession;
use App\Models\Web\WebProjectThread;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description /api/projects/public/{token}/….
 */
class ProjectPortalTest extends TestCase
{
    use WebFixtures;

    /** @var WebProject Public project of the tests. */
    private WebProject $portal;

    /** @var string Raw session token of $portal. */
    private string $session;

    /**
     * @description Fake disks / mail, a public project with an open session.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        Mail::fake();
        $this->portal = $this->project(['name' => 'Eshop', 'access_token' => 'portal-token']);
        $this->session = $this->portalSession($this->portal);
    }

    /**
     * @description Portal request with the session as Bearer token.
     * @param string $method HTTP method.
     * @param string $path Path after /api/projects/public/portal-token.
     * @param array<string, mixed> $data Body.
     * @return \Illuminate\Testing\TestResponse
     */
    private function portal(string $method, string $path = '', array $data = []): \Illuminate\Testing\TestResponse
    {
        return $this->withToken($this->session)->json($method, "/api/projects/public/portal-token{$path}", $data);
    }

    /**
     * @description Number of recorded security events of a type (rows are aggregated per
     *   IP / route / time bucket, so the occurrences are summed).
     * @param string $type Event type.
     * @return int
     */
    private function events(string $type): int
    {
        return (int) CoreSecurityEvent::where('event_type', $type)->sum('occurrences');
    }

    /**
     * @description Login: unknown token and private project answer the same 404 (recorded),
     *   wrong password 401 (recorded), right password opens a 24h session and returns the
     *   project with its checkpoints - never the password hash or the access token.
     * @input Token 'nope'; private project; wrong password; right password; missing password.
     * @output 404 + event; 404 + event; 401 + project_login_failed; 200 {session_token (64),
     *   expires_in 86400, project.checkpoints}; 422.
     */
    public function test_login(): void
    {
        $this->project(['access_token' => 'private-token', 'visibility' => 'private']);
        $this->portal->checkpoints()->create(['label' => 'Design']);

        $this->postJson('/api/projects/public/nope/login', ['password' => 'x'])->assertStatus(404)->assertJson(['message' => 'Project not found or unavailable.']);
        $this->postJson('/api/projects/public/private-token/login', ['password' => $this->projectPassword])->assertStatus(404);
        $this->assertSame(2, $this->events('project_login_invalid_token'));
        $this->postJson('/api/projects/public/portal-token/login', ['password' => 'wrong'])->assertStatus(401)->assertJson(['message' => 'Invalid password.']);
        $this->assertSame(1, $this->events('project_login_failed'));
        $this->postJson('/api/projects/public/portal-token/login', [])->assertStatus(422)->assertJsonValidationErrors(['password']);

        $json = $this->postJson('/api/projects/public/portal-token/login', ['password' => $this->projectPassword])
            ->assertOk()->assertJsonPath('expires_in', 86400)->assertJsonPath('project.name', 'Eshop')
            ->assertJsonPath('project.checkpoints.0.label', 'Design')->json();
        $this->assertSame(64, strlen($json['session_token']));
        $this->assertArrayNotHasKey('access_token', $json['project']);
        $this->assertArrayNotHasKey('access_password_hash', $json['project']);
        $this->assertNotNull(WebProjectSession::findValidByPlaintextToken($json['session_token']));
    }

    /**
     * @description Login is limited to 10 attempts a minute per IP.
     * @input 10 wrong passwords, then the right one.
     * @output 11th answers 429.
     */
    public function test_login_rate_limit(): void
    {
        foreach (range(1, 10) as $i) {
            $this->postJson('/api/projects/public/portal-token/login', ['password' => 'wrong'])->assertStatus(401);
        }
        $this->postJson('/api/projects/public/portal-token/login', ['password' => $this->projectPassword])->assertStatus(429);
    }

    /**
     * @description The session guard: project must exist and be public on every request,
     *   a session is required, must be valid, unexpired and belong to this project; each
     *   request slides the expiry; the token is accepted only as Bearer header (never as
     *   session_token query / body input - it would end up in access logs, finding #1).
     * @input No token; unknown project; project switched to private; garbage token; another
     *   project's session; expired session; session_token query / body input; valid request after 23h.
     * @output 401 "Authentication required."; 404 (logged); 401 (logged ×3); 401 for query / body token; expiry moved; 401 after expiry (logged); 404 once private (logged).
     */
    public function test_session_guard(): void
    {
        $this->getJson('/api/projects/public/portal-token')->assertStatus(401)->assertJson(['message' => 'Authentication required.']);
        $this->withToken($this->session)->getJson('/api/projects/public/nope')->assertStatus(404);

        $this->withToken('garbage')->getJson('/api/projects/public/portal-token')->assertStatus(401)
            ->assertJson(['message' => 'The session has expired or is invalid. Please log in again.']);
        $foreign = $this->portalSession($this->project());
        $this->withToken($foreign)->getJson('/api/projects/public/portal-token')->assertStatus(401);
        $this->withoutToken()->getJson("/api/projects/public/portal-token?session_token={$this->session}")->assertStatus(401)->assertJson(['message' => 'Authentication required.']);
        $this->withoutToken()->postJson('/api/projects/public/portal-token/logout', ['session_token' => $this->session])->assertStatus(401);
        $this->withToken($this->session)->getJson('/api/projects/public/portal-token')->assertOk()->assertJsonPath('name', 'Eshop');

        $this->travel(23)->hours();
        $this->portal('GET')->assertOk();
        $this->assertTrue(WebProjectSession::where('project_id', $this->portal->id)->sole()->expires_at->gt(now()->addHours(23)));
        $this->travel(25)->hours();
        $this->portal('GET')->assertStatus(401);
        $this->assertSame(4, $this->events('project_session_invalid'));

        $this->travelBack();
        $fresh = $this->portalSession($this->portal);
        $this->portal->update(['visibility' => 'private']);
        $this->withToken($fresh)->getJson('/api/projects/public/portal-token')->assertStatus(404)
            ->assertJson(['message' => 'The project was not found or is not available.']);
        $this->assertSame(5, $this->events('project_session_invalid'));
    }

    /**
     * @description Project detail and logout (the session is gone afterwards).
     * @input GET /; POST logout; GET / again.
     * @output 200 {name, checkpoints}; 200 "Logout successful."; 401.
     */
    public function test_me_and_logout(): void
    {
        $this->portal->checkpoints()->create(['label' => 'Build']);

        $this->portal('GET')->assertOk()->assertJsonPath('name', 'Eshop')->assertJsonPath('checkpoints.0.label', 'Build')->assertJsonMissingPath('access_token');
        $this->portal('POST', '/logout')->assertOk()->assertJson(['message' => 'Logout successful.']);
        $this->assertSame(0, WebProjectSession::count());
        $this->portal('GET')->assertStatus(401);
    }

    /**
     * @description Threads list only of the own project with unread admin replies counted
     *   from the customer's read marker; the detail sets the marker; another project's thread 404.
     * @input Own thread: 2 admin replies (one before, one after the read marker) + 1 customer message;
     *        unread thread with 1 admin reply; foreign thread.
     * @output 2 threads, unread 1 and 1; detail 200 has_more false and unread 0 afterwards; foreign 404.
     */
    public function test_threads_index_and_show(): void
    {
        $read = $this->thread($this->portal, ['customer_last_read_at' => now()->subHour()], [['customer', 'Hi']]);
        $read->messages()->create(['author_type' => 'admin', 'body' => 'Old'])->forceFill(['created_at' => now()->subHours(2)])->save();
        $read->messages()->create(['author_type' => 'admin', 'body' => 'New']);
        $unread = $this->thread($this->portal, ['subject' => 'Unread'], [['admin', 'Answer']]);
        $foreign = $this->thread($this->project(), [], [['admin', 'Secret']]);

        $list = collect($this->portal('GET', '/threads')->assertOk()->assertJsonCount(2)->json())->keyBy('id');
        $this->assertSame(1, $list[$read->id]['unread_count']);
        $this->assertSame(1, $list[$unread->id]['unread_count']);

        $this->portal('GET', "/threads/{$unread->id}")->assertOk()->assertJsonPath('has_more_older_messages', false)->assertJsonPath('messages.0.body', 'Answer');
        $this->assertNotNull($unread->fresh()->customer_last_read_at);
        $this->portal('GET', "/threads/{$foreign->id}")->assertStatus(404)->assertJson(['message' => 'Thread not found.']);
    }

    /**
     * @description Older messages page and polling for newer messages (marks read only when
     *   something new arrived); foreign thread 404 on both.
     * @input Thread with 3 messages; older before #3 limit 1; newer after #1; newer after #3.
     * @output [#2] has_more true; [#2, #3] + status, read marker set; [] marker untouched; 404s.
     */
    public function test_older_and_new_messages(): void
    {
        $thread = $this->thread($this->portal, [], [['customer', 'One'], ['admin', 'Two'], ['admin', 'Three']]);
        $ids = $thread->messages()->pluck('id')->all();
        $foreign = $this->thread($this->project());

        $this->portal('GET', "/threads/{$thread->id}/messages?before_message_id={$ids[2]}&limit=1")
            ->assertOk()->assertJsonPath('data.0.body', 'Two')->assertJsonPath('has_more_older_messages', true);
        $this->portal('GET', "/threads/{$thread->id}/messages")->assertJsonCount(3, 'data');

        $this->portal('GET', "/threads/{$thread->id}/new-messages?after_id={$ids[2]}")->assertOk()->assertJsonCount(0, 'data');
        $this->assertNull($thread->fresh()->customer_last_read_at);
        $this->portal('GET', "/threads/{$thread->id}/new-messages?after_id={$ids[0]}")
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('status', 'active');
        $this->assertNotNull($thread->fresh()->customer_last_read_at);

        $this->portal('GET', "/threads/{$foreign->id}/messages")->assertStatus(404);
        $this->portal('GET', "/threads/{$foreign->id}/new-messages")->assertStatus(404);
    }

    /**
     * @description New thread from the customer: first message + attachments, read marker set,
     *   the project contact is e-mailed; validation.
     * @input POST threads {subject, priority, body, attachments: [s.png]}; POST invalid priority.
     * @output 201 {opened_by customer, status active, 1 message with 1 attachment, unread 0};
     *   ProjectThreadActivityMail queued to pm@example.com (new thread); 422.
     */
    public function test_thread_store(): void
    {
        $this->withToken($this->session)->post('/api/projects/public/portal-token/threads', [
            'subject' => 'Logo', 'priority' => 'high', 'body' => 'Please change it', 'attachments' => [$this->upload('s.png', 1, 'image/png')],
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('opened_by', 'customer')->assertJsonPath('status', 'active')->assertJsonPath('unread_count', 0)
            ->assertJsonPath('messages.0.body', 'Please change it')->assertJsonPath('messages.0.author_type', 'customer')
            ->assertJsonCount(1, 'messages.0.attachments');

        $this->assertStringStartsWith('web/project_threads/', WebProjectThread::sole()->messages()->sole()->attachments->sole()->path);
        Mail::assertQueued(ProjectThreadActivityMail::class, fn ($mail) => $mail->hasTo('pm@example.com') && $mail->isNewThread);
        $this->portal('POST', '/threads', ['subject' => 'X', 'priority' => 'urgent', 'body' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['priority']);
    }

    /**
     * @description New message in an own thread bumps activity and the read marker and
     *   notifies the contact; no contact e-mail → no mail; foreign thread 404; validation.
     * @input Own thread: POST message; contact e-mail removed: POST message; foreign thread; POST {}.
     * @output 201 {author_type customer}; 1 mail (not new thread); still 1 mail; 404; 422.
     */
    public function test_message_store(): void
    {
        $thread = $this->thread($this->portal, ['last_message_at' => now()->subDay()]);
        $foreign = $this->thread($this->project());

        $this->portal('POST', "/threads/{$thread->id}/messages", ['body' => 'Any news?'])->assertCreated()
            ->assertJsonPath('author_type', 'customer')->assertJsonPath('author_label', null);
        $this->assertTrue($thread->fresh()->last_message_at->isToday());
        $this->assertNotNull($thread->fresh()->customer_last_read_at);
        Mail::assertQueued(ProjectThreadActivityMail::class, fn ($mail) => !$mail->isNewThread);

        $this->portal->update(['contact_email' => null]);
        $this->portal('POST', "/threads/{$thread->id}/messages", ['body' => 'Hello?'])->assertCreated();
        Mail::assertQueuedCount(1);

        $this->portal('POST', "/threads/{$foreign->id}/messages", ['body' => 'x'])->assertStatus(404);
        $this->portal('POST', "/threads/{$thread->id}/messages", [])->assertStatus(422);
    }

    /**
     * @description A failing notification e-mail never fails the customer's message; it is logged.
     * @input Mailer throws; POST message.
     * @output 201; Log::error "Sending project thread activity notification failed" with project/thread ids.
     */
    public function test_notification_failure_is_logged(): void
    {
        $thread = $this->thread($this->portal);
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));
        Log::spy();

        $this->portal('POST', "/threads/{$thread->id}/messages", ['body' => 'Hi'])->assertCreated();

        Log::shouldHaveReceived('error')->withArgs(fn ($msg, $ctx) => str_starts_with($msg, 'Sending project thread activity notification failed')
            && $ctx === ['project_id' => $this->portal->id, 'thread_id' => $thread->id])->once();
    }

    /**
     * @description The customer can close / reopen an own thread only.
     * @input POST status closed; POST status 'x'; foreign thread.
     * @output 200 {status closed}; 422; 404.
     */
    public function test_update_status(): void
    {
        $thread = $this->thread($this->portal);
        $foreign = $this->thread($this->project());

        $this->portal('POST', "/threads/{$thread->id}/status", ['status' => 'closed'])->assertOk()->assertJsonPath('status', 'closed');
        $this->portal('POST', "/threads/{$thread->id}/status", ['status' => 'x'])->assertStatus(422);
        $this->portal('POST', "/threads/{$foreign->id}/status", ['status' => 'closed'])->assertStatus(404);
        $this->assertSame('active', $foreign->fresh()->status);
    }
}
