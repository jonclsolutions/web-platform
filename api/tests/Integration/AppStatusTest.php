<?php

/**
 * @file AppStatusTest.php
 * @path api/tests/Integration/AppStatusTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Integration tests of the status overview of the applications
 *   (CoreAppStatusController, AppManifest::availability() of the web, the e-shop and the project
 *   portal): which applications the user gets, online / maintenance, the diagnosis from the audit
 *   logs (activity, errors) and the health derived from it.
 * @dependencies
 * - Tests\TestCase (InteractsWithAccounts); the settings / log models of the three applications.
 */

namespace Tests\Integration;

use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use App\Apps\Shop\Models\ShopSiteSetting;
use App\Apps\Web\Models\WebLog;
use App\Apps\Web\Models\WebSiteSetting;
use Tests\TestCase;

/**
 * @description GET /api/core/apps/status.
 */
class AppStatusTest extends TestCase
{
    /**
     * @description Writes a row of an audit log.
     * @param class-string $model Log model.
     * @param string $eventType Event type.
     * @param string|null $at Time of the row (default now).
     * @return void
     */
    private function logRow(string $model, string $eventType, ?string $at = null): void
    {
        $model::query()->insert([
            'created_at' => $at ?? now(), 'origin' => 'admin', 'event_type' => $eventType, 'module' => 'Test',
            'description' => 'test', 'user_plain' => 'test',
        ]);
    }

    /**
     * @description The endpoint needs a signed-in user; a user gets only the applications of his
     *   tab permissions, the sysadmin all of them in the registry order.
     * @input Guest; user with view-web; sysadmin.
     * @output 401; ['web']; ['web', 'shop', 'project-portal'].
     */
    public function test_applications_of_the_user(): void
    {
        $this->getJson('/api/core/apps/status')->assertStatus(401);

        $this->signIn($this->userWith(['view-web']));
        $this->assertSame(['web'], array_column($this->getJson('/api/core/apps/status')->assertOk()->json('data'), 'id'));

        $this->signIn($this->sysadmin());
        $this->assertSame(['web', 'shop', 'project-portal'], array_column($this->getJson('/api/core/apps/status')->json('data'), 'id'));
    }

    /**
     * @description Health: online without errors = ok (no settings row = online); maintenance =
     *   offline with its text; an error in the last 24 hours = warning; an older error only shows
     *   as the last error; the diagnosis counts the log rows of the last 24 hours.
     * @input Web: 2 rows today (1 error); e-shop off with a text; portal: 1 row + an error 3 days ago.
     * @output web warning, activity 2, errors 1; shop offline, active false, its text; portal ok,
     *   activity 1, errors 0, last_error_at set; response_ms an int.
     */
    public function test_health_and_diagnostics(): void
    {
        $this->signIn($this->sysadmin());
        WebSiteSetting::create(['is_web_active' => true]);
        ShopSiteSetting::create(['is_shop_active' => false, 'maintenance_message' => 'Inventory today']);
        $this->logRow(WebLog::class, 'create');
        $this->logRow(WebLog::class, 'error');
        $this->logRow(ProjectPortalLog::class, 'update');
        $this->logRow(ProjectPortalLog::class, 'error', now()->subDays(3)->toDateTimeString());

        $apps = collect($this->getJson('/api/core/apps/status')->assertOk()->json('data'))->keyBy('id');

        $this->assertSame(['warning', true, 2, 1], [$apps['web']['health'], $apps['web']['active'], $apps['web']['diagnostics']['activity_24h'], $apps['web']['diagnostics']['errors_24h']]);
        $this->assertIsInt($apps['web']['diagnostics']['response_ms']);
        $this->assertSame(['offline', false, 'Inventory today'], [$apps['shop']['health'], $apps['shop']['active'], $apps['shop']['maintenance_message']]);
        $this->assertSame(['ok', true, 1, 0], [$apps['project-portal']['health'], $apps['project-portal']['active'], $apps['project-portal']['diagnostics']['activity_24h'], $apps['project-portal']['diagnostics']['errors_24h']]);
        $this->assertNotNull($apps['project-portal']['diagnostics']['last_error_at']);
        $this->assertNotNull($apps['project-portal']['diagnostics']['last_activity_at']);
    }

    /**
     * @description The switch of the portal is read fresh from its settings row.
     * @input Portal settings off with a text.
     * @output project-portal offline, active false, the text.
     */
    public function test_portal_maintenance_is_reported(): void
    {
        $this->signIn($this->sysadmin());
        ProjectPortalSetting::current()->update(['is_portal_active' => false, 'portal_maintenance_message' => 'Moving servers']);

        $portal = collect($this->getJson('/api/core/apps/status')->json('data'))->firstWhere('id', 'project-portal');
        $this->assertSame(['offline', false, 'Moving servers'], [$portal['health'], $portal['active'], $portal['maintenance_message']]);
    }
}
