<?php

/**
 * @file ProjectTest.php
 * @path api/tests/Feature/Web/ProjectTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the customer projects administration (WebProjectController):
 *   list, create (access token + one-time password), edit, delete (permanent = sessions,
 *   checkpoints, threads, messages and files), trash, password regeneration and checkpoints.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage fake.
 */

namespace Tests\Feature\Web;

use App\Models\Web\WebAttachment;
use App\Models\Web\WebProject;
use App\Models\Web\WebProjectCheckpoint;
use App\Models\Web\WebProjectSession;
use App\Models\Web\WebProjectThread;
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
        $this->getJson('/api/web/projects?per_page=1')->assertJson(['total' => 2, 'last_page' => 2]);
        $this->getJson('/api/web/projects?no_pagination=1')->assertOk()->assertJsonCount(2);
    }

    /**
     * @description Create: random 48-char access token, status default 'new', the password is
     *   returned exactly once (only its hash is stored); validation; database error.
     * @input POST {name, visibility}; POST invalid (no name, bad dates, unknown order); failing INSERT.
     * @output 201 {data: {access_token (48), status 'new', generated_password}}; the password
     *   verifies; 422; 500.
     */
    public function test_store(): void
    {
        $this->signIn($this->userWith(self::ALL));

        $data = $this->postJson('/api/web/projects', ['name' => 'Portal', 'visibility' => 'public', 'estimated_completion_from' => '2026-11-01', 'estimated_completion_to' => '2026-12-01'])
            ->assertCreated()->assertJsonPath('data.status', 'new')->assertJsonPath('data.estimated_completion_to', '2026-12-01')->json('data');

        $project = WebProject::sole();
        $this->assertSame(48, strlen($data['access_token']));
        $this->assertTrue($project->verifyPassword($data['generated_password']));
        $this->assertNotNull($project->password_generated_at);
        $this->assertArrayNotHasKey('access_password_hash', $project->toArray());
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
        $this->assertWebLog('update', "Updated project ID: {$project->id}");
        $this->putJson("/api/web/projects/{$project->id}", ['order_id' => $order->id])->assertStatus(422)->assertJsonValidationErrors(['order_id']);
        $this->putJson("/api/web/projects/{$taken->id}", ['order_id' => $order->id])->assertOk();
        $this->putJson('/api/web/projects/999', ['name' => 'x'])->assertStatus(404);

        $this->failOn('web_projects', 'UPDATE');
        $this->putJson("/api/web/projects/{$project->id}", ['name' => 'Boom'])->assertStatus(500)->assertJson(['message' => 'Project update failed.']);
    }

    /**
     * @description Soft delete keeps everything; permanent delete removes sessions, checkpoints,
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
        $this->assertSame(0, WebProjectSession::count() + WebProjectCheckpoint::count() + WebProjectThread::count() + WebAttachment::count());
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
     * @description A new password invalidates every open portal session.
     * @input Project with 2 sessions, POST regenerate-password; for /999.
     * @output 200 {generated_password} that verifies; 0 sessions; log "invalidated 2"; 404.
     */
    public function test_regenerate_password(): void
    {
        $this->signIn($this->userWith(['web-projects-update']));
        $project = $this->project();
        $this->portalSession($project);
        $this->portalSession($project);

        $password = $this->postJson("/api/web/projects/{$project->id}/regenerate-password")->assertOk()->json('data.generated_password');

        $this->assertTrue($project->fresh()->verifyPassword($password));
        $this->assertFalse($project->fresh()->verifyPassword($this->projectPassword));
        $this->assertSame(0, WebProjectSession::count());
        $this->assertWebLog('regenerate_password', 'invalidated 2 active sessions');
        $this->postJson('/api/web/projects/999/regenerate-password')->assertStatus(404);
    }

    /**
     * @description Checkpoints: added at the end (or at a given position), status change stamps
     *   status_changed_at, other fields update, only checkpoints of the project in the URL (IDOR guard).
     * @input Project P with checkpoint (sort 0); POST {label}; POST {label, sort_order: 7, status: done};
     *        PUT status active; PUT label; PUT/DELETE through another project; DELETE.
     * @output sort_order 1 / 7; status_changed_at set; label changed; 404 for the wrong project; 204.
     */
    public function test_checkpoints(): void
    {
        $this->signIn($this->userWith(['web-projects-update']));
        $project = $this->project();
        $other = $this->project();
        $project->checkpoints()->create(['label' => 'First', 'sort_order' => 0]);

        $second = $this->postJson("/api/web/projects/{$project->id}/checkpoints", ['label' => 'Second'])
            ->assertCreated()->assertJsonPath('data.sort_order', 1)->assertJsonPath('data.status', 'new')->json('data');
        $this->postJson("/api/web/projects/{$project->id}/checkpoints", ['label' => 'Later', 'sort_order' => 7, 'status' => 'done'])
            ->assertCreated()->assertJsonPath('data.sort_order', 7);
        $this->postJson("/api/web/projects/{$other->id}/checkpoints", ['label' => 'Own'])->assertCreated()->assertJsonPath('data.sort_order', 0);
        $this->postJson("/api/web/projects/{$project->id}/checkpoints", ['status' => 'weird'])->assertStatus(422);
        $this->assertWebLog('create', "Added checkpoint 'Second'");

        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}", ['status' => 'active'])
            ->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.status_changed_at', fn ($v) => $v !== null);
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}", ['status' => 'active', 'label' => 'Renamed'])
            ->assertOk()->assertJsonPath('data.label', 'Renamed');
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}", [])->assertOk();
        $this->putJson("/api/web/projects/{$other->id}/checkpoints/{$second['id']}", ['label' => 'Hijack'])->assertStatus(404);
        $this->deleteJson("/api/web/projects/{$other->id}/checkpoints/{$second['id']}")->assertStatus(404);
        $this->putJson("/api/web/projects/{$project->id}/checkpoints/999", ['label' => 'x'])->assertStatus(404);

        $this->deleteJson("/api/web/projects/{$project->id}/checkpoints/{$second['id']}")->assertNoContent();
        $this->assertNull(WebProjectCheckpoint::find($second['id']));
        $this->assertWebLog('hard_delete', "Deleted checkpoint ID: {$second['id']}");
    }
}
