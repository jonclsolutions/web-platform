<?php

/**
 * @file ProjectAccountTest.php
 * @path api/tests/Apps/ProjectPortal/Feature/ProjectAccountTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the client accounts of a project portal (ProjectAccountController):
 *   list, add (password typed in or generated, returned once), change, password reset (ends the
 *   sessions), removal, validation, permissions, IDOR guard and audit log without personal data.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures.
 */

namespace Tests\Apps\ProjectPortal\Feature;

use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\ProjectAccount;
use App\Apps\ProjectPortal\Models\ProjectSession;
use App\Apps\ProjectPortal\Models\ProjectThreadMessage;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description /api/project-portal/projects/{projectId}/accounts.
 */
class ProjectAccountTest extends TestCase
{
    use ProjectFixtures;

    /**
     * @description Asserts that no audit log row contains any of the given values.
     * @param string[] $values Secrets / personal data.
     * @return void
     */
    private function assertLogsDoNotContain(array $values): void
    {
        $dump = ProjectPortalLog::all()->map(fn (ProjectPortalLog $log) => $log->description . json_encode($log->context_data, JSON_UNESCAPED_UNICODE))->implode("\n");
        foreach ($values as $value) {
            $this->assertStringNotContainsString($value, $dump);
        }
    }

    /**
     * @description List: permission, oldest first, signed-in devices, never the password hash.
     * @input Project with "klient" (1 active + 1 expired session) and anna; viewer; user without permission.
     * @output 403; [klient (active_sessions 1), anna (0)] without password_hash.
     */
    public function test_index(): void
    {
        $project = $this->project();
        $anna = $this->portalAccount($project, 'anna', 'Anna Malá', ['email' => 'anna@client.cz']);
        $this->portalSession($project);
        $this->portalSession($project);
        ProjectSession::latest('id')->first()->update(['expires_at' => now()->subMinute()]);

        $this->signIn($this->user());
        $this->getJson("/api/project-portal/projects/{$project->id}/accounts")->assertStatus(403);

        $this->signIn($this->userWith(['web-projects-view']));
        $data = $this->getJson("/api/project-portal/projects/{$project->id}/accounts")->assertOk()
            ->assertJsonPath('data.0.username', 'klient')->assertJsonPath('data.0.active_sessions', 1)
            ->assertJsonPath('data.1.id', $anna->id)->assertJsonPath('data.1.email', 'anna@client.cz')
            ->assertJsonPath('data.1.notify_replies', false)->assertJsonPath('data.1.active_sessions', 0)
            ->json('data');
        $this->assertArrayNotHasKey('password_hash', $data[0]);
        $this->getJson('/api/project-portal/projects/999/accounts')->assertStatus(404);
    }

    /**
     * @description Add: typed-in password (policy), generated password (14 letters / digits),
     *   login name lower-cased and unique per project (another project may reuse it), notify
     *   cannot be turned on by the administration (the client's choice), language; the password is in the answer once and only its hash is stored;
     *   viewer 403; trashed / unknown project 404; the log has neither password nor personal data.
     * @input POST {username " Petr.N ", display_name, password "Heslo12345"}; POST without password;
     *   POST with e-mail + notify flags; POST duplicates / bad format / weak password / bad language.
     * @output 201 username "petr.n", meta.password = typed one, verifies; generated 14 chars that
     *   verify; notifications stay off; 422s; another project accepts "petr.n"; 403; 404.
     */
    public function test_store(): void
    {
        $project = $this->project();
        $this->signIn($this->userWith(['web-projects-view']));
        $this->postJson("/api/project-portal/projects/{$project->id}/accounts", ['username' => 'x', 'display_name' => 'X'])->assertStatus(403);

        $this->signIn($this->userWith(['web-projects-update']));
        $typed = $this->postJson("/api/project-portal/projects/{$project->id}/accounts", ['username' => ' Petr.N ', 'display_name' => 'Petr Novák', 'password' => 'Heslo12345'])
            ->assertCreated()->assertJsonPath('data.username', 'petr.n')->assertJsonPath('data.language', 'cz')
            ->assertJsonPath('meta.password', 'Heslo12345')->assertJsonMissingPath('data.password_hash');
        $petr = ProjectAccount::findOrFail($typed->json('data.id'));
        $this->assertTrue($petr->verifyPassword('Heslo12345'));
        $this->assertNotNull($petr->password_set_at);
        $this->assertPortalLog('account_create', "Portal account #{$petr->id} added to project #{$project->id}");

        $generated = $this->postJson("/api/project-portal/projects/{$project->id}/accounts", [
            'username' => 'eva', 'display_name' => 'Eva', 'email' => 'eva@client.cz', 'language' => 'en',
            'notify_replies' => true, 'notify_checkpoint_status' => true, 'notify_checkpoint_dates' => true,
        ])->assertCreated()->assertJsonPath('data.email', 'eva@client.cz')->assertJsonPath('data.language', 'en')
            ->assertJsonPath('data.notify_replies', false)->assertJsonPath('data.notify_checkpoint_status', false)
            ->assertJsonPath('data.notify_checkpoint_dates', false)->json('meta.password');
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9]{14}$/', $generated);
        $this->assertTrue(ProjectAccount::where('username', 'eva')->sole()->verifyPassword($generated));

        $this->postJson("/api/project-portal/projects/{$project->id}/accounts", ['username' => 'PETR.N', 'display_name' => 'Dup'])
            ->assertStatus(422)->assertJsonValidationErrors(['username']);
        $this->postJson("/api/project-portal/projects/{$project->id}/accounts", ['username' => 'a b', 'display_name' => 'X'])->assertStatus(422)->assertJsonValidationErrors(['username']);
        $this->postJson("/api/project-portal/projects/{$project->id}/accounts", ['username' => 'ab', 'display_name' => ''])->assertStatus(422)->assertJsonValidationErrors(['username', 'display_name']);
        $this->postJson("/api/project-portal/projects/{$project->id}/accounts", ['username' => 'weak', 'display_name' => 'W', 'password' => 'short1'])->assertStatus(422)->assertJsonValidationErrors(['password']);
        $this->postJson("/api/project-portal/projects/{$project->id}/accounts", ['username' => 'weak', 'display_name' => 'W', 'password' => 'onlyletterspassword'])->assertStatus(422)->assertJsonValidationErrors(['password']);
        $this->postJson("/api/project-portal/projects/{$project->id}/accounts", ['username' => 'lang', 'display_name' => 'L', 'language' => 'de', 'email' => 'nope'])->assertStatus(422)->assertJsonValidationErrors(['language', 'email']);

        $this->postJson("/api/project-portal/projects/{$this->project()->id}/accounts", ['username' => 'petr.n', 'display_name' => 'Other'])->assertCreated();
        $trashed = $this->project();
        $trashed->delete();
        $this->postJson("/api/project-portal/projects/{$trashed->id}/accounts", ['username' => 'zed', 'display_name' => 'Z'])->assertStatus(404);
        $this->postJson('/api/project-portal/projects/999/accounts', ['username' => 'zed', 'display_name' => 'Z'])->assertStatus(404);

        $this->assertLogsDoNotContain(['Heslo12345', $generated, 'Petr Novák', 'eva@client.cz', $petr->password_hash]);
    }

    /**
     * @description Change: login name (unique, own one allowed), display name, e-mail, language;
     *   the notifications are the client's - the administration cannot turn them on and changing or
     *   removing the e-mail turns them off; the log names the changed fields, not their values; no
     *   change = no log row; IDOR 404.
     * @input anna (e-mail, all notifications on) and klient; PUT anna {display_name, language en};
     *   PUT {username: klient}; PUT {username: anna}; PUT {notify_replies: false} (ignored);
     *   PUT {email: new}; PUT klient {notify_replies: true}; PUT {email: null}; PUT {}; PUT through another project.
     * @output 200 + log "display_name, language"; 422; 200; flags untouched; new e-mail turns all off;
     *   klient stays off; e-mail null; no row; 404.
     */
    public function test_update(): void
    {
        $project = $this->project();
        $klient = $project->accounts()->sole();
        $anna = $this->portalAccount($project, 'anna', 'Anna', ['email' => 'anna@client.cz', 'notify_replies' => true, 'notify_checkpoint_status' => true, 'notify_checkpoint_dates' => true]);
        $this->signIn($this->userWith(['web-projects-update']));
        $url = "/api/project-portal/projects/{$project->id}/accounts/{$anna->id}";

        $this->putJson($url, ['display_name' => 'Anna Veliká', 'language' => 'en'])->assertOk()
            ->assertJsonPath('data.display_name', 'Anna Veliká')->assertJsonPath('data.language', 'en');
        $this->assertPortalLog('account_update', "Portal account #{$anna->id} of project #{$project->id} changed: display_name, language");
        $this->putJson($url, ['username' => 'KLIENT'])->assertStatus(422)->assertJsonValidationErrors(['username']);
        $this->putJson($url, ['username' => 'anna'])->assertOk();

        $this->putJson($url, ['notify_replies' => false])->assertOk()->assertJsonPath('data.notify_replies', true);
        $this->putJson($url, ['email' => 'anna@new.cz'])->assertOk()->assertJsonPath('data.email', 'anna@new.cz')
            ->assertJsonPath('data.notify_replies', false)->assertJsonPath('data.notify_checkpoint_status', false)->assertJsonPath('data.notify_checkpoint_dates', false);
        $this->putJson("/api/project-portal/projects/{$project->id}/accounts/{$klient->id}", ['notify_replies' => true])->assertOk();
        $this->assertFalse($klient->fresh()->notify_replies);
        $this->putJson($url, ['email' => null])->assertOk()->assertJsonPath('data.email', null);

        $rows = ProjectPortalLog::count();
        $this->putJson($url, [])->assertOk();
        $this->assertSame($rows, ProjectPortalLog::count(), 'no change, no log row');

        $other = $this->project();
        $this->putJson("/api/project-portal/projects/{$other->id}/accounts/{$anna->id}", ['display_name' => 'Hijack'])->assertStatus(404);
        $this->assertSame('Anna Veliká', $anna->fresh()->display_name);
        $this->assertLogsDoNotContain(['Anna Veliká', 'anna@client.cz', 'anna@new.cz']);
    }

    /**
     * @description Password reset: typed in or generated, the old password stops working, every
     *   session of that account (only) ends, viewer 403, IDOR 404, no password in the log.
     * @input klient with 2 sessions, anna with 1; POST reset klient {password}; POST reset without
     *   password; POST weak; viewer; through another project.
     * @output meta {password, ended_sessions 2}; only anna's session left; generated works; 422; 403; 404.
     */
    public function test_reset_password(): void
    {
        $project = $this->project();
        $klient = $project->accounts()->sole();
        $anna = $this->portalAccount($project, 'anna', 'Anna');
        $this->portalSession($project, $klient);
        $this->portalSession($project, $klient);
        $this->portalSession($project, $anna);
        $url = "/api/project-portal/projects/{$project->id}/accounts/{$klient->id}/password";

        $this->signIn($this->userWith(['web-projects-view']));
        $this->postJson($url)->assertStatus(403);

        $this->signIn($this->userWith(['web-projects-update']));
        $this->postJson($url, ['password' => 'Nove12345heslo'])->assertOk()
            ->assertJsonPath('meta.password', 'Nove12345heslo')->assertJsonPath('meta.ended_sessions', 2);
        $this->assertTrue($klient->fresh()->verifyPassword('Nove12345heslo'));
        $this->assertFalse($klient->fresh()->verifyPassword($this->projectPassword));
        $this->assertSame([$anna->id], ProjectSession::pluck('account_id')->map(fn ($id) => (int) $id)->all());
        $this->assertPortalLog('account_password_reset', "Password of portal account #{$klient->id} of project #{$project->id} reset (2 sessions ended)");

        $generated = $this->postJson($url)->assertOk()->assertJsonPath('meta.ended_sessions', 0)->json('meta.password');
        $this->assertTrue($klient->fresh()->verifyPassword($generated));
        $this->postJson($url, ['password' => 'abc'])->assertStatus(422)->assertJsonValidationErrors(['password']);
        $this->postJson("/api/project-portal/projects/{$this->project()->id}/accounts/{$klient->id}/password")->assertStatus(404);

        $this->assertLogsDoNotContain(['Nove12345heslo', $generated]);
    }

    /**
     * @description Removal: the account and its sessions go, its messages stay under the stored
     *   name (author account emptied); the account cannot sign in any more; IDOR 404.
     * @input anna with a session and a message; DELETE through another project; DELETE; login as anna.
     * @output 404; 204; no account / session; message kept with author_label "Anna", account_id null; 401.
     */
    public function test_destroy(): void
    {
        $project = $this->project();
        $anna = $this->portalAccount($project, 'anna', 'Anna');
        $this->portalSession($project, $anna);
        $thread = $this->thread($project);
        $message = $thread->messages()->create(['author_type' => 'customer', 'author_label' => 'Anna', 'account_id' => $anna->id, 'body' => 'Hi']);
        $this->signIn($this->userWith(['web-projects-update']));

        $this->deleteJson("/api/project-portal/projects/{$this->project()->id}/accounts/{$anna->id}")->assertStatus(404);
        $this->deleteJson("/api/project-portal/projects/{$project->id}/accounts/{$anna->id}")->assertNoContent();

        $this->assertNull(ProjectAccount::find($anna->id));
        $this->assertSame(0, ProjectSession::where('account_id', $anna->id)->count());
        $kept = ProjectThreadMessage::findOrFail($message->id);
        $this->assertSame('Anna', $kept->author_label);
        $this->assertNull($kept->account_id);
        $this->assertPortalLog('account_delete', "Portal account #{$anna->id} removed from project #{$project->id}");

        $this->postJson("/api/projects/public/{$project->access_token}/login", ['username' => 'anna', 'password' => $this->projectPassword])->assertStatus(401);
        $this->deleteJson("/api/project-portal/projects/{$project->id}/accounts/{$anna->id}")->assertStatus(404);
    }
}
