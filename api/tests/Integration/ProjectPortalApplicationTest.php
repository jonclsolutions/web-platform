<?php

/**
 * @file ProjectPortalApplicationTest.php
 * @path api/tests/Integration/ProjectPortalApplicationTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The project portal together with the web application (Integration: both
 *   installed): the migrations that moved the portal out of the web (its audit log and
 *   permissions) and the sales leads and orders from the web into the portal, and the log
 *   endpoint of the portal.
 * @dependencies
 * - Tests\TestCase, ProjectFixtures; the web tables of the test schema (web_logs, web_site_settings).
 */

namespace Tests\Integration;

use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Models\Core\CorePermission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description The migrations of the portal application, ProjectPortalLogController.
 */
class ProjectPortalApplicationTest extends TestCase
{
    use ProjectFixtures;

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
     * @description The migration that moved the sales leads and orders from the web into the
     *   portal: tables renamed, the order e-mail template moved into the portal settings, the
     *   permissions renamed (same ids - roles keep them) with the tab and settings permissions
     *   granted, the log rows and the browser titles moved; down() reverts it all.
     * @input After down(): web tables with a lead and an order, web_site_settings with a subject
     *   of the order e-mail, web_logs rows WebSalesLead / WebJobApplication, role S with
     *   web-sales-orders-view, role P with web-projects-update, title web.order-form; up(), down().
     * @output up: project_portal_sales_* with the rows, settings subject moved and the web columns
     *   gone, role S with project-portal-sales-orders-view + view-project-portal, role P with
     *   project-portal-settings-*, 1 portal row SalesLead, 1 web row, title
     *   project-portal.order-form (/projects/order/:token). down: web tables and keys again.
     */
    public function test_sales_migration(): void
    {
        $migration = require app_path('Apps/ProjectPortal/Database/Migrations/2026_11_24_000001_sales_leads_and_orders_in_project_portal.php');
        $migration->down();
        $this->assertTrue(Schema::hasTable('web_sales_leads') && Schema::hasColumn('web_site_settings', 'sales_order_email_subject_i18n'));
        $leadId = DB::table('web_sales_leads')->insertGetId(['salesman_name' => 'S', 'subject_name' => 'Acme', 'source_channel' => 'web']);
        DB::table('web_sales_orders')->insert(['lead_id' => $leadId, 'client_name' => 'Acme']);
        DB::table('web_site_settings')->insert(['is_web_active' => true, 'sales_order_email_subject_i18n' => json_encode(['cz' => 'Díky'])]);
        foreach (['WebSalesLead', 'WebJobApplication'] as $module) {
            DB::table('web_logs')->insert(['event_type' => 'update', 'module' => $module, 'description' => "{$module} changed", 'affected_entity_type' => $module, 'affected_entity_id' => 1]);
        }
        $this->permission('view-project-portal', 'project-portal');
        $sales = $this->role('sales', ['web-sales-orders-view']);
        $pm = $this->role('pm', ['web-projects-update']);
        DB::table('legal_page_titles')->where(['area' => 'project-portal', 'page_key' => 'order-form'])->delete();
        DB::table('legal_page_titles')->insert(['area' => 'web', 'page_key' => 'order-form', 'route_path' => '/order_form/:token', 'title_i18n' => '{"cz":"Objednávka"}', 'sort_order' => 1]);

        $migration->up();

        $this->assertFalse(Schema::hasTable('web_sales_leads') || Schema::hasTable('web_sales_orders'));
        $this->assertSame([1, 1], [DB::table('project_portal_sales_leads')->count(), DB::table('project_portal_sales_orders')->count()]);
        $this->assertSame(['cz' => 'Díky'], json_decode(DB::table('project_portal_settings')->value('sales_order_email_subject_i18n'), true));
        $this->assertFalse(Schema::hasColumn('web_site_settings', 'sales_order_email_subject_i18n'));
        $this->assertSame(['project-portal-sales-orders-view', 'view-project-portal'], $sales->permissions()->orderBy('permission_key')->pluck('permission_key')->all());
        $this->assertSame(['project-portal'], CorePermission::where('permission_key', 'like', 'project-portal-sales-%')->distinct()->pluck('module')->all());
        $this->assertSame(['project-portal-settings-update', 'project-portal-settings-view', 'web-projects-update'], $pm->permissions()->orderBy('permission_key')->pluck('permission_key')->all());
        $this->assertSame([['SalesLead', 'SalesLead']], DB::table('project_portal_logs')->get()->map(fn ($row) => [$row->module, $row->affected_entity_type])->all());
        $this->assertSame(['WebJobApplication'], DB::table('web_logs')->pluck('module')->all());
        $this->assertSame('/projects/order/:token', DB::table('legal_page_titles')->where(['area' => 'project-portal', 'page_key' => 'order-form'])->value('route_path'));

        $migration->down();

        $this->assertTrue(Schema::hasTable('web_sales_orders') && !Schema::hasTable('project_portal_settings'));
        $this->assertSame(['view-project-portal', 'web-sales-orders-view'], $sales->permissions()->orderBy('permission_key')->pluck('permission_key')->all());
        $this->assertSame(['WebJobApplication', 'WebSalesLead'], DB::table('web_logs')->orderBy('module')->pluck('module')->all());
        $this->assertSame('/order_form/:token', DB::table('legal_page_titles')->where(['area' => 'web', 'page_key' => 'order-form'])->value('route_path'));
        $migration->up();
    }
}
