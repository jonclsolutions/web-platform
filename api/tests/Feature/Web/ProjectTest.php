<?php

/**
 * @file ProjectTest.php
 * @path api/tests/Feature/Web/ProjectTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the customer projects administration (WebProjectController):
 *   list (waiting threads, assignee, "my projects"), create (access token, no client account yet),
 *   edit (assignee), delete (permanent = accounts, sessions, checkpoints, threads, messages and
 *   files), trash, assignable administrators, files of the conversations and checkpoints (due
 *   date, internal note, order, client notification).
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage fake.
 */

namespace Tests\Feature\Web;

use App\Mail\Web\ProjectClientUpdateMail;
use App\Models\Web\WebAttachment;
use App\Models\Web\WebProject;
use App\Models\Web\WebLog;
use App\Models\Web\WebProjectAccount;
use App\Models\Web\WebProjectCheckpoint;
use App\Models\Web\WebProjectSession;
use App\Models\Web\WebProjectThread;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description /api/web/projects.
 */
class ProjectTest extends TestCase
{
    use WebFixtures;

    /** @var string[] All project permissions. */
    private const ALL = ['web-projects-view', 'web-projects-create', 'web-projects-update', 'web-projects-delete'];

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
     * @description List: permission, search, filters, checkpoint count, lead/order, trash, export.
     * @input A ('Shop', web, public, 2 checkpoints, lead + order, yesterday), B ('App', mobile, private), C trashed.
     * @output Each filter returns the expected project; checkpoints_total 2; access_token / public_url present.
     */
    public function test_index(): void
    {
        config(['app.frontend_url' => 'https://www.example.com']);
        $this->signIn($this->user());
        $this->getJson('/api/web/projects')->assertStatus(403);

        $this->signIn($this->userWith(['web-projects-view']));
        $lead = $this->lead();
        $order = $this->salesOrder(['lead_id' => $lead->id]);
        $a = $this->project(['name' => 'Shop', 'platform' => 'web', 'lead_id' => $lead->id, 'order_id' => $order->id, 'project_lead' => 'Karel']);
        $a->checkpoints()->createMany([['label' => 'Design'], ['label' => 'Build']]);
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $b = $this->project(['name' => 'App', 'platform' => 'mobile', 'visibility' => 'private', 'status' => 'development']);
        $this->project(['name' => 'Gone'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/web/projects?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$a->id], $ids('search=Karel'));
        $this->assertSame([$b->id], $ids('visibility=private'));
        $this->assertSame([$b->id], $ids('status=development'));
        $this->assertSame([$a->id], $ids('platform=web'));
        $this->assertSame([$a->id], $ids('created_at=' . now()->subDay()->toDateString()));
        $this->getJson("/api/web/projects?id={$a->id}")
            ->assertJsonPath('data.0.checkpoints_total', 2)
            ->assertJsonPath('data.0.lead.id', $lead->id)
            ->assertJsonPath('data.0.order.id', $order->id)
            ->assertJsonPath('data.0.public_url', "https://www.example.com/projects/{$a->access_token}");
        $this->assertSame(['Gone'], array_column($this->getJson('/api/web/projects?only_trashed=1')->json('data'), 'name'));
        $this->getJson('/api/web/projects?per_page=1')->assertJson(['meta' => ['total' => 2, 'last_page' => 2]]);
        $this->getJson('/api/web/projects?no_pagination=1')->assertOk()->assertJsonCount(2, 'data');
    }

    /**
     * @description Create: random 48-char access token, status default 'new', no client account
     *   and no password (accounts are added on the project page); validation; database error.
     * @input POST {name, visibility}; POST invalid (no name, bad dates, unknown order); failing INSERT.
     * @output 201 {data: {access_token (48), status 'new'}} without any password; 0 accounts; 422; 500.
     */
    public function test_store(): void
    {
        $this->signIn($this->userWith(self::ALL));

        $response = $this->postJson('/api/web/projects', ['name' => 'Portal', 'visibility' => 'public', 'estimated_completion_from' => '2026-11-01', 'estimated_completion_to' => '2026-12-01'])
            ->assertCreated()->assertJsonPath('data.status', 'new')->assertJsonPath('data.estimated_completion_to', '2026-12-01')
            ->assertJsonMissingPath('data.generated_password')->assertJsonMissingPath('meta.password');

        $project = WebProject::sole();
        $this->assertSame(48, strlen($response->json('data.access_token')));
        $this->assertSame(0, $project->accounts()->count());
        $this->assertWebLog('create', 'Project created: Portal');

        $this->postJson('/api/web/projects', ['visibility' => 'hidden', 'order_id' => 999, 'estimated_completion_from' => '2026-12-01', 'estimated_completion_to' => '2026-11-01'])
            ->assertStatus(422)->assertJsonValidationErrors(['name', 'visibility', 'order_id', 'estimated_completion_to']);

        $this->failOn('web_projects', 'INSERT');
        $this->postJson('/api/web/projects', ['name' => 'X', 'visibility' => 'private'])->assertStatus(500)->assertJson(['message' => 'Project creation failed.']);
    }

    /**
     * @description Detail (with checkpoints, also trashed), edit, one order per project, 404s,
     *   database error.
     * @input Project with a checkpoint: GET; PUT {status, name}; PUT another project's order; PUT /999; failure.
     * @output 200 with checkpoints; 200; 422 order_id; 404; 500.
     */
    public function test_show_and_update(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $order = $this->salesOrder();
        $taken = $this->project(['order_id' => $order->id]);
        $project = $this->project();
        $project->checkpoints()->create(['label' => 'Kick-off']);

        $this->getJson("/api/web/projects/{$project->id}")->assertOk()->assertJsonPath('data.checkpoints.0.label', 'Kick-off');
        $this->getJson('/api/web/projects/999')->assertStatus(404);
        $this->putJson("/api/web/projects/{$project->id}", ['status' => 'finished', 'name' => 'Done'])
            ->assertOk()->assertJsonPath('data.status', 'finished')->assertJsonPath('data.name', 'Done');
        $this->assertWebLog('update', "Updated project #{$project->id} 'Done': name ");
        $this->assertWebLog('update', 'status new → finished');
        $this->putJson("/api/web/projects/{$project->id}", ['order_id' => $order->id])->assertStatus(422)->assertJsonValidationErrors(['order_id']);
        $this->putJson("/api/web/projects/{$taken->id}", ['order_id' => $order->id])->assertOk();
        $this->putJson('/api/web/projects/999', ['name' => 'x'])->assertStatus(404);

        $this->failOn('web_projects', 'UPDATE');
        $this->putJson("/api/web/projects/{$project->id}", ['name' => 'Boom'])->assertStatus(500)->assertJson(['message' => 'Project update failed.']);
    }

    /**
     * @description Soft delete keeps everything; permanent delete removes accounts, sessions, checkpoints,
     *   threads, messages and their files; 404; database error.
     * @input Project with session, checkpoint, thread + message with attachment; DELETE soft, then force.
     * @output 204 trashed; 204 + no rows / files left; 404; 500.
     */
    public function test_destroy_cascades_on_permanent_delete(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $project = $this->project();
        $this->portalSession($project);
        $project->checkpoints()->create(['label' => 'A']);
        $thread = $this->thread($project, [], [['customer', 'Hello']]);
        $this->attach($thread->messages()->first(), 'web/project_threads/m.pdf');

        $this->deleteJson("/api/web/projects/{$project->id}")->assertNoContent();
        $this->assertSoftDeleted($project);
        $this->assertSame(1, WebProjectSession::count());

        $this->deleteJson("/api/web/projects/{$project->id}?force_delete=true")->assertNoContent();
        $this->assertNull(WebProject::withTrashed()->find($project->id));
        $this->assertSame(0, WebProjectSession::count() + WebProjectCheckpoint::count() + WebProjectThread::count() + WebAttachment::count() + WebProjectAccount::count());
        Storage::disk('private')->assertMissing('web/project_threads/m.pdf');
        $this->assertWebLog('hard_delete');
        $this->deleteJson('/api/web/projects/999')->assertStatus(404);

        $other = $this->project();
        $this->failOn('web_projects', 'UPDATE');
        $this->deleteJson("/api/web/projects/{$other->id}")->assertStatus(500)->assertJson(['message' => 'Project deletion failed.']);
    }

    /**
     * @description Bulk delete (soft / permanent with cascade), restore, empty trash.
     * @input Projects A, B (with a session), C; bulk soft [A, 999]; bulk force [B]; restore A; trash C; empty.
     * @output {deleted 1, requested 2}; B and its session gone; A active; C gone; logs.
     */
    public function test_bulk_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        [$a, $b, $c] = [$this->project(), $this->project(), $this->project()];
        $this->portalSession($b);

        $this->postJson('/api/web/projects/bulk-delete', ['ids' => [$a->id, 999]])->assertOk()->assertJson(['data' => ['deleted_count' => 1, 'requested' => 2]]);
        $this->postJson('/api/web/projects/bulk-delete', ['ids' => [$b->id], 'force_delete' => true])->assertOk();
        $this->assertNull(WebProject::withTrashed()->find($b->id));
        $this->assertSame(0, WebProjectSession::count());
        $this->assertWebLog('hard_delete_bulk');
        $this->postJson('/api/web/projects/bulk-delete', [])->assertStatus(422);

        $this->postJson("/api/web/projects/{$a->id}/restore")->assertOk()->assertJsonPath('data.id', $a->id);
        $this->assertFalse($a->fresh()->trashed());
        $c->delete();
        $this->deleteJson('/api/web/projects/force-delete-all')->assertNoContent();
        $this->assertNull(WebProject::withTrashed()->find($c->id));
        $this->assertWebLog('force_delete_all', 'Count: 1');
    }

    /**
     * @description Assignee ("řešitel"): only active administrators who may edit projects (role
     *   permission, explicit permission or sysadmin) are offered and accepted; the list shows the
     *   assignee and the threads waiting on the team; "my projects" filter.
     * @input Users: Jana (role with update), Adam (explicit update permission), Root (sysadmin role),
     *   Viewer (view only), Blocked (update, blocked). Projects A (assignee Jana, thread waiting on
     *   us + one waiting on the client + a closed one), B (no assignee).
     * @output assignees = [Adam, Jana, Root]; PUT assignee Viewer / Blocked 422, Adam 200 + log;
     *   index: assignee_name, waiting_threads_count 1 / 0; assigned_to_me only A for Jana.
     */
    public function test_assignees_and_my_projects(): void
    {
        $jana = $this->userWith(['web-projects-view', 'web-projects-update'], ['full_name' => 'Jana']);
        $adam = $this->user(['full_name' => 'Adam']);
        $adam->explicitPermissions()->attach($this->permission('web-projects-update')->id);
        $root = $this->user(['full_name' => 'Root'], $this->role('sysadmin'));
        $viewer = $this->userWith(['web-projects-view'], ['full_name' => 'Viewer']);
        $blocked = $this->userWith(['web-projects-update'], ['full_name' => 'Blocked', 'is_blocked' => true]);

        $a = $this->project(['name' => 'A', 'assignee_id' => $jana->id]);
        $b = $this->project(['name' => 'B']);
        $this->thread($a, [], [['customer', 'Help']]);
        $this->thread($a, [], [['customer', 'Q'], ['admin', 'A']]);
        $this->thread($a, ['status' => 'closed'], [['customer', 'Old']]);

        $this->signIn($jana);
        $this->assertSame(['Adam', 'Jana', 'Root'], array_column($this->getJson('/api/web/projects/assignees')->assertOk()->json('data'), 'full_name'));

        $this->putJson("/api/web/projects/{$b->id}", ['assignee_id' => $viewer->id])->assertStatus(422)->assertJsonValidationErrors(['assignee_id']);
        $this->putJson("/api/web/projects/{$b->id}", ['assignee_id' => $blocked->id])->assertStatus(422);
        $this->putJson("/api/web/projects/{$b->id}", ['assignee_id' => $adam->id])->assertOk()
            ->assertJsonPath('data.assignee_id', $adam->id)->assertJsonPath('data.assignee_name', 'Adam');
        $this->assertWebLog('update', 'assignee_id');
        $this->putJson("/api/web/projects/{$b->id}", ['assignee_id' => null])->assertOk()->assertJsonPath('data.assignee_id', null);

        $rows = collect($this->getJson('/api/web/projects')->json('data'))->keyBy('name');
        $this->assertSame('Jana', $rows['A']['assignee_name']);
        $this->assertSame(1, $rows['A']['waiting_threads_count']);
        $this->assertSame(0, $rows['B']['waiting_threads_count']);
        $this->assertSame([$a->id], array_column($this->getJson('/api/web/projects?assigned_to_me=1')->json('data'), 'id'));
        $this->getJson("/api/web/projects/{$a->id}")->assertJsonPath('data.accounts_count', 1)->assertJsonPath('data.assignee_name', 'Jana');

        $this->signIn($this->user());
        $this->getJson('/api/web/projects/assignees')->assertStatus(403);
    }

    /**
     * @description Files of all conversations of a project for the administration - the
     *   attachments of internal notes too (flagged) - with thread subject and author; 404.
     * @input Project with thread "Logo": client message + c.pdf, internal note + n.pdf; other project's file.
     * @output 2 files newest first: n.pdf (is_internal, admin), c.pdf (customer, thread "Logo"); 404 /999.
     */
    public function test_files(): void
    {
        $this->signIn($this->userWith(['web-projects-view']));
        $project = $this->project();
        $thread = $this->thread($project, ['subject' => 'Logo'], [['customer', 'Here']]);
        $this->attach($thread->messages()->first(), 'web/project_threads/c.pdf');
        $note = $thread->messages()->create(['author_type' => 'admin', 'author_label' => 'Jana', 'body' => 'Internal', 'is_internal' => true]);
        $this->attach($note, 'web/project_threads/n.pdf');
        $this->attach($this->thread($this->project(), [], [['customer', 'x']])->messages()->first(), 'web/project_threads/o.pdf');

        $this->getJson("/api/web/projects/{$project->id}/files")->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.original_filename', 'n.pdf')->assertJsonPath('data.0.is_internal', true)->assertJsonPath('data.0.author_type', 'admin')
            ->assertJsonPath('data.1.original_filename', 'c.pdf')->assertJsonPath('data.1.is_internal', false)
            ->assertJsonPath('data.1.thread_id', $thread->id)->assertJsonPath('data.1.thread_subject', 'Logo');
        $this->getJson('/api/web/projects/999/files')->assertStatus(404);
    }

    /**
     * @description Checkpoints: a title (label) and an optional description for the client portal,
     *   added at the end (or at a given position), status change stamps status_changed_at, other
     *   fields update, only checkpoints of the project in the URL (IDOR guard).
     * @input Project P with checkpoint (sort 0); POST {label, description}; POST {label, sort_order: 7, status: done};
     *        PUT status; PUT label; PUT description (set, too long, cleared); PUT/DELETE through another project; DELETE.
     * @output sort_order 1 / 7; description stored; status_changed_at set; label changed; description
     *   max 5000 chars; 404 for the wrong project; 204; log rows name what changed.
     */
    public function test_checkpoints(): void
    {
        $this->signIn($this->userWith(['web-projects-update']));
        $project = $this->project();
        $other = $this->project();
        $project->checkpoints()->create(['label' => 'First', 'sort_order' => 0]);

        $second = $this->postJson("/api/web/projects/{$project->id}/checkpoints", ['label' => 'Second', 'description' => 'What is in it'])
            ->assertCreated()->assertJsonPath('data.sort_order', 1)->assertJsonPath('data.status', 'new')
            ->assertJsonPath('data.description', 'What is in it')->json('data');
        $this->postJson("/api/web/projects/{$project->id}/checkpoints", ['label' => 'Later', 'sort_order' => 7, 'status' => 'done'])
            ->assertCreated()->assertJsonPath('data.sort_order', 7);
        $this->postJson("/api/web/projects/{$other->id}/checkpoints", ['label' => 'Own'])->assertCreated()->assertJsonPath('data.sort_order', 0);
        $this->postJson("/api/web/projects/{$project->id}/checkpoints", ['status' => 'weird'])->assertStatus(422);
        $this->assertWebLog('create', "Added checkpoint 'Second'");

        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}", ['status' => 'done'])
            ->assertOk()->assertJsonPath('data.status', 'done')->assertJsonPath('data.status_changed_at', fn ($v) => $v !== null);
        $this->assertWebLog('checkpoint_status', "Checkpoint 'Second' of project #{$project->id}: status new → done");
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}", ['status' => 'done', 'label' => 'Renamed'])
            ->assertOk()->assertJsonPath('data.label', 'Renamed');
        $this->assertWebLog('update', "Checkpoint 'Second' of project #{$project->id}: renamed to 'Renamed'");
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}", ['description' => 'Launch on the production server.'])
            ->assertOk()->assertJsonPath('data.description', 'Launch on the production server.');
        $this->assertWebLog('update', "Checkpoint 'Renamed' of project #{$project->id}: description changed");
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}", ['description' => str_repeat('x', 5001)])
            ->assertStatus(422)->assertJsonValidationErrors(['description']);
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}", ['description' => null])
            ->assertOk()->assertJsonPath('data.description', null);
        $rows = WebLog::count();
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}", [])->assertOk();
        $this->assertSame($rows, WebLog::count(), 'no change, no log row');
        $this->putJson("/api/web/projects/{$other->id}/checkpoints/{$second['id']}", ['label' => 'Hijack'])->assertStatus(404);
        $this->deleteJson("/api/web/projects/{$other->id}/checkpoints/{$second['id']}")->assertStatus(404);
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/999", ['label' => 'x'])->assertStatus(404);

        $this->deleteJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}")->assertNoContent();
        $this->assertNull(WebProjectCheckpoint::find($second['id']));
        $this->assertWebLog('hard_delete', "Deleted checkpoint ID: {$second['id']} 'Renamed'");
    }

    /**
     * @description Checkpoint due date and internal note (admin only), order by drag-free
     *   up/down (PUT order with every id exactly once), e-mails to the client accounts that chose
     *   that kind: a status change, a due date change (set / moved / removed).
     * @input Project with checkpoints A, B, C; account anna (status e-mails on), dana (due date
     *   e-mails on, English); POST with due_date +
     *   internal_note; PUT bad date; PUT due date; PUT order [C, A, B]; PUT order [A, B] / foreign id /
     *   duplicates; PUT status of B; PUT label of B; PUT due date of B removed.
     * @output due_date / internal_note stored and logged by name only; dana gets a due date e-mail
     *   (2026-12-01) for A; 422 date; sort 0..2 in the new order + log; 422 for an incomplete /
     *   foreign / duplicate list; anna one mail on the status change (log mentions it), none on the
     *   rename; dana a "removed" e-mail.
     */
    public function test_checkpoint_dates_notes_order_and_notifications(): void
    {
        Mail::fake();
        $this->signIn($this->userWith(['web-projects-update']));
        $project = $this->project();
        $this->portalAccount($project, 'anna', 'Anna', ['email' => 'anna@client.cz', 'notify_checkpoint_status' => true]);
        $this->portalAccount($project, 'dana', 'Dana', ['email' => 'dana@client.cz', 'notify_checkpoint_dates' => true, 'language' => 'en']);
        [$a, $b] = [$project->checkpoints()->create(['label' => 'A', 'sort_order' => 0]), $project->checkpoints()->create(['label' => 'B', 'sort_order' => 1])];
        $c = $this->postJson("/api/web/projects/{$project->id}/checkpoints", ['label' => 'C', 'due_date' => '2026-12-24', 'internal_note' => 'Waiting for the hosting'])
            ->assertCreated()->assertJsonPath('data.due_date', '2026-12-24')->assertJsonPath('data.internal_note', 'Waiting for the hosting')->json('data');

        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$a->id}", ['due_date' => '24.12.2026'])->assertStatus(422)->assertJsonValidationErrors(['due_date']);
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$a->id}", ['due_date' => '2026-12-01', 'internal_note' => 'Note'])->assertOk()->assertJsonPath('data.due_date', '2026-12-01');
        $this->assertWebLog('update', "Checkpoint 'A' of project #{$project->id}: due date changed, internal note changed, 1 client e-mails about the due date");
        Mail::assertQueued(ProjectClientUpdateMail::class, fn (ProjectClientUpdateMail $m) => $m->hasTo('dana@client.cz')
            && $m->kind === ProjectClientUpdateMail::KIND_CHECKPOINT_DATE && $m->itemTitle === 'A' && $m->dueDate === '2026-12-01'
            && str_contains($m->render(), 'A project step has a new due date 12/1/2026:'));
        Mail::assertNotQueued(ProjectClientUpdateMail::class, fn (ProjectClientUpdateMail $m) => $m->hasTo('anna@client.cz'));

        $this->putJson("/api/web/projects/{$project->id}/checkpoints/order", ['ids' => [$c['id'], $a->id, $b->id]])->assertOk()
            ->assertJsonPath('data.0.label', 'C')->assertJsonPath('data.1.label', 'A')->assertJsonPath('data.2.label', 'B');
        $this->assertSame([0, 1, 2], [(int) WebProjectCheckpoint::find($c['id'])->sort_order, (int) $a->fresh()->sort_order, (int) $b->fresh()->sort_order]);
        $this->assertWebLog('checkpoint_order', "Checkpoints of project #{$project->id} reordered");
        $foreign = $this->project()->checkpoints()->create(['label' => 'X']);
        foreach ([[$a->id, $b->id], [$a->id, $b->id, $foreign->id]] as $ids) {
            $this->putJson("/api/web/projects/{$project->id}/checkpoints/order", ['ids' => $ids])->assertStatus(422)->assertJsonValidationErrors(['ids']);
        }
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/order", ['ids' => [$a->id, $a->id, $b->id]])->assertStatus(422)->assertJsonValidationErrors(['ids.0']);
        $this->assertSame(1, (int) $a->fresh()->sort_order);

        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$b->id}", ['status' => 'active'])->assertOk();
        Mail::assertQueued(ProjectClientUpdateMail::class, fn (ProjectClientUpdateMail $m) => $m->hasTo('anna@client.cz')
            && $m->kind === ProjectClientUpdateMail::KIND_CHECKPOINT && $m->itemTitle === 'B' && $m->status === 'active');
        $this->assertWebLog('checkpoint_status', '(1 client e-mails)');
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$b->id}", ['label' => 'B2'])->assertOk();
        Mail::assertQueued(ProjectClientUpdateMail::class, 2);

        $b->update(['due_date' => '2026-12-10']);
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$b->id}", ['due_date' => null])->assertOk();
        Mail::assertQueued(ProjectClientUpdateMail::class, fn (ProjectClientUpdateMail $m) => $m->hasTo('dana@client.cz')
            && $m->kind === ProjectClientUpdateMail::KIND_CHECKPOINT_DATE && $m->dueDate === null
            && str_contains($m->render(), 'The due date of a project step was removed:'));
        Mail::assertQueued(ProjectClientUpdateMail::class, 3);
    }
}
