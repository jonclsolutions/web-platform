<?php
/**
 * @file permissions.php
 * @path api/app/Apps/ProjectPortal/Database/Seeders/data/permissions.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Permission keys of the project portal (core_permissions): key, description, module -
 *   incl. the tab permission `view-project-portal`. ProjectPortalBaseDataSeeder adds the missing
 *   ones; the sysadmin role gets all of them. The description is the English fallback (admin i18n
 *   `permission-descriptions`).
 * @note The `project-portal-projects-*` keys keep their names (roles of existing installations stay valid);
 *   only their module is `project-portal`.
 */

return [
    ['permission_key' => 'view-project-portal', 'description' => '[recommended: always on] Show the Project portal application in the admin - without it the application cannot be opened', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-view-logs', 'description' => 'View the log history (audit trail) of the project portal', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-settings-view', 'description' => 'View the settings of the portal (browser titles of its public pages)', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-settings-update', 'description' => 'Edit the settings of the portal (browser titles of its public pages)', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-sales-leads-view', 'description' => 'View sales leads (contacts of potential customers)', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-sales-leads-create', 'description' => 'Create a sales lead manually (internally by an administrator)', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-sales-leads-update', 'description' => 'Edit a sales lead and send it the link to the order form', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-sales-leads-delete', 'description' => 'Delete / restore a sales lead from the trash', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-sales-orders-view', 'description' => 'View orders received through the order form', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-sales-orders-create', 'description' => 'Create an order manually (internally by an administrator)', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-sales-orders-update', 'description' => 'Edit an order and its confirmation e-mail template', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-sales-orders-delete', 'description' => 'Delete / restore an order from the trash', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-projects-view', 'description' => 'View the list and detail of customer projects', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-projects-create', 'description' => 'Create a customer project (standalone or from an order)', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-projects-update', 'description' => 'Edit a project, its checkpoints and client accounts and answer customer requests', 'module' => 'project-portal'],
    ['permission_key' => 'project-portal-projects-delete', 'description' => 'Delete customer projects (also in bulk)', 'module' => 'project-portal'],
];
