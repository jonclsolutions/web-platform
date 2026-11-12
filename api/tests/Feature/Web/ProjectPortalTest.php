<?php

/**
 * @file ProjectPortalTest.php
 * @path api/tests/Feature/Web/ProjectPortalTest.php
 * @project JS web-platform
 * @author JS
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
use App\Models\Web\WebLog;
use App\Models\Web\WebProject;
use App\Models\Web\WebProjectSession;
use App\Models\Web\WebProjectThread;
use App\Support\Auth\AuthCookies;
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
     * @description Portal request with the session in its cookie (as the browser sends it).
     * @param string $method HTTP method.
     * @param string $path Path after /api/projects/public/portal-token.
     * @param array<string, mixed> $data Body.
     * @return \Illuminate\Testing\TestResponse
     */
    private function portal(string $method, string $path = '', array $data = []): \Illuminate\Testing\TestResponse
    {
        return $this->withPortalSession($this->session)->json($method, "/api/projects/public/portal-token{$path}", $data);
    }

    /**
     * @description Sets the portal session cookie of the next requests (null = no cookie).
     * @param string|null $session Raw session token.
     * @return static
     */
    private function withPortalSession(?string $session): static
    {
        $this->unencryptedCookies = [];

        // JSON test requests send cookies only "with credentials" - like the browser's XHR.
        return $session === null ? $this : $this->withCredentials()->withUnencryptedCookie(AuthCookies::PORTAL, $session);
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
     *   project with its checkpoints - never the password hash or the access token. The session
     *   is ONLY in the HttpOnly cookie limited to the routes of this project, never in the body.
     * @input Token 'nope'; private project; wrong password; right password; missing password.
     * @output 404 + event; 404 + event; 401 + project_login_failed; 200 {expires_in 86400,
     *   project.checkpoints} without session_token; cookie (64 chars, HttpOnly, SameSite=Strict,
     *   Path /api/projects/public/portal-token) of a valid session; 422.
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

        $response = $this->postJson('/api/projects/public/portal-token/login', ['password' => $this->projectPassword])
            ->assertOk()->assertJsonPath('data.expires_in', 86400)->assertJsonPath('data.project.name', 'Eshop')
            ->assertJsonPath('data.project.checkpoints.0.label', 'Design');
        $json = $response->json('data');
        $this->assertArrayNotHasKey('session_token', $json);
        $this->assertArrayNotHasKey('access_token', $json['project']);
        $this->assertArrayNotHasKey('access_password_hash', $json['project']);
        $session = (string) $this->credentialCookie($response, AuthCookies::PORTAL, '/api/projects/public/portal-token')->getValue();
        $this->assertSame(64, strlen($session));
        $this->assertNotNull(WebProjectSession::findValidByPlaintextToken($session));
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
     *   request slides the expiry (DB row and cookie); the token is accepted only from its
     *   HttpOnly cookie (never as Bearer header, session_token query or body input); an invalid
     *   session deletes the cookie.
     * @input No cookie; unknown project; project switched to private; garbage cookie; another
     *   project's session; Bearer header / query / body token; expired session; valid request after 23h.
     * @output 401 "Authentication required."; 404 (logged); 401 (logged ×3) with the cookie
     *   deleted; 401 for header / query / body token; expiry and cookie moved; 401 after expiry
     *   (logged); 404 once private (logged).
     */
    public function test_session_guard(): void
    {
        $path = '/api/projects/public/portal-token';
        $this->getJson($path)->assertStatus(401)->assertJson(['message' => 'Authentication required.']);
        $this->withPortalSession($this->session)->getJson('/api/projects/public/nope')->assertStatus(404);

        $garbage = $this->withPortalSession('garbage')->getJson($path)->assertStatus(401)
            ->assertJson(['message' => 'The session has expired or is invalid. Please log in again.']);
        $this->assertCredentialCookieCleared($garbage, AuthCookies::PORTAL, $path);
        $foreign = $this->portalSession($this->project());
        $this->withPortalSession($foreign)->getJson($path)->assertStatus(401);
        $this->withPortalSession(null)->withToken($this->session)->getJson($path)->assertStatus(401)->assertJson(['message' => 'Authentication required.']);
        $this->withoutToken()->getJson("{$path}?session_token={$this->session}")->assertStatus(401)->assertJson(['message' => 'Authentication required.']);
        $this->postJson("{$path}/logout", ['session_token' => $this->session])->assertStatus(401);
        $this->withPortalSession($this->session)->getJson($path)->assertOk()->assertJsonPath('data.name', 'Eshop');

        $this->travel(23)->hours();
        $slid = $this->portal('GET')->assertOk();
        $this->assertTrue(WebProjectSession::where('project_id', $this->portal->id)->sole()->expires_at->gt(now()->addHours(23)));
        $cookie = $this->credentialCookie($slid, AuthCookies::PORTAL, $path);
        $this->assertSame($this->session, $cookie->getValue());
        $this->assertGreaterThan(now()->addHours(23)->getTimestamp(), $cookie->getExpiresTime());
        $this->travel(25)->hours();
        $this->portal('GET')->assertStatus(401);
        $this->assertSame(4, $this->events('project_session_invalid'));

        $this->travelBack();
        $fresh = $this->portalSession($this->portal);
        $this->portal->update(['visibility' => 'private']);
        $this->withPortalSession($fresh)->getJson('/api/projects/public/portal-token')->assertStatus(404)
            ->assertJson(['message' => 'The project was not found or is not available.']);
        $this->assertSame(5, $this->events('project_session_invalid'));
    }

    /**
     * @description Project detail and logout (the session is gone afterwards, the cookie deleted).
     * @input GET /; POST logout; GET / again.
     * @output 200 {name, checkpoints with title + description}; 200 "Logout successful." + expired cookie; 401.
     */
    public function test_me_and_logout(): void
    {
        $this->portal->checkpoints()->create(['label' => 'Build', 'description' => 'Templates and pages']);

        $this->portal('GET')->assertOk()->assertJsonPath('data.name', 'Eshop')->assertJsonPath('data.checkpoints.0.label', 'Build')->assertJsonPath('data.checkpoints.0.description', 'Templates and pages')->assertJsonMissingPath('data.access_token');
        $logout = $this->portal('POST', '/logout')->assertOk()->assertJson(['message' => 'Logout successful.']);
        $this->assertCredentialCookieCleared($logout, AuthCookies::PORTAL, '/api/projects/public/portal-token');
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

        $list = collect($this->portal('GET', '/threads')->assertOk()->assertJsonCount(2, 'data')->json('data'))->keyBy('id');
        $this->assertSame(1, $list[$read->id]['unread_count']);
        $this->assertSame(1, $list[$unread->id]['unread_count']);

        $this->portal('GET', "/threads/{$unread->id}")->assertOk()->assertJsonPath('meta.has_more_older_messages', false)->assertJsonPath('data.messages.0.body', 'Answer');
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
            ->assertOk()->assertJsonPath('data.0.body', 'Two')->assertJsonPath('meta.has_more_older_messages', true);
        $this->portal('GET', "/threads/{$thread->id}/messages")->assertJsonCount(3, 'data');

        $this->portal('GET', "/threads/{$thread->id}/new-messages?after_id={$ids[2]}")->assertOk()->assertJsonCount(0, 'data');
        $this->assertNull($thread->fresh()->customer_last_read_at);
        $this->portal('GET', "/threads/{$thread->id}/new-messages?after_id={$ids[0]}")
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.status', 'active');
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
        $this->withPortalSession($this->session)->post('/api/projects/public/portal-token/threads', [
            'subject' => 'Logo', 'priority' => 'high', 'body' => 'Please change it', 'attachments' => [$this->upload('s.png', 1, 'image/png')],
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('data.opened_by', 'customer')->assertJsonPath('data.status', 'active')->assertJsonPath('data.unread_count', 0)
            ->assertJsonPath('data.messages.0.body', 'Please change it')->assertJsonPath('data.messages.0.author_type', 'customer')
            ->assertJsonCount(1, 'data.messages.0.attachments');

        $this->assertStringStartsWith('web/project_threads/', WebProjectThread::sole()->messages()->sole()->attachments->sole()->path);
        Mail::assertQueued(ProjectThreadActivityMail::class, fn ($mail) => $mail->hasTo('pm@example.com') && $mail->isNewThread);
        $this->portal('POST', '/threads', ['subject' => 'X', 'priority' => 'urgent', 'body' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['priority']);
    }

    /**
     * @description VT-02: the customer cannot upload a file a browser would run as a page - SVG is
     *   off the whitelist, and an HTML page with an image name is refused by its detected content.
     * @input POST thread with logo.svg (script); POST thread with photo.png that is an HTML page;
     *        POST message with logo.svg; POST thread with a real PNG.
     * @output 422 attachments.0 three times, no thread / message stored by them; 201 for the PNG.
     */
    public function test_attachments_that_could_run_a_script_are_refused(): void
    {
        $thread = $this->thread($this->portal);
        $send = fn (string $path, array $data) => $this->withPortalSession($this->session)->post('/api/projects/public/portal-token' . $path, $data, ['Accept' => 'application/json']);
        $threadData = ['subject' => 'Logo', 'priority' => 'high', 'body' => 'See the file'];

        $send('/threads', $threadData + ['attachments' => [$this->uploadWithContent('logo.svg', self::SVG_XSS)]])
            ->assertStatus(422)->assertJsonValidationErrors(['attachments.0']);
        $send('/threads', $threadData + ['attachments' => [$this->uploadWithContent('photo.png', self::HTML_XSS)]])
            ->assertStatus(422)->assertJsonValidationErrors(['attachments.0']);
        $send("/threads/{$thread->id}/messages", ['body' => 'x', 'attachments' => [$this->uploadWithContent('logo.svg', self::SVG_XSS)]])
            ->assertStatus(422)->assertJsonValidationErrors(['attachments.0']);
        $this->assertSame(1, WebProjectThread::count());
        $this->assertSame(0, $thread->messages()->count());

        $send('/threads', $threadData + ['attachments' => [$this->uploadWithContent('photo.png', self::PNG_BYTES)]])->assertCreated();
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
            ->assertJsonPath('data.author_type', 'customer')->assertJsonPath('data.author_label', null);
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

        $this->portal('POST', "/threads/{$thread->id}/status", ['status' => 'closed'])->assertOk()->assertJsonPath('data.status', 'closed');
        $this->portal('POST', "/threads/{$thread->id}/status", ['status' => 'x'])->assertStatus(422);
        $this->portal('POST', "/threads/{$foreign->id}/status", ['status' => 'closed'])->assertStatus(404);
        $this->assertSame('active', $foreign->fresh()->status);
    }

    /**
     * @description The client's actions are written to the web log (module WebProjectPortal):
     *   sign-in, new thread (request), closing / reopening it, sign-out - single messages are not
     *   logged (they are the conversation itself); never the message text or the password; a
     *   stored message shows its body only as [masked] in the data changes.
     * @input Login; POST thread (body 'Secret plan'); POST message (body 'Secret reply'); status
     *   closed; logout.
     * @output web log events portal_login, portal_thread_create, portal_thread_status ('closed'),
     *   portal_logout; no 'Secret' / password anywhere in the log.
     */
    public function test_client_actions_are_logged(): void
    {
        $this->postJson('/api/projects/public/portal-token/login', ['password' => $this->projectPassword])->assertOk();
        $this->portal('POST', '/threads', ['subject' => 'Logo', 'priority' => 'high', 'body' => 'Secret plan'])->assertCreated();
        $thread = WebProjectThread::sole();
        $this->portal('POST', "/threads/{$thread->id}/messages", ['body' => 'Secret reply'])->assertCreated();
        $this->portal('POST', "/threads/{$thread->id}/status", ['status' => 'closed'])->assertOk();
        $this->portal('POST', '/logout')->assertOk();

        $rows = WebLog::orderBy('id')->get();
        $this->assertSame(['portal_login', 'portal_thread_create', 'portal_thread_status', 'portal_logout'], $rows->pluck('event_type')->all());
        $this->assertStringContainsString("Client closed thread #{$thread->id}", $rows[2]->description);
        $this->assertSame(['WebProjectPortal'], $rows->pluck('module')->unique()->values()->all());
        $all = $rows->toJson();
        $this->assertStringNotContainsString('Secret', $all);
        $this->assertStringNotContainsString($this->projectPassword, $all);
        $this->assertStringContainsString('[masked]', $all);
    }
}
