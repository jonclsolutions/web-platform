<?php

/**
 * @file ProjectPortalTest.php
 * @path api/tests/Apps/ProjectPortal/Feature/ProjectPortalTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the public customer project portal (ProjectPublicController
 *   + CheckProjectSession middleware): login of a client account (login name + password) by
 *   access token, the 24h sliding session of the account, project detail with the signed-in
 *   account, logout, threads (list, detail with read marker, older / newer messages, new thread,
 *   new message, status, whose turn it is), files of the conversations, internal notes and
 *   internal checkpoint notes never visible, and the e-mail to the team.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures; Storage / Mail fakes.
 */

namespace Tests\Apps\ProjectPortal\Feature;

use App\Apps\ProjectPortal\Mail\ProjectThreadActivityMail;
use App\Models\Core\CoreSecurityEvent;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectSession;
use App\Apps\ProjectPortal\Models\ProjectThread;
use App\Apps\ProjectPortal\Support\PortalCookie;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description /api/projects/public/{token}/….
 */
class ProjectPortalTest extends TestCase
{
    use ProjectFixtures;

    /** @var Project Public project of the tests. */
    private Project $portal;

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
        return $session === null ? $this : $this->withCredentials()->withUnencryptedCookie(PortalCookie::NAME, $session);
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
     *   wrong password and unknown login name the same 401 (recorded), right login name (any case,
     *   spaces around) + password opens a 24h session of the account and returns the project with
     *   its checkpoints and the signed-in account - never a password hash or the access token. The
     *   session is ONLY in the HttpOnly cookie limited to the routes of this project, never in the body.
     * @input Token 'nope'; private project; wrong password; unknown login name; missing fields;
     *   account with a damaged hash 'x'; ' KLIENT ' + right password.
     * @output 404 + event; 404 + event; 401 ×2 + project_login_failed ×2; 422 username + password;
     *   401 for the damaged hash;
     *   200 {expires_in 86400, project.checkpoints, project.account (klient, Klient)} without
     *   session_token; cookie (64 chars, Path /api/projects/public/portal-token) of a valid session
     *   of the account; last_login_at set.
     */
    public function test_login(): void
    {
        $this->project(['access_token' => 'private-token', 'visibility' => 'private']);
        $this->portal->checkpoints()->create(['label' => 'Design']);

        $this->postJson('/api/projects/public/nope/login', ['username' => 'klient', 'password' => 'x'])->assertStatus(404)->assertJson(['message' => 'Project not found or unavailable.']);
        $this->postJson('/api/projects/public/private-token/login', ['username' => 'klient', 'password' => $this->projectPassword])->assertStatus(404);
        $this->assertSame(2, $this->events('project_login_invalid_token'));
        $this->postJson('/api/projects/public/portal-token/login', ['username' => 'klient', 'password' => 'wrong'])->assertStatus(401)->assertJson(['message' => 'Invalid login name or password.']);
        $this->postJson('/api/projects/public/portal-token/login', ['username' => 'nobody', 'password' => $this->projectPassword])->assertStatus(401)->assertJson(['message' => 'Invalid login name or password.']);
        $this->assertSame(2, $this->events('project_login_failed'));
        $this->postJson('/api/projects/public/portal-token/login', [])->assertStatus(422)->assertJsonValidationErrors(['username', 'password']);
        // A stored value that is not a password hash (damaged data) is a failed sign-in, not an error.
        $broken = $this->portalAccount($this->portal, 'broken', 'Broken');
        $broken->forceFill(['password_hash' => 'x'])->save();
        $this->postJson('/api/projects/public/portal-token/login', ['username' => 'broken', 'password' => 'x'])->assertStatus(401);
        $this->assertFalse($broken->fresh()->verifyPassword('x'));
        $broken->delete();

        $response = $this->postJson('/api/projects/public/portal-token/login', ['username' => ' KLIENT ', 'password' => $this->projectPassword])
            ->assertOk()->assertJsonPath('data.expires_in', 86400)->assertJsonPath('data.project.name', 'Eshop')
            ->assertJsonPath('data.project.checkpoints.0.label', 'Design')
            ->assertJsonPath('data.project.account.username', 'klient')->assertJsonPath('data.project.account.display_name', 'Klient');
        $json = $response->json('data');
        $this->assertArrayNotHasKey('session_token', $json);
        $this->assertArrayNotHasKey('access_token', $json['project']);
        $this->assertStringNotContainsString('password_hash', $response->getContent());
        $session = (string) $this->credentialCookie($response, PortalCookie::NAME, '/api/projects/public/portal-token')->getValue();
        $this->assertSame(64, strlen($session));
        $account = $this->portal->accounts()->sole();
        $this->assertSame($account->id, ProjectSession::findValidByPlaintextToken($session)->account_id);
        $this->assertNotNull($account->fresh()->last_login_at);
    }

    /**
     * @description Several client accounts per project: each signs in with its own login name and
     *   its messages carry its name; removing an account / resetting its password ends its session
     *   at once (the other account stays signed in).
     * @input Second account "eva"; login as eva; message of eva; session of eva after the account is
     *   deleted; session of klient after its password hash changes and its sessions are deleted.
     * @output 200 login (account eva); message author_label 'Eva Nova' + author_account_id of eva;
     *   401 for eva's session after removal; klient's session works until its sessions are deleted, then 401.
     */
    public function test_several_accounts_and_ending_their_sessions(): void
    {
        $eva = $this->portalAccount($this->portal, 'eva', 'Eva Nova');
        $this->postJson('/api/projects/public/portal-token/login', ['username' => 'eva', 'password' => $this->projectPassword])
            ->assertOk()->assertJsonPath('data.project.account.id', $eva->id);
        $evaSession = $this->portalSession($this->portal, $eva);
        $thread = $this->thread($this->portal);

        $this->withPortalSession($evaSession)->postJson("/api/projects/public/portal-token/threads/{$thread->id}/messages", ['body' => 'From Eva'])
            ->assertCreated()->assertJsonPath('data.author_label', 'Eva Nova')->assertJsonPath('data.author_account_id', $eva->id);
        $this->withPortalSession($evaSession)->getJson('/api/projects/public/portal-token')->assertOk()->assertJsonPath('data.account.display_name', 'Eva Nova');

        $eva->delete();
        $this->withPortalSession($evaSession)->getJson('/api/projects/public/portal-token')->assertStatus(401);
        $this->portal('GET')->assertOk()->assertJsonPath('data.account.username', 'klient');
        $this->portal->accounts()->sole()->sessions()->delete();
        $this->portal('GET')->assertStatus(401);
    }

    /**
     * @description Login is limited to 10 attempts a minute per IP.
     * @input 10 wrong passwords, then the right one.
     * @output 11th answers 429.
     */
    public function test_login_rate_limit(): void
    {
        foreach (range(1, 10) as $i) {
            $this->postJson('/api/projects/public/portal-token/login', ['username' => 'klient', 'password' => 'wrong'])->assertStatus(401);
        }
        $this->postJson('/api/projects/public/portal-token/login', ['username' => 'klient', 'password' => $this->projectPassword])->assertStatus(429);
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
        $this->assertCredentialCookieCleared($garbage, PortalCookie::NAME, $path);
        $foreign = $this->portalSession($this->project());
        $this->withPortalSession($foreign)->getJson($path)->assertStatus(401);
        $this->withPortalSession(null)->withToken($this->session)->getJson($path)->assertStatus(401)->assertJson(['message' => 'Authentication required.']);
        $this->withoutToken()->getJson("{$path}?session_token={$this->session}")->assertStatus(401)->assertJson(['message' => 'Authentication required.']);
        $this->postJson("{$path}/logout", ['session_token' => $this->session])->assertStatus(401);
        $this->withPortalSession($this->session)->getJson($path)->assertOk()->assertJsonPath('data.name', 'Eshop');

        $this->travel(23)->hours();
        $slid = $this->portal('GET')->assertOk();
        $this->assertTrue(ProjectSession::where('project_id', $this->portal->id)->sole()->expires_at->gt(now()->addHours(23)));
        $cookie = $this->credentialCookie($slid, PortalCookie::NAME, $path);
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
     *   Checkpoints come with title, description and due date - never the internal note of the team.
     * @input Checkpoint with description, due date and internal note; GET /; POST logout; GET / again.
     * @output 200 {name, account, checkpoints (title, description, due_date, no internal_note)};
     *   200 "Logout successful." + expired cookie; 401.
     */
    public function test_me_and_logout(): void
    {
        $this->portal->checkpoints()->create(['label' => 'Build', 'description' => 'Templates and pages', 'due_date' => '2026-12-24', 'internal_note' => 'Team only']);

        $me = $this->portal('GET')->assertOk()->assertJsonPath('data.name', 'Eshop')->assertJsonPath('data.checkpoints.0.label', 'Build')
            ->assertJsonPath('data.checkpoints.0.description', 'Templates and pages')->assertJsonPath('data.checkpoints.0.due_date', '2026-12-24')
            ->assertJsonPath('data.account.username', 'klient')
            ->assertJsonMissingPath('data.access_token')->assertJsonMissingPath('data.checkpoints.0.internal_note');
        $this->assertStringNotContainsString('Team only', $me->getContent());
        $logout = $this->portal('POST', '/logout')->assertOk()->assertJson(['message' => 'Logout successful.']);
        $this->assertCredentialCookieCleared($logout, PortalCookie::NAME, '/api/projects/public/portal-token');
        $this->assertSame(0, ProjectSession::count());
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
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.status', 'active')->assertJsonPath('meta.waiting_on', 'customer');
        $this->assertNotNull($thread->fresh()->customer_last_read_at);

        $this->portal('GET', "/threads/{$foreign->id}/messages")->assertStatus(404);
        $this->portal('GET', "/threads/{$foreign->id}/new-messages")->assertStatus(404);
    }

    /**
     * @description New thread from the customer: first message + attachments, read marker set,
     *   the project contact is e-mailed; validation.
     * @input POST threads {subject, priority, body, attachments: [s.png]}; POST invalid priority.
     * @output 201 {opened_by customer, status active, waiting on the supplier, 1 message of the
     *   account with 1 attachment, unread 0}; ProjectThreadActivityMail queued to pm@example.com
     *   (new thread, no assignee); 422.
     */
    public function test_thread_store(): void
    {
        $this->withPortalSession($this->session)->post('/api/projects/public/portal-token/threads', [
            'subject' => 'Logo', 'priority' => 'high', 'body' => 'Please change it', 'attachments' => [$this->upload('s.png', 1, 'image/png')],
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('data.opened_by', 'customer')->assertJsonPath('data.status', 'active')->assertJsonPath('data.unread_count', 0)
            ->assertJsonPath('data.waiting_on', 'supplier')->assertJsonPath('data.messages.0.author_label', 'Klient')
            ->assertJsonPath('data.messages.0.body', 'Please change it')->assertJsonPath('data.messages.0.author_type', 'customer')
            ->assertJsonCount(1, 'data.messages.0.attachments');

        $this->assertStringStartsWith('web/project_threads/', ProjectThread::sole()->messages()->sole()->attachments->sole()->path);
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
        $this->assertSame(1, ProjectThread::count());
        $this->assertSame(0, $thread->messages()->count());

        $send('/threads', $threadData + ['attachments' => [$this->uploadWithContent('photo.png', self::PNG_BYTES)]])->assertCreated();
    }

    /**
     * @description New message in an own thread bumps activity and the read marker, makes it the
     *   supplier's turn and notifies the team: the responsible administrator when set, else the
     *   project contact; neither → no mail; foreign thread 404; validation.
     * @input Own thread (last author admin): POST message; contact e-mail removed: POST message;
     *   assignee set: POST message; foreign thread; POST {}.
     * @output 201 {author_type customer, author_label Klient}; waiting on supplier; 1 mail (not new
     *   thread); still 1 mail; mail to the assignee; 404; 422.
     */
    public function test_message_store(): void
    {
        $thread = $this->thread($this->portal, ['last_message_at' => now()->subDay(), 'last_public_author' => 'admin']);
        $foreign = $this->thread($this->project());
        $this->assertSame('customer', $thread->waitingOn());

        $this->portal('POST', "/threads/{$thread->id}/messages", ['body' => 'Any news?'])->assertCreated()
            ->assertJsonPath('data.author_type', 'customer')->assertJsonPath('data.author_label', 'Klient');
        $this->assertTrue($thread->fresh()->last_message_at->isToday());
        $this->assertNotNull($thread->fresh()->customer_last_read_at);
        $this->assertSame('supplier', $thread->fresh()->waitingOn());
        Mail::assertQueued(ProjectThreadActivityMail::class, fn ($mail) => !$mail->isNewThread && $mail->hasTo('pm@example.com'));

        $this->portal->update(['contact_email' => null]);
        $this->portal('POST', "/threads/{$thread->id}/messages", ['body' => 'Hello?'])->assertCreated();
        Mail::assertQueuedCount(1);

        $admin = $this->userWith(['project-portal-projects-update']);
        $this->portal->update(['assignee_id' => $admin->id]);
        $this->portal('POST', "/threads/{$thread->id}/messages", ['body' => 'Hello again'])->assertCreated();
        Mail::assertQueued(ProjectThreadActivityMail::class, fn ($mail) => $mail->hasTo($admin->user_email));

        $this->portal('POST', "/threads/{$foreign->id}/messages", ['body' => 'x'])->assertStatus(404);
        $this->portal('POST', "/threads/{$thread->id}/messages", [])->assertStatus(422);
    }

    /**
     * @description A failing notification e-mail never fails the customer's message; the error is
     *   reported (core log with the stack trace).
     * @input Mailer throws; POST message.
     * @output 201; RuntimeException reported.
     */
    public function test_notification_failure_is_reported(): void
    {
        $thread = $this->thread($this->portal);
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));
        Exceptions::fake();

        $this->portal('POST', "/threads/{$thread->id}/messages", ['body' => 'Hi'])->assertCreated();

        Exceptions::assertReported(\RuntimeException::class);
    }

    /**
     * @description Internal notes of the team never reach the client: not in the list, the
     *   detail, older / newer messages or the files; they do not count as unread and do not change
     *   whose turn it is.
     * @input Thread: client message, admin reply, internal note (with an attachment) - last public
     *   author admin.
     * @output list / detail / older / newer: 2 messages, no 'Internal'; unread 1; waiting on the
     *   customer; files: only the attachment of the reply.
     */
    public function test_internal_notes_are_never_shown(): void
    {
        $thread = $this->thread($this->portal, ['last_public_author' => 'admin'], [['customer', 'Question'], ['admin', 'Answer']]);
        $reply = $thread->messages()->where('author_type', 'admin')->sole();
        $note = $thread->messages()->create(['author_type' => 'admin', 'author_label' => 'Dev', 'body' => 'Internal: client pays late', 'is_internal' => true]);
        $this->attach($reply, 'web/project_threads/reply.pdf');
        $this->attach($note, 'web/project_threads/note.pdf');

        $list = $this->portal('GET', '/threads')->assertOk()->assertJsonCount(2, 'data.0.messages')->assertJsonPath('data.0.unread_count', 1)
            ->assertJsonPath('data.0.waiting_on', 'customer');
        $detail = $this->portal('GET', "/threads/{$thread->id}")->assertOk()->assertJsonCount(2, 'data.messages');
        $older = $this->portal('GET', "/threads/{$thread->id}/messages")->assertJsonCount(2, 'data');
        $newer = $this->portal('GET', "/threads/{$thread->id}/new-messages?after_id=0")->assertJsonCount(2, 'data');
        foreach ([$list, $detail, $older, $newer] as $response) {
            $this->assertStringNotContainsString('Internal', $response->getContent());
        }

        $files = $this->portal('GET', '/files')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.original_filename', 'reply.pdf')->assertJsonPath('data.0.thread_subject', 'Logo colours');
        $this->assertStringNotContainsString('note.pdf', $files->getContent());
    }

    /**
     * @description Files: every attachment of the own project's conversations, newest first, with
     *   the thread and author and short-lived signed links - never another project's files.
     * @input Two threads with one attachment each; a foreign project's attachment.
     * @output 2 files (newest first) with thread_subject, author_type and a signed download_url.
     */
    public function test_files_of_the_conversations(): void
    {
        $first = $this->thread($this->portal, ['subject' => 'First'], [['customer', 'Spec']]);
        $second = $this->thread($this->portal, ['subject' => 'Second'], [['admin', 'Design']]);
        $foreign = $this->thread($this->project(), [], [['customer', 'Other']]);
        $this->attach($first->messages()->sole(), 'web/project_threads/spec.pdf');
        $this->attach($second->messages()->sole(), 'web/project_threads/design.png');
        $this->attach($foreign->messages()->sole(), 'web/project_threads/other.pdf');

        $this->portal('GET', '/files')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.original_filename', 'design.png')->assertJsonPath('data.0.thread_subject', 'Second')
            ->assertJsonPath('data.0.author_type', 'admin')->assertJsonPath('data.1.original_filename', 'spec.pdf')
            ->assertJsonPath('data.0.download_url', fn ($url) => str_contains($url, 'signature='));
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
     * @description The client's actions are written to the portal log (module ProjectPortal):
     *   sign-in, new thread (request), closing / reopening it, sign-out - single messages are not
     *   logged (they are the conversation itself); never the message text or the password; a
     *   stored message shows its body only as [masked] in the data changes.
     * @input Login; POST thread (body 'Secret plan'); POST message (body 'Secret reply'); status
     *   closed; logout.
     * @output portal log events portal_login, portal_thread_create, portal_thread_status ('closed'),
     *   portal_logout; no 'Secret' / password anywhere in the log.
     */
    public function test_client_actions_are_logged(): void
    {
        $this->postJson('/api/projects/public/portal-token/login', ['username' => 'klient', 'password' => $this->projectPassword])->assertOk();
        $this->portal('POST', '/threads', ['subject' => 'Logo', 'priority' => 'high', 'body' => 'Secret plan'])->assertCreated();
        $thread = ProjectThread::sole();
        $this->portal('POST', "/threads/{$thread->id}/messages", ['body' => 'Secret reply'])->assertCreated();
        $this->portal('POST', "/threads/{$thread->id}/status", ['status' => 'closed'])->assertOk();
        $this->portal('POST', '/logout')->assertOk();

        $rows = ProjectPortalLog::orderBy('id')->get();
        $this->assertSame(['portal_login', 'portal_thread_create', 'portal_thread_status', 'portal_logout'], $rows->pluck('event_type')->all());
        $account = $this->portal->accounts()->sole();
        $this->assertStringContainsString("Client account #{$account->id} closed thread #{$thread->id}", $rows[2]->description);
        $this->assertStringContainsString("Client account #{$account->id} signed in", $rows[0]->description);
        $this->assertSame(['ProjectPortal'], $rows->pluck('module')->unique()->values()->all());
        $all = $rows->toJson();
        $this->assertStringNotContainsString('Secret', $all);
        $this->assertStringNotContainsString($this->projectPassword, $all);
        $this->assertStringContainsString('[masked]', $all);
    }

    /**
     * @description "My account": the client sets its own e-mail, e-mail language and each kind of
     *   notification (all off by default); turning one on needs an e-mail; removing the e-mail turns
     *   them all off; a colleague's account is never touched; the answer is the project with the
     *   updated account; the log names the changed fields, never the e-mail; login name / name /
     *   password cannot be changed here; an e-mail of the chosen kind then arrives.
     * @input me (defaults); POST {notify_replies: true} without e-mail; POST {email, language en,
     *   notify_replies, notify_checkpoint_dates}; POST {username, display_name, password} (ignored);
     *   bad e-mail / language; POST {email: ''}; then an admin reply with the notifications on.
     * @output all false + email null; 422 email; 200 with the values, colleague untouched, log
     *   "email, notify_replies, notify_checkpoint_dates, language" without the address; 200 unchanged;
     *   422 email + language; all off + email null; one reply e-mail to the account.
     */
    public function test_account_settings(): void
    {
        $colleague = $this->portalAccount($this->portal, 'eva', 'Eva', ['email' => 'eva@client.cz']);
        $this->portal('GET')->assertOk()->assertJsonPath('data.account.email', null)->assertJsonPath('data.account.language', 'cz')
            ->assertJsonPath('data.account.notify_replies', false)->assertJsonPath('data.account.notify_checkpoint_status', false)
            ->assertJsonPath('data.account.notify_checkpoint_dates', false);

        $this->portal('POST', '/account', ['notify_replies' => true])->assertStatus(422)->assertJsonValidationErrors(['email']);
        $this->portal('POST', '/account', ['email' => ' jana@client.cz ', 'language' => 'en', 'notify_replies' => true, 'notify_checkpoint_dates' => true])
            ->assertOk()->assertJsonPath('data.account.email', 'jana@client.cz')->assertJsonPath('data.account.language', 'en')
            ->assertJsonPath('data.account.notify_replies', true)->assertJsonPath('data.account.notify_checkpoint_status', false)
            ->assertJsonPath('data.account.notify_checkpoint_dates', true)->assertJsonPath('data.name', 'Eshop');
        $account = $this->portal->accounts()->where('username', 'klient')->sole();
        $this->assertTrue($account->notify_replies);
        $this->assertFalse($colleague->fresh()->notify_replies);
        $log = ProjectPortalLog::where('event_type', 'portal_account_settings')->sole();
        $this->assertStringContainsString("Client account #{$account->id} of project #{$this->portal->id} changed its settings:", $log->description);
        $this->assertStringContainsString('notify_replies', $log->description);
        $this->assertStringNotContainsString('jana@client.cz', $log->description . json_encode($log->context_data));

        $this->portal('POST', '/account', ['username' => 'hacker', 'display_name' => 'X', 'password' => 'Secret12345'])->assertOk()
            ->assertJsonPath('data.account.username', 'klient')->assertJsonPath('data.account.display_name', 'Klient');
        $this->assertTrue($account->fresh()->verifyPassword($this->projectPassword));
        $this->portal('POST', '/account', ['email' => 'nope', 'language' => 'de'])->assertStatus(422)->assertJsonValidationErrors(['email', 'language']);

        $thread = $this->thread($this->portal);
        $this->signIn($this->userWith(['project-portal-projects-update']));
        $this->postJson("/api/project-portal/project-threads/{$thread->id}/reply", ['body' => 'Hi'])->assertCreated();
        Mail::assertQueued(\App\Apps\ProjectPortal\Mail\ProjectClientUpdateMail::class, fn ($m) => $m->hasTo('jana@client.cz'));
        Mail::assertQueued(\App\Apps\ProjectPortal\Mail\ProjectClientUpdateMail::class, 1);

        $this->portal('POST', '/account', ['email' => ''])->assertOk()->assertJsonPath('data.account.email', null)
            ->assertJsonPath('data.account.notify_replies', false)->assertJsonPath('data.account.notify_checkpoint_dates', false);
    }
}
