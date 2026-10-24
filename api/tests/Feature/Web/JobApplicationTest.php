<?php

/**
 * @file JobApplicationTest.php
 * @path api/tests/Feature/Web/JobApplicationTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the job applications (WebJobApplicationController): the public
 *   application form with a CV (validation, rate limit) and the admin list / edit (CV replaced)
 *   / delete / trash.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage fake.
 */

namespace Tests\Feature\Web;

use App\Models\Web\WebJobApplication;
use Illuminate\Support\Facades\Storage;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description POST /api/job_applications and /api/web/job_applications.
 */
class JobApplicationTest extends TestCase
{
    use WebFixtures;

    /** @var string[] All job application permissions. */
    private const ALL = ['web-job-applications-view', 'web-job-applications-create', 'web-job-applications-update', 'web-job-applications-delete'];

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
     * @description A valid application form body with a CV.
     * @param array<string, mixed> $overrides Field overrides.
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Eva', 'last_name' => 'Kralova', 'email' => 'eva@example.com', 'position_name' => 'Developer',
            'dataProcessingAgreement' => '1', 'cv_file' => $this->upload('cv.pdf'),
        ], $overrides);
    }

    /**
     * @description The public form stores the application and its CV (folder web/cv_files).
     * @input POST /api/job_applications with cv.pdf.
     * @output 201 {full_name 'Eva Kralova', 1 attachment}; file stored; web log 'create'.
     */
    public function test_public_application(): void
    {
        $this->post('/api/job_applications', $this->payload(), ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.full_name', 'Eva Kralova')->assertJsonCount(1, 'data.attachments');

        $cv = WebJobApplication::sole()->attachments->sole();
        $this->assertStringStartsWith('web/cv_files/', $cv->path);
        Storage::disk('private')->assertExists($cv->path);
        $this->assertWebLog('create', 'Developer (Eva Kralova)');
    }

    /**
     * @description Validation (CV required with a safe type, consent required) and the
     *   per-IP rate limit of the public form.
     * @input POST without CV/consent; POST with cv.exe; 10 valid POSTs then one more.
     * @output 422 "Please upload your CV." + consent; 422 CV type; 11th answers 429.
     */
    public function test_public_application_validation_and_rate_limit(): void
    {
        $this->postJson('/api/job_applications', ['first_name' => 'Eva'])->assertStatus(422)
            ->assertJsonPath('errors.cv_file.0', 'Please upload your CV.')->assertJsonValidationErrors(['dataProcessingAgreement', 'email']);
        $this->post('/api/job_applications', $this->payload(['cv_file' => $this->upload('cv.exe', 1, 'application/octet-stream')]), ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors.cv_file.0', 'Allowed formats for the CV are PDF, Word, images, or archives.');

        foreach (range(1, 8) as $i) {
            $this->post('/api/job_applications', $this->payload(), ['Accept' => 'application/json'])->assertCreated();
        }
        $this->post('/api/job_applications', $this->payload(), ['Accept' => 'application/json'])->assertStatus(429);
    }

    /**
     * @description A database error answers 500.
     * @input job applications INSERT fails.
     * @output 500 "Creation failed.".
     */
    public function test_public_application_database_error(): void
    {
        $this->failOn('web_job_applications', 'INSERT');

        $this->post('/api/job_applications', $this->payload(), ['Accept' => 'application/json'])->assertStatus(500)->assertJson(['message' => 'Creation failed.']);
    }

    /**
     * @description Admin list: permission, search, filters, date, trash, export.
     * @input A (Eva / Developer / interview / yesterday), B (Jan / Designer), C trashed.
     * @output Each filter returns the expected application.
     */
    public function test_admin_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/web/job_applications')->assertStatus(403);

        $this->signIn($this->userWith(['web-job-applications-view']));
        $a = $this->jobApplication(['state' => 'interview']);
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $b = $this->jobApplication(['first_name' => 'Jan', 'last_name' => 'Novy', 'email' => 'jan@x.cz', 'position_name' => 'Designer']);
        $this->jobApplication(['first_name' => 'Gone'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/web/job_applications?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$b->id], $ids('search=Design'));
        $this->assertSame([$a->id], $ids("id={$a->id}"));
        $this->assertSame([$a->id], $ids('state=inter'));
        $this->assertSame([$b->id], $ids('email=jan@'));
        $this->assertSame([$a->id], $ids('created_at=' . now()->subDay()->toDateString()));
        $this->assertSame(['Gone'], array_column($this->getJson('/api/web/job_applications?only_trashed=1')->json('data'), 'first_name'));
        $this->getJson('/api/web/job_applications?per_page=1')->assertJson(['meta' => ['total' => 2, 'last_page' => 2]]);
        $this->assertCount(2, $this->getJson('/api/web/job_applications?no_pagination=1')->json('data'));
    }

    /**
     * @description Admin create, detail, edit with the CV replaced (old file deleted), 404s,
     *   database errors.
     * @input Creator POST; application with cv old.pdf: GET; PUT {state, cv_file: new.pdf}; PUT {state: x};
     *        PUT /999; failing UPDATE.
     * @output 201; 200; 200 state 'selected', only new.pdf, log "State: selected"; 422; 404; 500.
     */
    public function test_admin_store_show_update(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $this->post('/api/web/job_applications', $this->payload(), ['Accept' => 'application/json'])->assertCreated();

        $application = $this->jobApplication();
        $this->attach($application, 'web/cv_files/old.pdf');
        $this->getJson("/api/web/job_applications/{$application->id}")->assertOk()->assertJsonCount(1, 'data.attachments');
        $this->getJson('/api/web/job_applications/999')->assertStatus(404);

        $this->post("/api/web/job_applications/{$application->id}", ['_method' => 'PUT', 'state' => 'selected', 'cv_file' => $this->upload('new.pdf')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.state', 'selected')->assertJsonPath('data.attachments.0.original_filename', 'new.pdf')->assertJsonCount(1, 'data.attachments');
        Storage::disk('private')->assertMissing('web/cv_files/old.pdf');
        $this->assertWebLog('update', 'State: selected');
        $this->putJson("/api/web/job_applications/{$application->id}", ['internal_note' => 'n'])->assertOk();
        $this->assertWebLog('update', 'State: unchanged');
        $this->putJson("/api/web/job_applications/{$application->id}", ['state' => 'hired'])->assertStatus(422);
        $this->putJson('/api/web/job_applications/999', ['state' => 'pool'])->assertStatus(404);

        $this->failOn('web_job_applications', 'UPDATE');
        $this->putJson("/api/web/job_applications/{$application->id}", ['state' => 'pool'])->assertStatus(500)->assertJson(['message' => 'Update failed.']);
    }

    /**
     * @description Delete (permanent removes the CV), restore, empty trash, 404s, database errors.
     * @input A, B (CV), C (CV, trashed); actions in sequence; failures.
     * @output As expected; files deleted.
     */
    public function test_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        [$a, $b, $c] = [$this->jobApplication(), $this->jobApplication(), $this->jobApplication()];
        $this->attach($b, 'web/cv_files/b.pdf');
        $this->attach($c, 'web/cv_files/c.pdf');

        $this->deleteJson("/api/web/job_applications/{$a->id}")->assertNoContent();
        $this->deleteJson("/api/web/job_applications/{$b->id}?force_delete=1")->assertNoContent();
        Storage::disk('private')->assertMissing('web/cv_files/b.pdf');
        $this->deleteJson('/api/web/job_applications/999')->assertStatus(404);
        $this->postJson("/api/web/job_applications/{$a->id}/restore")->assertOk();
        $this->postJson('/api/web/job_applications/999/restore')->assertStatus(404);
        $c->delete();
        $this->deleteJson('/api/web/job_applications/force-delete-all')->assertNoContent();
        Storage::disk('private')->assertMissing('web/cv_files/c.pdf');
        $this->assertWebLog('force_delete_all', 'Count: 1');

        $d = $this->jobApplication();
        $d->delete();
        $this->failOn('web_job_applications', 'UPDATE');
        $this->deleteJson("/api/web/job_applications/{$a->id}")->assertStatus(500)->assertJson(['message' => 'Deletion failed.']);
        $this->postJson("/api/web/job_applications/{$d->id}/restore")->assertStatus(500)->assertJson(['message' => 'Restoration failed.']);
        $this->failOn('web_job_applications', 'DELETE');
        $this->deleteJson('/api/web/job_applications/force-delete-all')->assertStatus(500);
    }

    /**
     * @description Bulk delete: soft, permanent (CV files removed too), unknown ids skipped,
     *   validation, database error.
     * @input A, B (CV); bulk soft [A, 999]; bulk force [B + 60 unknown ids]; empty body; failing UPDATE.
     * @output {deleted 1, skipped 1, requested 2}; B and its CV gone, log with '...'; 422; 500.
     */
    public function test_bulk_delete(): void
    {
        $this->signIn($this->userWith(['web-job-applications-delete']));
        [$a, $b] = [$this->jobApplication(), $this->jobApplication()];
        $this->attach($b, 'web/cv_files/b.pdf');

        $this->postJson('/api/web/job_applications/bulk-delete', ['ids' => [$a->id, 999]])->assertOk()
            ->assertJson(['data' => ['deleted_count' => 1, 'skipped_count' => 1, 'requested' => 2]]);
        $this->assertSoftDeleted($a);
        $this->assertWebLog('soft_delete_bulk');
        $this->postJson('/api/web/job_applications/bulk-delete', ['ids' => array_merge([$b->id], range(4000, 4060)), 'force_delete' => true])
            ->assertOk()->assertJsonPath('data.deleted_count', 1);
        $this->assertNull(WebJobApplication::withTrashed()->find($b->id));
        Storage::disk('private')->assertMissing('web/cv_files/b.pdf');
        $this->assertWebLog('hard_delete_bulk', '...');
        $this->postJson('/api/web/job_applications/bulk-delete', [])->assertStatus(422);

        $c = $this->jobApplication();
        $this->failOn('web_job_applications', 'UPDATE');
        $this->postJson('/api/web/job_applications/bulk-delete', ['ids' => [$c->id]])->assertStatus(500)->assertJson(['message' => 'Bulk deletion failed.']);
    }
}
