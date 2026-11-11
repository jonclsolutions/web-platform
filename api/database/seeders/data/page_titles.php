<?php
/**
 * @file page_titles.php
 * @path api/database/seeders/data/page_titles.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Browser tab titles of the admin (legal_page_titles, area `admin`): one row per
 *   page key of the Angular routes (`title: 'admin.page_key'`). The titles of the web and the e-shop
 *   are in their module data files (Web/data, Shop/data). Rows are never created from the admin -
 *   only here. Generated from the database dump of 2026-10-29; edit by hand from now on.
 */

return [
    [
        'area' => 'admin',
        'page_key' => 'panel',
        'route_path' => '/admin',
        'title_i18n' => ['cz' => 'Administrace | Company name', 'en' => 'Administration | Company name'],
        'sort_order' => 10,
    ],
];
