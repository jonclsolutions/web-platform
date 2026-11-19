<?php
/**
 * @file page_titles.php
 * @path api/app/Apps/ProjectPortal/Database/Seeders/data/page_titles.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Browser tab titles of the public pages of the portal (legal_page_titles, area
 *   `project-portal`): one row per page key of the Angular routes
 *   (`title: 'project-portal.page_key'`). Rows are never created from the admin - only here
 *   (ProjectPortalBaseDataSeeder - a missing row is added on the next deploy, existing texts stay);
 *   the admin edits their texts (project-portal/settings).
 */

return [
    [
        'area' => 'project-portal',
        'page_key' => 'portal',
        'route_path' => '/projects/:token',
        'title_i18n' => ['cz' => 'Projektový portál | Company name', 'en' => 'Project portal | Company name'],
        'sort_order' => 10,
    ],
    [
        'area' => 'project-portal',
        'page_key' => 'login',
        'route_path' => '/projects/login/:token',
        'title_i18n' => ['cz' => 'Přihlášení do projektového portálu | Company name', 'en' => 'Sign in to the project portal | Company name'],
        'sort_order' => 15,
    ],
    [
        'area' => 'project-portal',
        'page_key' => 'order-form',
        'route_path' => '/projects/order/:token',
        'title_i18n' => ['cz' => 'Objednávkový formulář | Company name', 'en' => 'Order form | Company name'],
        'sort_order' => 20,
    ],
    [
        'area' => 'project-portal',
        'page_key' => 'maintenance',
        'route_path' => '/projects/maintenance',
        'title_i18n' => ['cz' => 'Probíhá údržba | Company name', 'en' => 'Maintenance | Company name'],
        'sort_order' => 30,
    ],
];
