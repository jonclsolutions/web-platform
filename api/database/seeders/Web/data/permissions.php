<?php
/**
 * @file permissions.php
 * @path api/database/seeders/Web/data/permissions.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Permission keys of the web module (core_permissions): key, description, module - incl.
 *   the tab permission `view-web`. WebBaseDataSeeder adds the missing ones; the sysadmin role gets
 *   all of them. The description is the English fallback (admin i18n `permission-descriptions`).
 */

return [
    ['permission_key' => 'web-view-web-logs', 'description' => 'View the log history (audit trail) of the web section', 'module' => 'web'],
    ['permission_key' => 'web-view-dashboard', 'description' => '[recommended: always on] View the dashboard of the web section (default page of the Web menu)', 'module' => 'web'],
    ['permission_key' => 'view-web', 'description' => '[recommended: always on] Show the Web tab in the admin menu - without it the section cannot be opened', 'module' => 'core'],
    ['permission_key' => 'web-set-maintenance-mode', 'description' => 'Switch the web to maintenance mode (closed to the public)', 'module' => 'web'],
    ['permission_key' => 'web-sales-leads-view', 'description' => 'View sales leads (contacts of potential customers)', 'module' => 'web'],
    ['permission_key' => 'web-sales-leads-create', 'description' => 'Create a sales lead manually (internally by an administrator)', 'module' => 'web'],
    ['permission_key' => 'web-sales-leads-update', 'description' => 'Edit a sales lead', 'module' => 'web'],
    ['permission_key' => 'web-sales-leads-delete', 'description' => 'Delete / restore a sales lead from the trash', 'module' => 'web'],
    ['permission_key' => 'web-sales-orders-view', 'description' => 'View orders received through the web order form', 'module' => 'web'],
    ['permission_key' => 'web-sales-orders-create', 'description' => 'Create an order manually (internally by an administrator)', 'module' => 'web'],
    ['permission_key' => 'web-sales-orders-update', 'description' => 'Edit an order and its confirmation e-mail template', 'module' => 'web'],
    ['permission_key' => 'web-sales-orders-delete', 'description' => 'Delete / restore an order from the trash', 'module' => 'web'],
    ['permission_key' => 'web-job-applications-view', 'description' => 'View applicants who responded to a job offer', 'module' => 'web'],
    ['permission_key' => 'web-job-applications-create', 'description' => 'Create an applicant record manually (internally by an administrator)', 'module' => 'web'],
    ['permission_key' => 'web-job-applications-update', 'description' => 'Edit an applicant record', 'module' => 'web'],
    ['permission_key' => 'web-job-applications-delete', 'description' => 'Delete / restore an applicant record from the trash', 'module' => 'web'],
    ['permission_key' => 'web-user-requests-view', 'description' => 'View inquiries sent through the web contact form', 'module' => 'web'],
    ['permission_key' => 'web-user-requests-create', 'description' => 'Create an inquiry manually (internally by an administrator)', 'module' => 'web'],
    ['permission_key' => 'web-user-requests-update', 'description' => 'Edit an inquiry (e.g. its status) and its confirmation e-mail template', 'module' => 'web'],
    ['permission_key' => 'web-user-requests-delete', 'description' => 'Delete / restore an inquiry from the trash', 'module' => 'web'],
    ['permission_key' => 'web-projects-view', 'description' => 'View the list and detail of customer projects', 'module' => 'web'],
    ['permission_key' => 'web-projects-create', 'description' => 'Create a customer project (standalone or from an order)', 'module' => 'web'],
    ['permission_key' => 'web-projects-update', 'description' => 'Edit a project, its checkpoints and access password and answer customer requests', 'module' => 'web'],
    ['permission_key' => 'web-projects-delete', 'description' => 'Delete customer projects (also in bulk)', 'module' => 'web'],
    ['permission_key' => 'web-edit-website-view', 'description' => 'View the management page of the public web texts', 'module' => 'web'],
    ['permission_key' => 'web-edit-website-update', 'description' => 'Edit the public web texts (translations, languages)', 'module' => 'web'],
    ['permission_key' => 'web-welcome-page-view', 'description' => 'View the welcome page of the web section', 'module' => 'web'],
];
