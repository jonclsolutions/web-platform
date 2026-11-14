<?php
/**
 * @file 2026_11_24_000001_sales_leads_and_orders_in_project_portal.php
 * @path app/Apps/ProjectPortal/Database/Migrations/2026_11_24_000001_sales_leads_and_orders_in_project_portal.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sales leads and orders (with the public order form) move from the web application
 *   into the project portal, where a lead becomes an order and an order a project:
 *   - tables `web_sales_leads` → `project_portal_sales_leads`, `web_sales_orders` →
 *     `project_portal_sales_orders` (rows, morph alias `sales_order`, attachment files and the
 *     names of their indexes / foreign keys stay);
 *   - the order confirmation e-mail template moves from `web_site_settings` into the new
 *     settings row of the portal `project_portal_settings`;
 *   - the permissions `web-sales-leads-*` / `web-sales-orders-*` are renamed to
 *     `project-portal-sales-leads-*` / `project-portal-sales-orders-*` with the module
 *     `project-portal` (same ids, so roles and accounts keep them); who may see leads or orders
 *     gets the tab `view-project-portal`; the new `project-portal-settings-view` / `-update`
 *     (browser titles of the public pages) go to who may edit projects;
 *   - the lead / order rows of `web_logs` move into `project_portal_logs` (`SalesLead`,
 *     `SalesOrder` instead of `WebSalesLead`, `WebSalesOrder`);
 *   - the browser titles of the order form and of the portal move from the area `web` into the
 *     area `project-portal` (new addresses /projects/order/:token, /projects/:token).
 * @note down() reverses every step.
 * @dependencies web_sales_leads, web_sales_orders, web_site_settings, web_logs,
 *   project_portal_logs, core_permissions, core_role_permissions, user_permissions,
 *   legal_page_titles (area as a string - core migration 2026_11_24_000000).
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, string> Old table name => new table name. */
    private const TABLES = [
        'web_sales_leads'  => 'project_portal_sales_leads',
        'web_sales_orders' => 'project_portal_sales_orders',
    ];

    /** @description Columns of the order e-mail template (moved between the settings tables). */
    private const TEMPLATE_COLUMNS = [
        'sales_order_email_subject_i18n', 'sales_order_email_title_i18n', 'sales_order_email_intro_i18n',
        'sales_order_email_outro_i18n', 'sales_order_email_labels_i18n',
    ];

    /** @description Columns of an audit log row (copied between the logs). */
    private const LOG_COLUMNS = ['created_at', 'origin', 'event_type', 'module', 'description', 'affected_entity_type',
        'affected_entity_id', 'user_id', 'context_data', 'user_id_plain', 'user_plain'];

    /** @var array<string, string> Old log module / entity name => new one. */
    private const LOG_NAMES = ['WebSalesLead' => 'SalesLead', 'WebSalesOrder' => 'SalesOrder'];

    /** @var array<string, array{0: string, 1: string}> Old page title (area.key) => [new area.key, route]. */
    private const PAGE_TITLES = [
        'web.order-form'     => ['project-portal.order-form', '/projects/order/:token'],
        'web.project-portal' => ['project-portal.portal', '/projects/:token'],
    ];

    /** @var array<string, string> Old page title route => route of the moved row (down()). */
    private const OLD_ROUTES = ['web.order-form' => '/order_form/:token', 'web.project-portal' => '/projects/:token'];

    /** @description New permissions (English fallback descriptions) => the permission whose holders get them. */
    private const NEW_PERMISSIONS = [
        'project-portal-settings-view'   => ['View the settings of the portal (browser titles of its public pages)', 'web-projects-update'],
        'project-portal-settings-update' => ['Edit the settings of the portal (browser titles of its public pages)', 'web-projects-update'],
    ];

    /**
     * @description Moves the tables, the template, the permissions, the log rows and the titles.
     * @return void
     */
    public function up(): void
    {
        foreach (self::TABLES as $from => $to) {
            if (Schema::hasTable($from) && !Schema::hasTable($to)) {
                Schema::rename($from, $to);
            }
        }

        Schema::create('project_portal_settings', function (Blueprint $table) {
            $table->increments('id');
            foreach (self::TEMPLATE_COLUMNS as $column) {
                $table->json($column)->nullable();
            }
            $table->timestamps();
        });

        DB::transaction(function () {
            $this->moveTemplateToPortal();
            $this->renamePermissions('web-sales-', 'project-portal-sales-', 'project-portal');
            $this->grant('view-project-portal', ['project-portal-sales-leads-view', 'project-portal-sales-orders-view']);
            foreach (self::NEW_PERMISSIONS as $key => [$description, $source]) {
                if (!DB::table('core_permissions')->where('permission_key', $key)->exists()) {
                    DB::table('core_permissions')->insert(['permission_key' => $key, 'description' => $description, 'module' => 'project-portal']);
                }
                $this->grant($key, [$source]);
            }
            if (Schema::hasTable('web_logs')) {
                $this->moveLogs('web_logs', 'project_portal_logs', self::LOG_NAMES);
            }
            foreach (self::PAGE_TITLES as $old => [$new, $route]) {
                $this->movePageTitle($old, $new, $route);
            }
        });

        if (Schema::hasTable('web_site_settings') && Schema::hasColumn('web_site_settings', self::TEMPLATE_COLUMNS[0])) {
            Schema::table('web_site_settings', function (Blueprint $table) {
                $table->dropColumn(self::TEMPLATE_COLUMNS);
            });
        }
    }

    /**
     * @description Restores the web tables, template columns, permissions, log rows and titles.
     * @return void
     */
    public function down(): void
    {
        if (Schema::hasTable('web_site_settings') && !Schema::hasColumn('web_site_settings', self::TEMPLATE_COLUMNS[0])) {
            Schema::table('web_site_settings', function (Blueprint $table) {
                foreach (self::TEMPLATE_COLUMNS as $column) {
                    $table->json($column)->nullable();
                }
            });
        }

        DB::transaction(function () {
            $settings = DB::table('project_portal_settings')->first();
            if ($settings !== null && Schema::hasTable('web_site_settings')) {
                DB::table('web_site_settings')->update(array_intersect_key((array) $settings, array_flip(self::TEMPLATE_COLUMNS)));
            }
            foreach (self::PAGE_TITLES as $old => [$new]) {
                $this->movePageTitle($new, $old, self::OLD_ROUTES[$old]);
            }
            if (Schema::hasTable('web_logs')) {
                $this->moveLogs('project_portal_logs', 'web_logs', array_flip(self::LOG_NAMES));
            }
            $ids = DB::table('core_permissions')->whereIn('permission_key', array_keys(self::NEW_PERMISSIONS))->pluck('id');
            DB::table('core_role_permissions')->whereIn('permission_id', $ids)->delete();
            DB::table('user_permissions')->whereIn('permission_id', $ids)->delete();
            DB::table('core_permissions')->whereIn('id', $ids)->delete();
            $this->renamePermissions('project-portal-sales-', 'web-sales-', 'web');
        });

        Schema::dropIfExists('project_portal_settings');
        foreach (self::TABLES as $from => $to) {
            if (Schema::hasTable($to) && !Schema::hasTable($from)) {
                Schema::rename($to, $from);
            }
        }
    }

    /**
     * @description Copies the order e-mail template of web_site_settings into the portal settings row.
     * @return void
     */
    private function moveTemplateToPortal(): void
    {
        $values = [];
        if (Schema::hasTable('web_site_settings') && Schema::hasColumn('web_site_settings', self::TEMPLATE_COLUMNS[0])) {
            $values = (array) (DB::table('web_site_settings')->first(self::TEMPLATE_COLUMNS) ?? []);
        }
        if ($values !== []) {
            DB::table('project_portal_settings')->insert($values + ['created_at' => now(), 'updated_at' => now()]);
        }
    }

    /**
     * @description Renames the permission keys with a prefix (ids stay, so do the grants).
     * @param string $from Old key prefix.
     * @param string $to New key prefix.
     * @param string $module Module of the renamed permissions.
     * @return void
     */
    private function renamePermissions(string $from, string $to, string $module): void
    {
        foreach (DB::table('core_permissions')->where('permission_key', 'like', $from . '%')->get(['id', 'permission_key']) as $permission) {
            DB::table('core_permissions')->where('id', $permission->id)->update([
                'permission_key' => $to . substr($permission->permission_key, strlen($from)),
                'module'         => $module,
            ]);
        }
    }

    /**
     * @description Gives a permission to every role / account that holds one of the source
     *   permissions and does not have it yet.
     * @param string $key Permission to give.
     * @param array<int, string> $sources Permissions whose holders get it.
     * @return void
     */
    private function grant(string $key, array $sources): void
    {
        $id = DB::table('core_permissions')->where('permission_key', $key)->value('id');
        $sourceIds = DB::table('core_permissions')->whereIn('permission_key', $sources)->pluck('id');
        if ($id === null || $sourceIds->isEmpty()) {
            return;
        }
        foreach (['core_role_permissions' => 'role_id', 'user_permissions' => 'user_id'] as $table => $owner) {
            $holders = DB::table($table)->whereIn('permission_id', $sourceIds)->distinct()->pluck($owner);
            $has = DB::table($table)->where('permission_id', $id)->pluck($owner)->all();
            $rows = $holders->diff($has)->map(fn ($ownerId) => [$owner => $ownerId, 'permission_id' => $id])->values()->all();
            if ($rows !== []) {
                DB::table($table)->insert($rows);
            }
        }
    }

    /**
     * @description Moves the log rows of the named modules (oldest first) and renames them.
     * @param string $from Source table.
     * @param string $to Target table.
     * @param array<string, string> $names Module / entity name in the source => name in the target.
     * @return void
     */
    private function moveLogs(string $from, string $to, array $names): void
    {
        DB::table($from)->whereIn('module', array_keys($names))->orderBy('id')->chunkById(500, function ($rows) use ($from, $to, $names) {
            $insert = [];
            foreach ($rows as $row) {
                $values = array_intersect_key((array) $row, array_flip(self::LOG_COLUMNS));
                $values['module'] = $names[$values['module']] ?? $values['module'];
                $values['affected_entity_type'] = $names[$values['affected_entity_type'] ?? ''] ?? $values['affected_entity_type'];
                $insert[] = $values;
            }
            DB::table($to)->insert($insert);
            DB::table($from)->whereIn('id', $rows->pluck('id'))->delete();
        });
    }

    /**
     * @description Moves a browser title row to another area / key (kept text), unless the
     *   target exists already.
     * @param string $from Current "area.page_key".
     * @param string $to New "area.page_key".
     * @param string $route Informative route of the moved row.
     * @return void
     */
    private function movePageTitle(string $from, string $to, string $route): void
    {
        [$fromArea, $fromKey] = explode('.', $from, 2);
        [$toArea, $toKey] = explode('.', $to, 2);
        if (DB::table('legal_page_titles')->where('area', $toArea)->where('page_key', $toKey)->exists()) {
            return;
        }
        DB::table('legal_page_titles')->where('area', $fromArea)->where('page_key', $fromKey)
            ->update(['area' => $toArea, 'page_key' => $toKey, 'route_path' => $route]);
    }
};
