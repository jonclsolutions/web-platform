<?php

/**
 * @file ProjectPortalMaintenanceTest.php
 * @path api/tests/Apps/ProjectPortal/Feature/ProjectPortalMaintenanceTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the maintenance switch of the project portal
 *   (ProjectPortalMaintenanceController, CheckProjectPortalActive): the admin switch with the
 *   password confirmation and its log, the public status and the 503 of every public endpoint
 *   (client portal, order form) while the portal is off.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures.
 */

namespace Tests\Apps\ProjectPortal\Feature;

use App\Apps\ProjectPortal\Http\Middleware\CheckProjectPortalActive;
use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description /api/project-portal/maintenance, /api/project-portal/public/status and the
 *   `project-portal.active` middleware of the public routes.
 */
class ProjectPortalMaintenanceTest extends TestCase
{
    use ProjectFixtures;

    /**
     * @description Signs in an account that may switch the portal.
     * @return User
     */
    private function admin(): User
    {
        return $this->signIn($this->userWith(['project-portal-set-maintenance-mode']));
    }

    /**
     * @description The admin switch needs its permission; the portal is online by default and
     *   the public status says so without a maintenance text.
     * @input Account without the permission: GET; admin: GET; public GET status.
     * @output 403; {is_portal_active: true, portal_maintenance_message: null};
     *   {is_portal_active: true, maintenance_message: null}.
     */
    public function test_default_state_and_permission(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/project-portal/maintenance')->assertStatus(403);
        $this->putJson('/api/project-portal/maintenance', ['confirm_password' => $this->defaultPassword, 'is_portal_active' => false])->assertStatus(403);

        $this->admin();
        $this->getJson('/api/project-portal/maintenance')->assertOk()
            ->assertExactJson(['data' => ['is_portal_active' => true, 'portal_maintenance_message' => null]]);
        $this->getJson('/api/project-portal/public/status')->assertOk()
            ->assertExactJson(['data' => ['is_portal_active' => true, 'maintenance_message' => null]]);
    }

    /**
     * @description A wrong password is refused and logged; the portal stays online; the password
     *   is required.
     * @input PUT {confirm_password: wrong, is_portal_active: false}; PUT {}.
     * @output 403 "Invalid confirmation password."; log 'unauthorized_maintenance_toggle_attempt';
     *   still online; 422 confirm_password.
     */
    public function test_wrong_password_is_refused(): void
    {
        $this->admin();
        $this->putJson('/api/project-portal/maintenance', ['confirm_password' => 'wrong', 'is_portal_active' => false])
            ->assertStatus(403)->assertJson(['message' => 'Invalid confirmation password.']);

        $this->assertPortalLog('unauthorized_maintenance_toggle_attempt', 'UNAUTHORIZED');
        $this->assertTrue(ProjectPortalSetting::current()->is_portal_active);
        $this->putJson('/api/project-portal/maintenance', [])->assertStatus(422)->assertJsonValidationErrors(['confirm_password']);
    }

    /**
     * @description Switching off drops the cached state, is logged without the password, and every
     *   public endpoint answers 503 with the text; the status endpoint keeps answering; switching on
     *   opens them again.
     * @input Cached state; PUT off with 'Back at 6 pm'; public login, session, lead, order, status;
     *   PUT on.
     * @output Cache key gone; log 'maintenance_status_changed' "DISABLED" without the password; 503
     *   {message: 'Back at 6 pm'} ×4; status {false, 'Back at 6 pm'}; after on: login 422 / lead 404
     *   (the endpoints themselves).
     */
    public function test_switching_off_closes_the_public_portal(): void
    {
        $project = $this->project();
        $this->admin();
        Cache::put(ProjectPortalSetting::ACTIVE_CACHE_KEY, 'cached', 300);

        $this->putJson('/api/project-portal/maintenance', [
            'confirm_password' => $this->defaultPassword, 'is_portal_active' => false, 'portal_maintenance_message' => 'Back at 6 pm',
        ])->assertOk()->assertJsonPath('data.is_portal_active', false)->assertJsonPath('data.portal_maintenance_message', 'Back at 6 pm');

        $this->assertFalse(Cache::has(ProjectPortalSetting::ACTIVE_CACHE_KEY));
        $this->assertPortalLog('maintenance_status_changed', 'DISABLED (Maintenance)');
        $this->assertStringNotContainsString($this->defaultPassword, (string) DB::table('project_portal_logs')->pluck('context_data')->implode(' '));

        $closed = [
            ['postJson', "/api/projects/public/{$project->access_token}/login", ['username' => 'x', 'password' => 'y']],
            ['getJson', "/api/projects/public/{$project->access_token}", []],
            ['getJson', '/api/project-portal/public/sales-leads/any-token', []],
            ['postJson', '/api/project-portal/public/sales-orders', []],
        ];
        foreach ($closed as [$method, $url, $body]) {
            $this->{$method}($url, $body)->assertStatus(503)->assertExactJson(['message' => 'Back at 6 pm']);
        }
        $this->getJson('/api/project-portal/public/status')->assertOk()
            ->assertExactJson(['data' => ['is_portal_active' => false, 'maintenance_message' => 'Back at 6 pm']]);

        $this->putJson('/api/project-portal/maintenance', ['confirm_password' => $this->defaultPassword, 'is_portal_active' => true])->assertOk();
        $this->postJson("/api/projects/public/{$project->access_token}/login", [])->assertStatus(422);
        $this->getJson('/api/project-portal/public/sales-leads/any-token')->assertStatus(404);
    }

    /**
     * @description Without its own text the maintenance answer uses the default one.
     * @input Settings row off without a text; public lead request; status.
     * @output 503 with CheckProjectPortalActive::DEFAULT_MESSAGE; status the same text.
     */
    public function test_default_maintenance_text(): void
    {
        ProjectPortalSetting::current()->update(['is_portal_active' => false]);
        $text = CheckProjectPortalActive::DEFAULT_MESSAGE;

        $this->getJson('/api/project-portal/public/sales-leads/any-token')->assertStatus(503)->assertExactJson(['message' => $text]);
        $this->getJson('/api/project-portal/public/status')->assertJsonPath('data.maintenance_message', $text);
    }
}
