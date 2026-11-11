<?php
/**
 * @file permissions.php
 * @path api/database/seeders/data/permissions.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Permission keys of the core (core_permissions): key, description, module. The keys
 *   of the modules are in their own data files (Web/data, Shop/data). BaseDataSeeder adds the
 *   missing ones; the sysadmin role gets all keys of the core and the registered modules. The
 *   description is the English fallback - the admin shows the translation of the admin language
 *   (section `permission-descriptions` of the admin i18n files, keyed by permission_key).
 */

return [
    ['permission_key' => 'view-deleted', 'description' => 'View soft-deleted records in the trash across modules', 'module' => 'core'],
    ['permission_key' => 'core-view-welcome-page', 'description' => '[recommended: always on] View the welcome page the user is redirected to right after login', 'module' => 'core'],
    ['permission_key' => 'view-core', 'description' => '[recommended: always on] Show the Core / System tab in the admin menu - without it the section cannot be opened', 'module' => 'core'],
    ['permission_key' => 'core-administrators-view', 'description' => 'View the list of administrator accounts', 'module' => 'core'],
    ['permission_key' => 'core-administrators-create', 'description' => 'Create an administrator account', 'module' => 'core'],
    ['permission_key' => 'core-administrators-update', 'description' => 'Edit an administrator account', 'module' => 'core'],
    ['permission_key' => 'core-administrators-delete', 'description' => 'Delete / restore an administrator account from the trash', 'module' => 'core'],
    ['permission_key' => 'core-external-links-view', 'description' => 'View the external links shown in the admin', 'module' => 'core'],
    ['permission_key' => 'core-external-links-create', 'description' => 'Create an external link', 'module' => 'core'],
    ['permission_key' => 'core-external-links-update', 'description' => 'Edit an external link', 'module' => 'core'],
    ['permission_key' => 'core-external-links-delete', 'description' => 'Delete / restore an external link from the trash', 'module' => 'core'],
    ['permission_key' => 'core-legal-documents-view', 'description' => 'View the legal documents of the web (GDPR, terms, cookies)', 'module' => 'core'],
    ['permission_key' => 'core-legal-documents-create', 'description' => 'Create a legal document section', 'module' => 'core'],
    ['permission_key' => 'core-legal-documents-update', 'description' => 'Edit a legal document section', 'module' => 'core'],
    ['permission_key' => 'core-legal-documents-delete', 'description' => 'Delete a legal document section', 'module' => 'core'],
    ['permission_key' => 'core-legal-config-view', 'description' => 'View the company details and social network links', 'module' => 'core'],
    ['permission_key' => 'core-legal-config-create', 'description' => 'Create a social network link', 'module' => 'core'],
    ['permission_key' => 'core-legal-config-update', 'description' => 'Edit the company details / a social network link', 'module' => 'core'],
    ['permission_key' => 'core-legal-config-delete', 'description' => 'Delete a social network link', 'module' => 'core'],
    ['permission_key' => 'core-security-view', 'description' => 'View the security monitoring (suspicious requests, captcha, throttling)', 'module' => 'core'],
    ['permission_key' => 'core-security-update', 'description' => 'Change the state of a security event (resolved / false positive) and set the log retention', 'module' => 'core'],
    ['permission_key' => 'core-security-delete', 'description' => 'Delete a security event manually or purge old events immediately', 'module' => 'core'],
];
