<?php
/**
 * @file permissions.php
 * @path api/app/Apps/Web/Database/Seeders/data/permissions.php
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
    ['permission_key' => 'view-web', 'description' => '[recommended: always on] Show the Web tab in the admin menu - without it the section cannot be opened', 'module' => 'web'],
    ['permission_key' => 'web-set-maintenance-mode', 'description' => 'Switch the web to maintenance mode (closed to the public)', 'module' => 'web'],
    ['permission_key' => 'web-job-applications-view', 'description' => 'View applicants who responded to a job offer', 'module' => 'web'],
    ['permission_key' => 'web-job-applications-create', 'description' => 'Create an applicant record manually (internally by an administrator)', 'module' => 'web'],
    ['permission_key' => 'web-job-applications-update', 'description' => 'Edit an applicant record', 'module' => 'web'],
    ['permission_key' => 'web-job-applications-delete', 'description' => 'Delete / restore an applicant record from the trash', 'module' => 'web'],
    ['permission_key' => 'web-user-requests-view', 'description' => 'View inquiries sent through the web contact form', 'module' => 'web'],
    ['permission_key' => 'web-user-requests-create', 'description' => 'Create an inquiry manually (internally by an administrator)', 'module' => 'web'],
    ['permission_key' => 'web-user-requests-update', 'description' => 'Edit an inquiry (e.g. its status) and its confirmation e-mail template', 'module' => 'web'],
    ['permission_key' => 'web-user-requests-delete', 'description' => 'Delete / restore an inquiry from the trash', 'module' => 'web'],
    ['permission_key' => 'web-edit-website-view', 'description' => 'View the management page of the public web texts', 'module' => 'web'],
    ['permission_key' => 'web-edit-website-update', 'description' => 'Edit the public web texts (translations, languages)', 'module' => 'web'],
    ['permission_key' => 'web-welcome-page-view', 'description' => 'View the welcome page of the web section', 'module' => 'web'],
];
