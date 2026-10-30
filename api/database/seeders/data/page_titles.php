<?php
/**
 * @file page_titles.php
 * @path api/database/seeders/data/page_titles.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-30
 * @description Browser tab titles (legal_page_titles): one row per page key of the Angular routes
 *   (`title: 'area.page_key'`). Rows are never created from the admin - only here.
 *   Generated from the database dump of 2026-10-29; edit by hand from now on.
 */

return [
    [
        'area' => 'admin',
        'page_key' => 'panel',
        'route_path' => '/admin',
        'title_i18n' => ['cz' => 'Administrace | JonclSolutions', 'en' => 'Administration | JonclSolutions'],
        'sort_order' => 10,
    ],
    [
        'area' => 'shop',
        'page_key' => 'catalog',
        'route_path' => '/shop/catalog',
        'title_i18n' => ['cz' => 'E-shop | JonclSolutions', 'en' => 'Shop | JonclSolutions'],
        'sort_order' => 10,
    ],
    [
        'area' => 'shop',
        'page_key' => 'product-detail',
        'route_path' => '/shop/products/:slugOrId',
        'title_i18n' => ['cz' => 'Produkt | JonclSolutions', 'en' => 'Product | JonclSolutions'],
        'sort_order' => 20,
    ],
    [
        'area' => 'shop',
        'page_key' => 'cart',
        'route_path' => '/shop/cart',
        'title_i18n' => ['cz' => 'Košík | JonclSolutions', 'en' => 'Cart | JonclSolutions'],
        'sort_order' => 30,
    ],
    [
        'area' => 'shop',
        'page_key' => 'checkout',
        'route_path' => '/shop/checkout',
        'title_i18n' => ['cz' => 'Pokladna | JonclSolutions', 'en' => 'Checkout | JonclSolutions'],
        'sort_order' => 40,
    ],
    [
        'area' => 'shop',
        'page_key' => 'shop-maintenance',
        'route_path' => '/shop-maintenance',
        'title_i18n' => ['cz' => 'E-shop – údržba | JonclSolutions', 'en' => 'Shop – maintenance | JonclSolutions'],
        'sort_order' => 50,
    ],
    [
        'area' => 'shop',
        'page_key' => 'not-found',
        'route_path' => '/shop/<unknown address>',
        'title_i18n' => ['cz' => 'Stránka nenalezena', 'en' => 'Page not found'],
        'sort_order' => 900,
    ],
    [
        'area' => 'web',
        'page_key' => 'home',
        'route_path' => '/',
        'title_i18n' => ['cz' => 'JonclSolutions | Vývoj softwaru na míru', 'en' => 'JonclSolutions | Custom software development'],
        'sort_order' => 10,
    ],
    [
        'area' => 'web',
        'page_key' => 'services',
        'route_path' => '/services',
        'title_i18n' => ['cz' => 'Služby | JonclSolutions', 'en' => 'Services | JonclSolutions'],
        'sort_order' => 20,
    ],
    [
        'area' => 'web',
        'page_key' => 'references',
        'route_path' => '/references',
        'title_i18n' => ['cz' => 'Realizované projekty | JonclSolutions', 'en' => 'Projects | JonclSolutions'],
        'sort_order' => 30,
    ],
    [
        'area' => 'web',
        'page_key' => 'about-us',
        'route_path' => '/about-us',
        'title_i18n' => ['cz' => 'O nás | JonclSolutions', 'en' => 'About us | JonclSolutions'],
        'sort_order' => 40,
    ],
    [
        'area' => 'web',
        'page_key' => 'contact',
        'route_path' => '/contact',
        'title_i18n' => ['cz' => 'Kontakt | JonclSolutions', 'en' => 'Contact | JonclSolutions'],
        'sort_order' => 50,
    ],
    [
        'area' => 'web',
        'page_key' => 'faq',
        'route_path' => '/faq',
        'title_i18n' => ['cz' => 'Často kladené otázky | JonclSolutions', 'en' => 'FAQ | JonclSolutions'],
        'sort_order' => 60,
    ],
    [
        'area' => 'web',
        'page_key' => 'knowledge-base',
        'route_path' => '/knowledge-base',
        'title_i18n' => ['cz' => 'Centrum nápovědy | JonclSolutions', 'en' => 'Help center | JonclSolutions'],
        'sort_order' => 70,
    ],
    [
        'area' => 'web',
        'page_key' => 'jobs',
        'route_path' => '/jobs',
        'title_i18n' => ['cz' => 'Kariéra | JonclSolutions', 'en' => 'Careers | JonclSolutions'],
        'sort_order' => 80,
    ],
    [
        'area' => 'web',
        'page_key' => 'job-detail',
        'route_path' => '/jobs/:id',
        'title_i18n' => ['cz' => 'Volná pozice | JonclSolutions', 'en' => 'Job opening | JonclSolutions'],
        'sort_order' => 90,
    ],
    [
        'area' => 'web',
        'page_key' => 'order-form',
        'route_path' => '/order_form/:token',
        'title_i18n' => ['cz' => 'Objednávkový formulář | JonclSolutions', 'en' => 'Order form | JonclSolutions'],
        'sort_order' => 100,
    ],
    [
        'area' => 'web',
        'page_key' => 'privacy-policy',
        'route_path' => '/privacy-policy',
        'title_i18n' => ['cz' => 'Ochrana osobních údajů | JonclSolutions', 'en' => 'Privacy policy | JonclSolutions'],
        'sort_order' => 110,
    ],
    [
        'area' => 'web',
        'page_key' => 'tos',
        'route_path' => '/tos',
        'title_i18n' => ['cz' => 'Obchodní podmínky | JonclSolutions', 'en' => 'Terms of service | JonclSolutions'],
        'sort_order' => 120,
    ],
    [
        'area' => 'web',
        'page_key' => 'cookies-policy',
        'route_path' => '/cookies-policy',
        'title_i18n' => ['cz' => 'Zásady cookies | JonclSolutions', 'en' => 'Cookie policy | JonclSolutions'],
        'sort_order' => 130,
    ],
    [
        'area' => 'web',
        'page_key' => 'web-maintenance',
        'route_path' => '/web-maintenance',
        'title_i18n' => ['cz' => 'Probíhá údržba | JonclSolutions', 'en' => 'Under maintenance | JonclSolutions'],
        'sort_order' => 140,
    ],
    [
        'area' => 'web',
        'page_key' => 'not-found',
        'route_path' => '/404',
        'title_i18n' => ['cz' => 'Stránka nenalezena | JonclSolutions', 'en' => 'Page not found | JonclSolutions'],
        'sort_order' => 150,
    ],
    [
        'area' => 'web',
        'page_key' => 'project-portal',
        'route_path' => '/projects/:token',
        'title_i18n' => ['cz' => 'Projektový portál | JonclSolutions', 'en' => 'Project portal | JonclSolutions'],
        'sort_order' => 160,
    ],
];
