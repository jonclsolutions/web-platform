<?php

/**
 * @file ProjectPhase2AdminTest.php
 * @path api/tests/Apps/ProjectPortal/Feature/ProjectPhase2AdminTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of phase 2 of the client portal (administration side): invitations
 *   of client accounts (accounts without a password, resend), updates (drafts, publishing with a
 *   single e-mail round, files, back to a draft), approval requests (lifecycle, rules, e-mails),
 *   thread assignment (assignable users, e-mail, "my threads", the team e-mail goes to the
 *   assignee), project templates (CRUD, save from a project, apply, create a project from one),
 *   the team activity feed, files of all sources, counts of the project page and permissions.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures; Mail / Storage fakes.
 */

namespace Tests\Apps\ProjectPortal\Feature;

use App\Apps\ProjectPortal\Mail\ProjectAccessMail;
use App\Apps\ProjectPortal\Mail\ProjectClientUpdateMail;
use App\Apps\ProjectPortal\Mail\ProjectTeamNotificationMail;
use App\Apps\ProjectPortal\Mail\ProjectThreadActivityMail;
use App\Models\Core\CoreAttachment;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectApproval;
use App\Apps\ProjectPortal\Models\ProjectLoginCode;
use App\Apps\ProjectPortal\Models\ProjectTemplate;
use App\Apps\ProjectPortal\Models\ProjectUpdate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description /api/project-portal/projects/{id}/updates|approvals|accounts/{id}/invite|activity|template…,
 *   /api/project-portal/projects/templates, /api/project-portal/project-threads/{id}/assignee.
 */
class ProjectPhase2AdminTest extends TestCase
{
    use ProjectFixtures;

    /** @var Project Project of the tests with a subscribed client account. */
    private Project $project;

    /**
     * @description Fake mail / disk; project with account "anna" subscribed to every e-mail.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        Mail::fake();
        $this->project = $this->project(['name' => 'Eshop']);
        $this->portalAccount($this->project, 'anna', 'Anna', [
            'email' => 'anna@client.cz', 'notify_replies' => true, 'notify_checkpoint_status' => true,
            'notify_checkpoint_dates' => true, 'notify_updates' => true, 'notify_approvals' => true,
        ]);
    }

    /**
     * @description Account with an invitation instead of a password: needs an e-mail; no password
     *   and no invitation is refused; the invitation e-mail (7-day one-time link, login name) goes
     *   out, invited_at is set; resend makes the older link expire; no e-mail 422; the old
     *   behaviour (no fields = generated password) stays.
     * @input POST {send_invitation, with_password false} without e-mail; with e-mail; POST
     *   {with_password false}; POST invite twice; invite an account without e-mail; POST plain.
     * @output 422 email; 201 has_password false, meta.invited true, e-mail KIND_INVITE; 422
     *   with_password; 2 links, the first expired; 422; 201 with a generated password.
     */
    public function test_invitations(): void
    {
        $this->signIn($this->userWith(['web-projects-update']));
        $url = "/api/project-portal/projects/{$this->project->id}/accounts";

        $this->postJson($url, ['username' => 'nova', 'display_name' => 'Nová', 'send_invitation' => true, 'with_password' => false])
            ->assertStatus(422)->assertJsonValidationErrors(['email']);
        $created = $this->postJson($url, ['username' => 'nova', 'display_name' => 'Nová', 'email' => 'nova@client.cz', 'send_invitation' => true, 'with_password' => false])
            ->assertCreated()->assertJsonPath('data.has_password', false)->assertJsonPath('meta.invited', true)
            ->assertJsonPath('meta.password', null)->assertJsonPath('data.invited_at', fn ($v) => $v !== null)->json('data');
        Mail::assertSent(ProjectAccessMail::class, fn (ProjectAccessMail $m) => $m->hasTo('nova@client.cz')
            && $m->kind === ProjectAccessMail::KIND_INVITE && $m->code === null && str_contains($m->render(), 'nova'));
        $this->postJson($url, ['username' => 'none', 'display_name' => 'None', 'with_password' => false])
            ->assertStatus(422)->assertJsonValidationErrors(['with_password']);

        $this->postJson("{$url}/{$created['id']}/invite")->assertOk();
        $this->assertSame(1, ProjectLoginCode::where('account_id', $created['id'])->where('expires_at', '>', now())->count());
        $this->assertSame(2, ProjectLoginCode::where('account_id', $created['id'])->count());
        $this->assertPortalLog('account_invite', "Invitation sent to portal account #{$created['id']}");
        $klient = $this->project->accounts()->where('username', 'klient')->sole();
        $this->postJson("{$url}/{$klient->id}/invite")->assertStatus(422)->assertJsonValidationErrors(['email']);
        $this->postJson("/api/project-portal/projects/{$this->project()->id}/accounts/{$created['id']}/invite")->assertStatus(404);

        $this->postJson($url, ['username' => 'plain', 'display_name' => 'Plain'])->assertCreated()
            ->assertJsonPath('data.has_password', true)->assertJsonPath('meta.invited', false)->assertJsonPath('meta.password', fn ($v) => strlen($v) === 14);
    }

    /**
     * @description Updates: draft (no e-mail, invisible to the client), files, publishing e-mails
     *   once, back to a draft and publishing again does not e-mail again, files removed, delete
     *   with files, validation, permissions, IDOR.
     * @input POST draft with a.pdf; GET; POST publish; POST publish=false; POST publish; POST
     *   remove file + new title; POST without title; viewer; another project's URL; DELETE.
     * @output 201 is_published false, 0 e-mails; list with the draft; first publication 1 e-mail
     *   to anna (KIND_UPDATE, link to updates); draft; no new e-mail; file gone from disk; 422; 403;
     *   404; 204 and files gone.
     */
    public function test_updates(): void
    {
        $this->signIn($this->userWith(['web-projects-view']));
        $this->postJson("/api/project-portal/projects/{$this->project->id}/updates", ['title' => 'x', 'body' => 'y'])->assertStatus(403);
        $this->signIn($this->userWith(['web-projects-view', 'web-projects-update'], ['full_name' => 'Jana']));
        $base = "/api/project-portal/projects/{$this->project->id}/updates";

        $update = $this->post($base, ['title' => 'Week 1', 'body' => 'We did the design.', 'attachments' => [$this->upload('a.pdf')]], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.is_published', false)->assertJsonPath('data.author_label', 'Jana')
            ->assertJsonPath('meta.notified', 0)->assertJsonPath('data.attachments.0.original_filename', 'a.pdf')->json('data');
        Mail::assertNothingQueued();
        $this->getJson($base)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.is_published', false);

        $this->postJson("{$base}/{$update['id']}", ['publish' => true])->assertOk()->assertJsonPath('data.is_published', true)->assertJsonPath('meta.notified', 1);
        Mail::assertQueued(ProjectClientUpdateMail::class, fn (ProjectClientUpdateMail $m) => $m->hasTo('anna@client.cz')
            && $m->kind === ProjectClientUpdateMail::KIND_UPDATE && $m->itemTitle === 'Week 1' && str_contains($m->render(), '?section=updates')
            && !str_contains($m->render(), 'We did the design.'));
        $this->postJson("{$base}/{$update['id']}", ['publish' => false])->assertOk()->assertJsonPath('data.is_published', false);
        $this->postJson("{$base}/{$update['id']}", ['publish' => true])->assertOk()->assertJsonPath('meta.notified', 0);
        Mail::assertQueued(ProjectClientUpdateMail::class, 1);
        $this->assertPortalLog('update_update', 'back to a draft');

        $file = CoreAttachment::sole();
        $this->postJson("{$base}/{$update['id']}", ['title' => 'Week 1 (final)', 'remove_attachment_ids' => [$file->id]])->assertOk()
            ->assertJsonPath('data.title', 'Week 1 (final)')->assertJsonCount(0, 'data.attachments');
        Storage::disk('private')->assertMissing($file->path);
        $this->postJson($base, ['body' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['title']);
        $this->postJson("/api/project-portal/projects/{$this->project()->id}/updates/{$update['id']}", ['title' => 'Hijack'])->assertStatus(404);

        $second = $this->post($base, ['title' => 'Now', 'body' => 'Live', 'publish' => '1', 'attachments' => [$this->upload('b.pdf')]], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.is_published', true)->assertJsonPath('meta.notified', 1)->json('data');
        $path = CoreAttachment::sole()->path;
        $this->deleteJson("{$base}/{$second['id']}")->assertNoContent();
        Storage::disk('private')->assertMissing($path);
        $this->assertNull(ProjectUpdate::find($second['id']));
    }

    /**
     * @description Approval lifecycle: request (e-mail, files, checkpoint of the same project only),
     *   change while pending, not after a decision; ask again after changes (e-mail again); cancel
     *   (hidden from the client); delete only without a decision; history of decisions in the list.
     * @input POST with foreign checkpoint; POST valid; POST change; decision of the client
     *   (changes); POST change (422); reopen; cancel; reopen a cancelled one; approve; cancel an
     *   approved one (422); DELETE with decisions (422); DELETE a fresh one.
     * @output 422 checkpoint_id; 201 pending + 1 e-mail; 200; 422; pending + 2nd e-mail; cancelled;
     *   pending; 422; 422; 204.
     */
    public function test_approvals(): void
    {
        $this->signIn($this->userWith(['web-projects-view', 'web-projects-update'], ['full_name' => 'Jana']));
        $base = "/api/project-portal/projects/{$this->project->id}/approvals";
        $own = $this->project->checkpoints()->create(['label' => 'Design']);
        $foreign = $this->project()->checkpoints()->create(['label' => 'X']);

        $this->postJson($base, ['title' => 'Logo', 'checkpoint_id' => $foreign->id])->assertStatus(422)->assertJsonValidationErrors(['checkpoint_id']);
        $approval = $this->post($base, ['title' => 'Logo', 'description' => 'Two variants', 'checkpoint_id' => $own->id, 'due_date' => '2026-12-01',
            'attachments' => [$this->upload('logo.pdf')]], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.checkpoint_label', 'Design')
            ->assertJsonPath('data.requested_by_label', 'Jana')->assertJsonPath('meta.notified', 1)->json('data');
        Mail::assertQueued(ProjectClientUpdateMail::class, fn (ProjectClientUpdateMail $m) => $m->kind === ProjectClientUpdateMail::KIND_APPROVAL
            && str_contains($m->render(), '?section=approvals'));
        $this->postJson("{$base}/{$approval['id']}", ['title' => 'Logo v2', 'due_date' => null])->assertOk()->assertJsonPath('data.title', 'Logo v2')->assertJsonPath('data.due_date', null);

        $model = ProjectApproval::find($approval['id']);
        $model->decisions()->create(['decision' => 'changes_requested', 'comment' => 'Bigger', 'author_label' => 'Anna']);
        $model->update(['status' => 'changes_requested', 'decided_at' => now()]);
        $this->postJson("{$base}/{$approval['id']}", ['title' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['status']);
        $this->getJson($base)->assertOk()->assertJsonPath('data.0.decisions.0.comment', 'Bigger');

        $this->postJson("{$base}/{$approval['id']}/reopen")->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.decided_at', null);
        Mail::assertQueued(ProjectClientUpdateMail::class, 2);
        $this->postJson("{$base}/{$approval['id']}/reopen")->assertStatus(422);
        $this->postJson("{$base}/{$approval['id']}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->postJson("{$base}/{$approval['id']}/reopen")->assertOk()->assertJsonPath('data.status', 'pending');
        $model->update(['status' => 'approved']);
        $this->postJson("{$base}/{$approval['id']}/cancel")->assertStatus(422);
        $this->deleteJson("{$base}/{$approval['id']}")->assertStatus(422);
        $this->postJson("/api/project-portal/projects/{$this->project()->id}/approvals/{$approval['id']}/cancel")->assertStatus(404);

        $fresh = $this->postJson($base, ['title' => 'Typo'])->assertCreated()->json('data');
        $this->deleteJson("{$base}/{$fresh['id']}")->assertNoContent();
        $this->assertPortalLog('approval_delete', "Approval #{$fresh['id']}");
        $this->assertPortalLog('approval_reopen');
    }

    /**
     * @description Thread assignment: only assignable administrators; the assignee is e-mailed
     *   (not when assigning oneself); "my threads" filter; client activity in the thread is
     *   e-mailed to the thread's assignee instead of the project's; unassign.
     * @input viewer as assignee (422); Jana → assign Petr; Jana → assign herself; filter as Jana;
     *   client message in the thread; unassign.
     * @output 422; assignee_name Petr + team e-mail to Petr with a link to the conversations; no
     *   e-mail for herself; [thread]; ProjectThreadActivityMail to Jana; assignee null.
     */
    public function test_thread_assignment(): void
    {
        $jana = $this->userWith(['web-projects-view', 'web-projects-update'], ['full_name' => 'Jana', 'user_email' => 'jana@firm.cz']);
        $petr = $this->userWith(['web-projects-update'], ['full_name' => 'Petr', 'user_email' => 'petr@firm.cz']);
        $viewer = $this->userWith(['web-projects-view']);
        $this->project->update(['assignee_id' => $petr->id]);
        $thread = $this->thread($this->project, ['subject' => 'Hosting'], [['customer', 'Hi']]);
        $other = $this->thread($this->project, ['subject' => 'Other']);
        $this->signIn($jana);

        $this->putJson("/api/project-portal/project-threads/{$thread->id}/assignee", ['assignee_id' => $viewer->id])->assertStatus(422);
        $this->putJson("/api/project-portal/project-threads/{$thread->id}/assignee", ['assignee_id' => $petr->id])->assertOk()
            ->assertJsonPath('data.assignee_id', $petr->id)->assertJsonPath('data.assignee_name', 'Petr');
        Mail::assertQueued(ProjectTeamNotificationMail::class, fn (ProjectTeamNotificationMail $m) => $m->hasTo('petr@firm.cz')
            && $m->kind === ProjectTeamNotificationMail::KIND_THREAD_ASSIGNED && str_contains($m->render(), 'Jana assigned you this thread')
            && str_contains($m->render(), "/admin/web/projects/{$this->project->id}/conversations"));
        $this->putJson("/api/project-portal/project-threads/{$thread->id}/assignee", ['assignee_id' => $jana->id])->assertOk();
        Mail::assertQueued(ProjectTeamNotificationMail::class, 1);
        $this->assertPortalLog('thread_assign', "Thread #{$thread->id} of project #{$this->project->id} assigned to user #{$jana->id}");
        $this->assertSame([$thread->id], array_column($this->getJson("/api/project-portal/project-threads?project_id={$this->project->id}&no_pagination=1&assigned_to_me=1")->json('data'), 'id'));
        $this->getJson("/api/project-portal/project-threads/{$other->id}")->assertJsonPath('data.assignee_id', null);

        $session = $this->portalSession($this->project);
        $this->unencryptedCookies = [];
        $this->withCredentials()->withUnencryptedCookie(\App\Apps\ProjectPortal\Support\PortalCookie::NAME, $session)
            ->postJson("/api/projects/public/{$this->project->access_token}/threads/{$thread->id}/messages", ['body' => 'More'])->assertCreated();
        Mail::assertQueued(ProjectThreadActivityMail::class, fn (ProjectThreadActivityMail $m) => $m->hasTo('jana@firm.cz'));

        $this->putJson("/api/project-portal/project-threads/{$thread->id}/assignee", ['assignee_id' => null])->assertOk()->assertJsonPath('data.assignee_id', null);
        $this->putJson("/api/project-portal/project-threads/{$thread->id}/assignee", [])->assertStatus(422);
    }

    /**
     * @description Templates: CRUD (checkpoints replaced as a whole, in order), validation, save
     *   from a project (offsets from the earliest due date), apply to a project (due dates from
     *   the start), create a project from a template, permissions.
     * @input POST template; PUT with 2 new checkpoints; POST invalid; project with checkpoints
     *   (due 1.12. / 11.12. / none) → POST template; apply to another project with start 2027-01-01;
     *   POST project with template_id; viewer POST; DELETE.
     * @output 201; checkpoints replaced; 422; offsets [0, 10, null]; 3 checkpoints with
     *   2027-01-01 / 2027-01-11 / null; the new project has the template's checkpoints; 403; 204.
     */
    public function test_templates(): void
    {
        $this->signIn($this->userWith(['web-projects-view']));
        $this->postJson('/api/project-portal/projects/templates', ['name' => 'X', 'checkpoints' => [['label' => 'A']]])->assertStatus(403);
        $this->signIn($this->userWith(['web-projects-view', 'web-projects-create', 'web-projects-update']));

        $template = $this->postJson('/api/project-portal/projects/templates', ['name' => 'E-shop', 'description' => 'Standard',
            'checkpoints' => [['label' => 'Analysis', 'offset_days' => 0], ['label' => 'Design', 'description' => 'UI', 'offset_days' => 14]]])
            ->assertCreated()->assertJsonPath('data.checkpoints.1.label', 'Design')->assertJsonPath('data.checkpoints.1.offset_days', 14)->json('data');
        $this->putJson("/api/project-portal/projects/templates/{$template['id']}", ['checkpoints' => [['label' => 'Kick-off'], ['label' => 'Launch', 'offset_days' => 30]]])
            ->assertOk()->assertJsonPath('data.name', 'E-shop')->assertJsonCount(2, 'data.checkpoints')->assertJsonPath('data.checkpoints.0.label', 'Kick-off');
        $this->postJson('/api/project-portal/projects/templates', ['name' => '', 'checkpoints' => []])->assertStatus(422)->assertJsonValidationErrors(['name', 'checkpoints']);
        $this->getJson('/api/project-portal/projects/templates')->assertOk()->assertJsonPath('data.0.name', 'E-shop');

        $this->project->checkpoints()->createMany([
            ['label' => 'A', 'due_date' => '2026-12-01', 'sort_order' => 0],
            ['label' => 'B', 'due_date' => '2026-12-11', 'sort_order' => 1],
            ['label' => 'C', 'sort_order' => 2],
        ]);
        $saved = $this->postJson("/api/project-portal/projects/{$this->project->id}/template", ['name' => 'From Eshop'])->assertCreated()->json('data');
        $this->assertSame([0, 10, null], array_column($saved['checkpoints'], 'offset_days'));
        $this->postJson("/api/project-portal/projects/{$this->project()->id}/template", ['name' => 'Empty'])->assertStatus(422);

        $target = $this->project();
        $target->checkpoints()->create(['label' => 'Existing', 'sort_order' => 0]);
        $this->postJson("/api/project-portal/projects/{$target->id}/apply-template", ['template_id' => $saved['id'], 'start_date' => '2027-01-01'])
            ->assertOk()->assertJsonPath('meta.added', 3)->assertJsonPath('data.1.label', 'A')
            ->assertJsonPath('data.1.due_date', '2027-01-01')->assertJsonPath('data.2.due_date', '2027-01-11')->assertJsonPath('data.3.due_date', null);
        $this->postJson("/api/project-portal/projects/{$target->id}/apply-template", ['template_id' => 999])->assertStatus(422);

        $created = $this->postJson('/api/project-portal/projects', ['name' => 'New shop', 'visibility' => 'private', 'template_id' => $template['id']])->assertCreated()->json('data');
        $this->assertSame(['Kick-off', 'Launch'], Project::find($created['id'])->checkpoints()->pluck('label')->all());
        $this->assertSame(now()->addDays(30)->toDateString(), Project::find($created['id'])->checkpoints()->where('label', 'Launch')->first()->due_date->toDateString());
        $this->assertPortalLog('create', "Project created: New shop from template #{$template['id']}");

        $this->deleteJson("/api/project-portal/projects/templates/{$template['id']}")->assertNoContent();
        $this->assertNull(ProjectTemplate::find($template['id']));
    }

    /**
     * @description Project page data: counts (pending approvals, published updates, open
     *   threads), the team activity (client messages and decisions, updates, checkpoints - no
     *   internal notes), files of all sources incl. internal notes and drafts (flagged by source),
     *   permanent delete removes updates / approvals with their files.
     * @input pending + approved approval (with a decision), published + draft update (file),
     *   client message, internal note, checkpoint done; GET show / activity / files; force delete.
     * @output pending_approvals_count 1, published_updates_count 1, open_threads_count 1; activity
     *   types ⊇ {client_message, approval_decided, update, checkpoint}; files with source update
     *   (draft too) + thread; after the delete no update / approval / file left.
     */
    public function test_project_page_data_and_cascade(): void
    {
        $this->signIn($this->userWith(['web-projects-view', 'web-projects-delete']));
        $this->project->approvals()->create(['title' => 'P', 'status' => 'pending', 'requested_at' => now()]);
        $approved = $this->project->approvals()->create(['title' => 'Q', 'status' => 'approved', 'requested_at' => now()->subHour()]);
        $approved->decisions()->create(['decision' => 'approved', 'author_label' => 'Anna']);
        $this->project->updates()->create(['title' => 'Live', 'body' => 'x', 'published_at' => now()]);
        $draft = $this->project->updates()->create(['title' => 'Draft', 'body' => 'x']);
        $this->attach($draft, 'web/project_updates/d.pdf');
        $thread = $this->thread($this->project, ['subject' => 'Hosting'], [['customer', 'Question']]);
        $thread->messages()->create(['author_type' => 'admin', 'body' => 'Secret note', 'is_internal' => true]);
        $checkpoint = $this->project->checkpoints()->create(['label' => 'Design']);
        $checkpoint->setStatus('done');
        $checkpoint->save();

        $this->getJson("/api/project-portal/projects/{$this->project->id}")->assertOk()
            ->assertJsonPath('data.pending_approvals_count', 1)->assertJsonPath('data.published_updates_count', 1)->assertJsonPath('data.open_threads_count', 1);
        $types = array_column($this->getJson("/api/project-portal/projects/{$this->project->id}/activity")->assertOk()->json('data'), 'type');
        foreach (['client_message', 'approval_decided', 'update', 'checkpoint'] as $type) {
            $this->assertContains($type, $types);
        }
        $this->assertNotContains('reply', $types);
        $this->getJson("/api/project-portal/projects/{$this->project->id}/files")->assertOk()
            ->assertJsonPath('data.0.source', 'update')->assertJsonPath('data.0.source_title', 'Draft');

        $this->deleteJson("/api/project-portal/projects/{$this->project->id}?force_delete=true")->assertNoContent();
        $this->assertSame(0, ProjectUpdate::count() + ProjectApproval::count() + CoreAttachment::count());
        Storage::disk('private')->assertMissing('web/project_updates/d.pdf');
    }
}
