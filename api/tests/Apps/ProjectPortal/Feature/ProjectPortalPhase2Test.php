<?php

/**
 * @file ProjectPortalPhase2Test.php
 * @path api/tests/Apps/ProjectPortal/Feature/ProjectPortalPhase2Test.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of phase 2 of the client portal (client side): sign-in by a one-time
 *   code / link sent to the e-mail (no account / e-mail probing, attempts, expiry, single use,
 *   limits), invitation links, "What is new" (activity with the unseen count), updates, approval
 *   requests and the client's decisions (record, e-mail to the team), new notification switches,
 *   files of all sources.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures; Mail / Storage fakes.
 */

namespace Tests\Apps\ProjectPortal\Feature;

use App\Apps\ProjectPortal\Mail\ProjectAccessMail;
use App\Apps\ProjectPortal\Mail\ProjectTeamNotificationMail;
use App\Models\Core\CoreSecurityEvent;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectApproval;
use App\Apps\ProjectPortal\Models\ProjectLoginCode;
use App\Apps\ProjectPortal\Models\ProjectSession;
use App\Apps\ProjectPortal\Services\ProjectActivityFeed;
use App\Apps\ProjectPortal\Support\PortalCookie;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description /api/projects/public/{token}/login/code…, /activity, /updates, /approvals.
 */
class ProjectPortalPhase2Test extends TestCase
{
    use ProjectFixtures;

    /** @var Project Public project of the tests. */
    private Project $portal;

    /**
     * @description Fake mail / disk, a public project with account "klient" (+ e-mail).
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        Mail::fake();
        $this->portal = $this->project(['name' => 'Eshop', 'access_token' => 'portal-token']);
        $this->portal->accounts()->sole()->update(['email' => 'klient@client.cz']);
    }

    /**
     * @description Portal request with the session of the account in its cookie.
     * @param string $method
     * @param string $path Path after /api/projects/public/portal-token.
     * @param array<string, mixed> $data
     * @param \App\Apps\ProjectPortal\Models\ProjectAccount|null $account Signed-in account (default klient).
     * @return \Illuminate\Testing\TestResponse
     */
    private function portal(string $method, string $path, array $data = [], $account = null): \Illuminate\Testing\TestResponse
    {
        $session = $this->portalSession($this->portal, $account);
        $this->unencryptedCookies = [];

        return $this->withCredentials()->withUnencryptedCookie(PortalCookie::NAME, $session)
            ->json($method, "/api/projects/public/portal-token{$path}", $data);
    }

    /**
     * @description The code / link of the last access e-mail to an address.
     * @param string $to Recipient.
     * @return ProjectAccessMail
     */
    private function lastAccessMail(string $to): ProjectAccessMail
    {
        $mails = Mail::sent(ProjectAccessMail::class, fn (ProjectAccessMail $m) => $m->hasTo($to));
        $this->assertNotEmpty($mails, "no access e-mail to {$to}");

        return $mails->last();
    }

    /**
     * @description "Send me a code": the same 202 answer for an existing / unknown login name,
     *   an e-mail and an account without e-mail (no probing); only accounts with an e-mail get a
     *   6-digit code + link (in their language, never logged); a new code replaces the older one;
     *   at most 5 codes an hour per account; unknown project 404.
     * @input requests by 'klient', 'nobody', 'KLIENT@client.cz', 'eva' (no e-mail); a minute later
     *   4 × 'klient' and 2 × 'nobody'.
     * @output 202 ×4 with the same message; e-mails to klient@client.cz only (code \d{6}, link 64);
     *   one unused code left; log row without the code; the 6th code of an account in an hour is
     *   not sent (still 202); the 6th request of an IP in a minute 429.
     */
    public function test_request_code(): void
    {
        $this->portalAccount($this->portal, 'eva', 'Eva');
        $message = $this->postJson('/api/projects/public/portal-token/login/code-request', ['identifier' => 'klient'])
            ->assertStatus(202)->json('message');
        foreach (['nobody', 'KLIENT@client.cz', 'eva'] as $identifier) {
            $this->postJson('/api/projects/public/portal-token/login/code-request', ['identifier' => $identifier])
                ->assertStatus(202)->assertJsonPath('message', $message);
        }
        Mail::assertSent(ProjectAccessMail::class, 2);
        $mail = $this->lastAccessMail('klient@client.cz');
        $this->assertSame(ProjectAccessMail::KIND_LOGIN, $mail->kind);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $mail->code);
        $this->assertSame(64, strlen($mail->link));
        $html = $mail->render();
        $this->assertStringContainsString($mail->code, $html);
        $this->assertStringContainsString("/projects/portal-token?access={$mail->link}", $html);
        $this->assertSame(1, ProjectLoginCode::whereNull('used_at')->where('expires_at', '>', now())->count(), 'a new code ends the older one');
        $log = ProjectPortalLog::where('event_type', 'portal_code_sent')->latest('id')->first();
        $this->assertStringNotContainsString($mail->code, $log->description . json_encode($log->context_data));

        // klient has 2 codes this hour; 3 more reach the hourly limit of the account (5), the
        // next one sends nothing although the answer stays the same.
        $this->travel(61)->seconds();
        foreach (range(1, 4) as $i) {
            $this->postJson('/api/projects/public/portal-token/login/code-request', ['identifier' => 'klient'])->assertStatus(202);
        }
        Mail::assertSent(ProjectAccessMail::class, 5);
        // Per IP at most 5 requests a minute.
        $this->postJson('/api/projects/public/portal-token/login/code-request', ['identifier' => 'nobody'])->assertStatus(202);
        $this->postJson('/api/projects/public/portal-token/login/code-request', ['identifier' => 'nobody'])->assertStatus(429);
    }

    /**
     * @description Hourly limit per account (independent of the per-IP throttle).
     * @input 5 codes created in the last hour; one more request.
     * @output 202, no e-mail.
     */
    public function test_code_hourly_limit_per_account(): void
    {
        $account = $this->portal->accounts()->sole();
        foreach (range(1, ProjectLoginCode::MAX_REQUESTS_PER_HOUR) as $i) {
            ProjectLoginCode::create(['account_id' => $account->id, 'purpose' => 'login', 'code_hash' => 'x', 'link_hash' => str_repeat((string) $i, 64), 'expires_at' => now()->addMinutes(5)])
                ->forceFill(['used_at' => now()])->save();
        }
        $this->postJson('/api/projects/public/portal-token/login/code-request', ['identifier' => 'klient'])->assertStatus(202);
        Mail::assertNothingSent();
    }

    /**
     * @description Sign-in with the code: wrong code counts (5 tries, then spent), the right code
     *   by login name or e-mail starts the session (cookie, e-mail proven, last sign-in), it works
     *   once; an expired code fails; validation; security events.
     * @input code request; wrong code; right code by e-mail; same code again; expired code; 5 wrong
     *   tries then the right one; missing fields.
     * @output 401 + attempt; 200 + cookie of a valid session + email_verified_at; 401; 401; 401; 422.
     */
    public function test_login_with_code(): void
    {
        $account = $this->portal->accounts()->sole();
        $this->postJson('/api/projects/public/portal-token/login/code-request', ['identifier' => 'klient'])->assertStatus(202);
        $code = $this->lastAccessMail('klient@client.cz')->code;
        $wrong = $code === '000000' ? '111111' : '000000';

        $this->postJson('/api/projects/public/portal-token/login/code', ['identifier' => 'klient', 'code' => $wrong])->assertStatus(401);
        $this->assertSame(1, ProjectLoginCode::sole()->attempts);
        $response = $this->postJson('/api/projects/public/portal-token/login/code', ['identifier' => 'Klient@Client.cz', 'code' => substr($code, 0, 3) . ' ' . substr($code, 3)])
            ->assertOk()->assertJsonPath('data.project.account.username', 'klient')->assertJsonPath('data.project.account.email_verified', true);
        $session = (string) $this->credentialCookie($response, PortalCookie::NAME, '/api/projects/public/portal-token')->getValue();
        $this->assertSame($account->id, ProjectSession::findValidByPlaintextToken($session)->account_id);
        $this->assertNotNull($account->fresh()->email_verified_at);
        $this->assertNotNull($account->fresh()->last_login_at);
        $this->assertTrue(ProjectPortalLog::where('event_type', 'portal_login')->where('description', 'like', '%(code)%')->exists());
        $this->postJson('/api/projects/public/portal-token/login/code', ['identifier' => 'klient', 'code' => $code])->assertStatus(401);

        $issued = ProjectLoginCode::issue($account, ProjectLoginCode::PURPOSE_LOGIN);
        $this->travel(16)->minutes();
        $this->postJson('/api/projects/public/portal-token/login/code', ['identifier' => 'klient', 'code' => $issued['code']])->assertStatus(401);
        $this->travelBack();

        $issued = ProjectLoginCode::issue($account, ProjectLoginCode::PURPOSE_LOGIN);
        foreach (range(1, ProjectLoginCode::MAX_ATTEMPTS) as $i) {
            ProjectLoginCode::whereNull('used_at')->latest('id')->first()->increment('attempts');
        }
        $this->postJson('/api/projects/public/portal-token/login/code', ['identifier' => 'klient', 'code' => $issued['code']])->assertStatus(401);
        $this->postJson('/api/projects/public/portal-token/login/code', [])->assertStatus(422)->assertJsonValidationErrors(['identifier', 'code']);
        $this->assertGreaterThanOrEqual(3, (int) CoreSecurityEvent::where('event_type', 'project_login_failed')->sum('occurrences'));
    }

    /**
     * @description Sign-in with a one-time link (requested sign-in or invitation): works once,
     *   only for the project of the link, not after expiry; an invitation link signs in an account
     *   without a password; private project 404.
     * @input login link; same link again; link of another project's account; invitation of an
     *   account without password; expired invitation; private project.
     * @output 200 + session; 401; 401; 200 (invite in the log); 401; 404.
     */
    public function test_login_with_link_and_invitation(): void
    {
        $account = $this->portal->accounts()->sole();
        $link = ProjectLoginCode::issue($account, ProjectLoginCode::PURPOSE_LOGIN)['link'];
        $this->postJson('/api/projects/public/portal-token/login/link', ['link' => $link])->assertOk()->assertJsonPath('data.project.name', 'Eshop');
        $this->postJson('/api/projects/public/portal-token/login/link', ['link' => $link])->assertStatus(401);

        $other = $this->project(['access_token' => 'other-token']);
        $foreign = ProjectLoginCode::issue($other->accounts()->sole(), ProjectLoginCode::PURPOSE_LOGIN)['link'];
        $this->postJson('/api/projects/public/portal-token/login/link', ['link' => $foreign])->assertStatus(401);

        $invited = $this->portalAccount($this->portal, 'nova', 'Nová', ['email' => 'nova@client.cz']);
        $invited->forceFill(['password_hash' => null])->save();
        $invite = ProjectLoginCode::issue($invited, ProjectLoginCode::PURPOSE_INVITE)['link'];
        $this->postJson('/api/projects/public/portal-token/login/link', ['link' => $invite])->assertOk()
            ->assertJsonPath('data.project.account.username', 'nova')->assertJsonPath('data.project.account.has_password', false);
        $this->assertTrue(ProjectPortalLog::where('event_type', 'portal_login')->where('description', 'like', '%(invite)%')->exists());
        $this->postJson('/api/projects/public/portal-token/login', ['username' => 'nova', 'password' => ''])->assertStatus(422);
        $this->postJson('/api/projects/public/portal-token/login', ['username' => 'nova', 'password' => 'anything123'])->assertStatus(401);

        $late = ProjectLoginCode::issue($invited, ProjectLoginCode::PURPOSE_INVITE)['link'];
        $this->travel(ProjectLoginCode::INVITE_TTL_MINUTES + 1)->minutes();
        $this->postJson('/api/projects/public/portal-token/login/link', ['link' => $late])->assertStatus(401);
        $this->travelBack();

        $this->portal->update(['visibility' => 'private']);
        $this->postJson('/api/projects/public/portal-token/login/link', ['link' => 'x'])->assertStatus(404);
        $this->postJson('/api/projects/public/portal-token/login/code-request', ['identifier' => 'klient'])->assertStatus(404);
    }

    /**
     * @description "What is new": the supplier's activity (published updates, checkpoint changes,
     *   approval requests, supplier replies - no drafts, internal notes, cancelled requests or the
     *   client's own messages); items newer than the last look are new; marking seen clears them.
     * @input update published + draft; checkpoint done; approval pending + cancelled; thread with a
     *   client message, an internal note and a supplier reply; GET; POST seen; GET.
     * @output types {update, checkpoint, approval_requested, reply} - 4 items, all new, unseen 4;
     *   seen_at set; then unseen 0, none new.
     */
    public function test_activity_feed(): void
    {
        $this->portal->updates()->create(['title' => 'Release 1', 'body' => 'Done', 'published_at' => now()->subHour(), 'author_label' => 'Jana']);
        $this->portal->updates()->create(['title' => 'Draft', 'body' => 'x']);
        $checkpoint = $this->portal->checkpoints()->create(['label' => 'Design']);
        $checkpoint->setStatus('done');
        $checkpoint->save();
        $this->portal->approvals()->create(['title' => 'Logo', 'status' => 'pending', 'requested_at' => now()->subMinutes(30)]);
        $this->portal->approvals()->create(['title' => 'Gone', 'status' => 'cancelled', 'requested_at' => now()->subMinutes(20)]);
        $thread = $this->thread($this->portal, ['subject' => 'Hosting'], [['customer', 'Question']]);
        $thread->messages()->create(['author_type' => 'admin', 'author_label' => 'Jana', 'body' => 'Note', 'is_internal' => true]);
        $thread->messages()->create(['author_type' => 'admin', 'author_label' => 'Jana', 'body' => 'Answer']);
        $this->portal->accounts()->sole()->forceFill(['created_at' => now()->subDay()])->save();

        $data = $this->portal('GET', '/activity')->assertOk()->assertJsonPath('meta.unseen', 4)->json('data');
        $this->assertEqualsCanonicalizing(['update', 'checkpoint', 'approval_requested', 'reply'], array_column($data, 'type'));
        $this->assertSame([true, true, true, true], array_column($data, 'is_new'));
        $this->assertSame('Hosting', collect($data)->firstWhere('type', 'reply')['title']);
        $this->assertSame(['section' => 'approvals', 'id' => $this->portal->approvals()->where('title', 'Logo')->value('id')], collect($data)->firstWhere('type', 'approval_requested')['target']);

        $this->portal('POST', '/activity/seen')->assertOk()->assertJsonPath('data.seen_at', fn ($v) => $v !== null);
        $this->travel(1)->seconds();
        $this->portal('GET', '/activity')->assertOk()->assertJsonPath('meta.unseen', 0);
    }

    /**
     * @description Updates: only published ones, newest first, with files; a draft never.
     * @input published A (yesterday, with a.pdf), published B (today), draft C.
     * @output [B, A], A has 1 attachment with a download link.
     */
    public function test_updates(): void
    {
        $a = $this->portal->updates()->create(['title' => 'A', 'body' => 'x', 'published_at' => now()->subDay()]);
        $this->attach($a, 'web/project_updates/a.pdf');
        $this->portal->updates()->create(['title' => 'B', 'body' => 'y', 'published_at' => now()]);
        $this->portal->updates()->create(['title' => 'C', 'body' => 'z']);

        $this->portal('GET', '/updates')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.title', 'B')->assertJsonPath('data.1.attachments.0.original_filename', 'a.pdf')
            ->assertJsonPath('data.1.attachments.0.download_url', fn ($v) => str_contains((string) $v, 'signature='));
    }

    /**
     * @description Approvals: pending first, cancelled hidden; approve; request changes needs a
     *   comment; a decided one cannot be decided again; another project's 404; decisions keep the
     *   account + time; the team (project assignee) is e-mailed; the comment is not in the log.
     * @input pending P (with checkpoint + file), approved Q, cancelled R; changes without comment;
     *   changes with comment by eva; approve P again; approve Q; foreign approval.
     * @output list [P, Q]; 422 comment; 200 status changes_requested + decision of Eva; 422; 422;
     *   404; e-mail "Changes requested" to the assignee; no comment text in the log; in "What is
     *   new" the decision is not new for Eva (and carries no account key) but new for a colleague.
     */
    public function test_approvals_and_decisions(): void
    {
        $assignee = $this->userWith(['project-portal-projects-update'], ['user_email' => 'pm@firm.cz']);
        $this->portal->update(['assignee_id' => $assignee->id]);
        $checkpoint = $this->portal->checkpoints()->create(['label' => 'Design']);
        $p = $this->portal->approvals()->create(['title' => 'Homepage design', 'status' => 'pending', 'checkpoint_id' => $checkpoint->id, 'requested_at' => now()->subHour()]);
        $this->attach($p, 'web/project_approvals/design.pdf');
        $q = $this->portal->approvals()->create(['title' => 'Texts', 'status' => 'approved', 'requested_at' => now()->subDays(2)]);
        $this->portal->approvals()->create(['title' => 'Old', 'status' => 'cancelled', 'requested_at' => now()]);
        $eva = $this->portalAccount($this->portal, 'eva', 'Eva Nová');

        $this->portal('GET', '/approvals')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $p->id)->assertJsonPath('data.0.checkpoint_label', 'Design')
            ->assertJsonPath('data.0.attachments.0.original_filename', 'design.pdf')->assertJsonPath('data.1.id', $q->id);

        $this->portal('POST', "/approvals/{$p->id}/decision", ['decision' => 'changes_requested'])->assertStatus(422)->assertJsonValidationErrors(['comment']);
        $this->portal('POST', "/approvals/{$p->id}/decision", ['decision' => 'maybe'])->assertStatus(422)->assertJsonValidationErrors(['decision']);
        $this->portal('POST', "/approvals/{$p->id}/decision", ['decision' => 'changes_requested', 'comment' => 'Secret: bigger logo'], $eva)->assertOk()
            ->assertJsonPath('data.status', 'changes_requested')->assertJsonPath('data.decisions.0.author_label', 'Eva Nová')
            ->assertJsonPath('data.decisions.0.account_id', $eva->id)->assertJsonPath('data.decisions.0.comment', 'Secret: bigger logo');
        $this->assertNotNull($p->fresh()->decided_at);
        $this->portal('POST', "/approvals/{$p->id}/decision", ['decision' => 'approved'])->assertStatus(422);
        $this->portal('POST', "/approvals/{$q->id}/decision", ['decision' => 'approved'])->assertStatus(422);
        $foreign = $this->project()->approvals()->create(['title' => 'X', 'status' => 'pending']);
        $this->portal('POST', "/approvals/{$foreign->id}/decision", ['decision' => 'approved'])->assertStatus(404);

        Mail::assertQueued(ProjectTeamNotificationMail::class, fn (ProjectTeamNotificationMail $m) => $m->hasTo('pm@firm.cz')
            && $m->kind === ProjectTeamNotificationMail::KIND_APPROVAL_DECIDED && $m->detail === 'changes_requested'
            && str_contains($m->render(), "/admin/project-portal/projects/{$this->portal->id}/approvals") && !str_contains($m->render(), 'Secret'));
        $log = ProjectPortalLog::where('event_type', 'portal_approval_decision')->sole();
        $this->assertStringNotContainsString('Secret', $log->description . json_encode($log->context_data));
        $this->assertSame(ProjectApproval::STATUS_CHANGES, $p->fresh()->status);

        // "What is new": Eva's own decision is listed but no news for her; it is for a colleague.
        $this->portal->accounts()->update(['created_at' => now()->subDay()]);
        $own = collect($this->portal('GET', '/activity', [], $eva->fresh())->assertOk()->json('data'))->firstWhere('type', 'approval_decided');
        $this->assertFalse($own['is_new']);
        $this->assertArrayNotHasKey(ProjectActivityFeed::DECIDED_BY_KEY, $own);
        $colleague = collect($this->portal('GET', '/activity')->assertOk()->json('data'))->firstWhere('type', 'approval_decided');
        $this->assertTrue($colleague['is_new']);
    }

    /**
     * @description New notification switches (updates, approvals) in "My account"; files of the
     *   portal come from threads, published updates and visible approvals (not drafts, cancelled
     *   requests or internal notes).
     * @input POST account {notify_updates, notify_approvals}; files: client message m.pdf, internal
     *   n.pdf, published update u.pdf, draft d.pdf, pending approval a.pdf, cancelled c.pdf.
     * @output flags true; files [a.pdf (approval), u.pdf (update), m.pdf (thread)] with sources.
     */
    public function test_new_switches_and_files_of_all_sources(): void
    {
        $this->portal('POST', '/account', ['notify_updates' => true, 'notify_approvals' => true])->assertOk()
            ->assertJsonPath('data.account.notify_updates', true)->assertJsonPath('data.account.notify_approvals', true);

        $thread = $this->thread($this->portal, ['subject' => 'Logo'], [['customer', 'Hi']]);
        $this->attach($thread->messages()->first(), 'web/project_threads/m.pdf');
        $note = $thread->messages()->create(['author_type' => 'admin', 'body' => 'n', 'is_internal' => true]);
        $this->attach($note, 'web/project_threads/n.pdf');
        $this->attach($this->portal->updates()->create(['title' => 'Release', 'body' => 'x', 'published_at' => now()]), 'web/project_updates/u.pdf');
        $this->attach($this->portal->updates()->create(['title' => 'Draft', 'body' => 'x']), 'web/project_updates/d.pdf');
        $this->attach($this->portal->approvals()->create(['title' => 'Design', 'status' => 'pending']), 'web/project_approvals/a.pdf');
        $this->attach($this->portal->approvals()->create(['title' => 'Old', 'status' => 'cancelled']), 'web/project_approvals/c.pdf');

        $files = $this->portal('GET', '/files')->assertOk()->json('data');
        $this->assertSame(['a.pdf', 'u.pdf', 'm.pdf'], array_column($files, 'original_filename'));
        $this->assertSame(['approval', 'update', 'thread'], array_column($files, 'source'));
        $this->assertSame(['Design', 'Release', 'Logo'], array_column($files, 'source_title'));
    }
}
