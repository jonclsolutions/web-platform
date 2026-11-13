<?php

/**
 * @file ProjectPortalApplicationTest.php
 * @path api/tests/Apps/ProjectPortal/Feature/ProjectPortalApplicationTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the project portal as an application of its own: the migration
 *   that gives it its audit log and permissions, the log endpoint, the project of a web order,
 *   and the portal without the web application (no origin of a project, no reminder of web
 *   orders).
 * @dependencies
 * - Tests\TestCase, ProjectFixtures, WebFixtures (web orders).
 */

namespace Tests\Apps\ProjectPortal\Feature;

use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\ProjectPortalApp;
use App\Models\Core\CorePermission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\Apps\Web\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description ProjectPortalApp, its migration, ProjectPortalLogController, ProjectPortalAgendaSource.
 */
class ProjectPortalApplicationTest extends TestCase
{
    use ProjectFixtures, WebFixtures;

    /** @description Agenda range around the test orders. */
    private const RANGE = '/api/core/agenda?from=2026-10-26&to=2026-12-06';

    /**
     * @description The migration moves the project rows of the web log into the portal log (names
     *   without `Web`), grants the new permissions to the holders of the permissions they replace
     *   and moves the project permissions to the module `project-portal`; down() reverts it all.
     * @input web_logs rows WebProject / WebProjectCheckpoint / WebSalesOrder; role A with
     *   web-projects-view, role B with web-view-web-logs, account U with web-projects-view of its
     *   own; up(), then down().
     * @output up: 2 portal rows (Project / ProjectCheckpoint, entity Project), 1 web row; A has
     *   view-project-portal, B project-portal-view-logs, U view-project-portal; web-projects-*
     *   module project-portal. down: 3 web rows with the former names, no portal table, the two
     *   permissions gone, module web again.
     */
    public function test_migration(): void
    {
        $migration = require app_path('Apps/ProjectPortal/Database/Migrations/2026_11_22_000000_project_portal_application.php');
        $migration->down();
        foreach ([['WebProject', 'WebProject'], ['WebProjectCheckpoint', 'WebProject'], ['WebSalesOrder', 'WebSalesOrder']] as [$module, $entity]) {
            DB::table('web_logs')->insert(['event_type' => 'update', 'module' => $module, 'description' => "{$module} changed", 'affected_entity_type' => $entity, 'affected_entity_id' => 1]);
        }
        $pm = $this->role('pm', ['web-projects-view', 'web-projects-update']);
        $auditor = $this->role('auditor', ['web-view-web-logs']);
        $account = $this->user();
        DB::table('user_permissions')->insert(['user_id' => $account->id, 'permission_id' => $this->permission('web-projects-view')->id]);

        $migration->up();

        $this->assertSame([['Project', 'Project'], ['ProjectCheckpoint', 'Project']],
            DB::table('project_portal_logs')->orderBy('id')->get()->map(fn ($row) => [$row->module, $row->affected_entity_type])->all());
        $this->assertSame(['WebSalesOrder'], DB::table('web_logs')->pluck('module')->all());
        $this->assertContains('view-project-portal', $pm->permissions()->pluck('permission_key')->all());
        $this->assertSame(['project-portal-view-logs', 'web-view-web-logs'], $auditor->permissions()->orderBy('permission_key')->pluck('permission_key')->all());
        $this->assertTrue(DB::table('user_permissions')->where(['user_id' => $account->id, 'permission_id' => CorePermission::where('permission_key', 'view-project-portal')->value('id')])->exists());
        $this->assertSame(['project-portal'], CorePermission::where('permission_key', 'like', 'web-projects-%')->distinct()->pluck('module')->all());

        $migration->down();

        $this->assertSame(['WebSalesOrder', 'WebProject', 'WebProjectCheckpoint'], DB::table('web_logs')->orderBy('id')->pluck('module')->all());
        $this->assertFalse(Schema::hasTable('project_portal_logs'));
        $this->assertSame(0, CorePermission::whereIn('permission_key', ['view-project-portal', 'project-portal-view-logs'])->count());
        $this->assertSame(['web'], CorePermission::where('permission_key', 'like', 'web-projects-%')->distinct()->pluck('module')->all());
    }

    /**
     * @description The portal log has its own endpoint and permission; the admin changes of the
     *   portal are written into it.
     * @input Account without / with project-portal-view-logs; a project created through the API.
     * @output 403; 200 with the 'create' row of module Project; detail 200.
     */
    public function test_portal_log(): void
    {
        $this->signIn($this->userWith(['web-projects-view']));
        $this->getJson('/api/project-portal/logs')->assertForbidden();

        $this->signIn($this->userWith(['web-projects-create', 'project-portal-view-logs']));
        $this->postJson('/api/project-portal/projects', ['name' => 'Portal', 'visibility' => 'public'])->assertCreated();

        $row = $this->getJson('/api/project-portal/logs')->assertOk()->json('data.0');
        $this->assertSame(['create', 'Project'], [$row['event_type'], $row['module']]);
        $this->getJson("/api/project-portal/logs/{$row['id']}")->assertOk()->assertJsonPath('data.description', 'Project created: Portal');
        $this->assertSame(1, ProjectPortalLog::count());
    }

    /**
     * @description Without the web application a project has no origin: lead / order ids are
     *   refused, a standalone project is created; the calendar has no reminder of web orders.
     * @input apps = [project portal]; POST with order_id; POST without; sysadmin agenda with a
     *   web order without a project in the database.
     * @output 422 order_id + lead_id; 201; no web_orders_without_project, modules without web.
     */
    public function test_portal_without_the_web(): void
    {
        config(['apps.apps' => [ProjectPortalApp::class]]);
        $order = $this->salesOrder();
        $this->signIn($this->sysadmin());

        $this->postJson('/api/project-portal/projects', ['name' => 'X', 'visibility' => 'public', 'order_id' => $order->id, 'lead_id' => 1])
            ->assertStatus(422)->assertJsonValidationErrors(['order_id', 'lead_id']);
        $this->postJson('/api/project-portal/projects', ['name' => 'X', 'visibility' => 'public'])->assertCreated();

        $data = $this->getJson(self::RANGE)->assertOk()->json('data');
        $this->assertNotContains('web_orders_without_project', array_column($data['reminders'], 'type'));
        $this->assertSame(['personal', 'project-portal', 'core'], $data['modules']);
    }

    /**
     * @description The reminder of web orders without a project needs the project view AND the
     *   web orders (tab + page permission); a project of an order removes the order from it.
     * @input Orders A, B; project of A; account with the portal only; account with the portal and
     *   the web orders.
     * @output Portal only: no reminder; with the web orders: count 1, link of the web orders.
     */
    public function test_web_orders_without_a_project(): void
    {
        $a = $this->salesOrder();
        $this->salesOrder(['client_name' => 'Beta']);
        $this->project(['order_id' => $a->id]);

        $this->signIn($this->userWith(['view-project-portal', 'web-projects-view']));
        $this->assertSame([], $this->getJson(self::RANGE)->assertOk()->json('data.reminders'));

        $this->signIn($this->userWith(['view-project-portal', 'web-projects-view', 'view-web', 'web-sales-orders-view']));
        $reminder = collect($this->getJson(self::RANGE)->assertOk()->json('data.reminders'))->firstWhere('type', 'web_orders_without_project');
        $this->assertSame([1, 'project-portal', '/admin/web/sales-orders'], [$reminder['count'], $reminder['module'], $reminder['link']]);
    }
}
