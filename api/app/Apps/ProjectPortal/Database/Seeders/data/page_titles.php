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
 *   (ProjectPortalBaseDataSeeder); the admin edits their texts (project-portal/settings).
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
        'page_key' => 'order-form',
        'route_path' => '/projects/order/:token',
        'title_i18n' => ['cz' => 'Objednávkový formulář | Company name', 'en' => 'Order form | Company name'],
        'sort_order' => 20,
    ],
];
