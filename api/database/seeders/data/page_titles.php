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
 * @refactor-note (2026-10-31) Neutral defaults: the brand "JonclSolutions" replaced by the
 *   placeholder "Company name" (same as the default company details) - the operator renames
 *   it in admin → Web settings → Page titles. Existing rows are never overwritten.
 */

return [
    [
        'area' => 'admin',
        'page_key' => 'panel',
        'route_path' => '/admin',
        'title_i18n' => ['cz' => 'Administrace | Company name', 'en' => 'Administration | Company name'],
        'sort_order' => 10,
    ],
    [
        'area' => 'shop',
        'page_key' => 'catalog',
        'route_path' => '/shop/catalog',
        'title_i18n' => ['cz' => 'E-shop | Company name', 'en' => 'Shop | Company name'],
        'sort_order' => 10,
    ],
    [
        'area' => 'shop',
        'page_key' => 'product-detail',
        'route_path' => '/shop/products/:slugOrId',
        'title_i18n' => ['cz' => 'Produkt | Company name', 'en' => 'Product | Company name'],
        'sort_order' => 20,
    ],
    [
        'area' => 'shop',
        'page_key' => 'cart',
        'route_path' => '/shop/cart',
        'title_i18n' => ['cz' => 'Košík | Company name', 'en' => 'Cart | Company name'],
        'sort_order' => 30,
    ],
    [
        'area' => 'shop',
        'page_key' => 'checkout',
        'route_path' => '/shop/checkout',
        'title_i18n' => ['cz' => 'Pokladna | Company name', 'en' => 'Checkout | Company name'],
        'sort_order' => 40,
    ],
    [
        'area' => 'shop',
        'page_key' => 'shop-maintenance',
        'route_path' => '/shop-maintenance',
        'title_i18n' => ['cz' => 'E-shop – údržba | Company name', 'en' => 'Shop – maintenance | Company name'],
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
        'title_i18n' => ['cz' => 'Úvod | Company name', 'en' => 'Home | Company name'],
        'sort_order' => 10,
    ],
    [
        'area' => 'web',
        'page_key' => 'services',
        'route_path' => '/services',
        'title_i18n' => ['cz' => 'Služby | Company name', 'en' => 'Services | Company name'],
        'sort_order' => 20,
    ],
    [
        'area' => 'web',
        'page_key' => 'references',
        'route_path' => '/references',
        'title_i18n' => ['cz' => 'Realizované projekty | Company name', 'en' => 'Projects | Company name'],
        'sort_order' => 30,
    ],
    [
        'area' => 'web',
        'page_key' => 'about-us',
        'route_path' => '/about-us',
        'title_i18n' => ['cz' => 'O nás | Company name', 'en' => 'About us | Company name'],
        'sort_order' => 40,
    ],
    [
        'area' => 'web',
        'page_key' => 'contact',
        'route_path' => '/contact',
        'title_i18n' => ['cz' => 'Kontakt | Company name', 'en' => 'Contact | Company name'],
        'sort_order' => 50,
    ],
    [
        'area' => 'web',
        'page_key' => 'faq',
        'route_path' => '/faq',
        'title_i18n' => ['cz' => 'Často kladené otázky | Company name', 'en' => 'FAQ | Company name'],
        'sort_order' => 60,
    ],
    [
        'area' => 'web',
        'page_key' => 'knowledge-base',
        'route_path' => '/knowledge-base',
        'title_i18n' => ['cz' => 'Centrum nápovědy | Company name', 'en' => 'Help center | Company name'],
        'sort_order' => 70,
    ],
    [
        'area' => 'web',
        'page_key' => 'jobs',
        'route_path' => '/jobs',
        'title_i18n' => ['cz' => 'Kariéra | Company name', 'en' => 'Careers | Company name'],
        'sort_order' => 80,
    ],
    [
        'area' => 'web',
        'page_key' => 'job-detail',
        'route_path' => '/jobs/:id',
        'title_i18n' => ['cz' => 'Volná pozice | Company name', 'en' => 'Job opening | Company name'],
        'sort_order' => 90,
    ],
    [
        'area' => 'web',
        'page_key' => 'order-form',
        'route_path' => '/order_form/:token',
        'title_i18n' => ['cz' => 'Objednávkový formulář | Company name', 'en' => 'Order form | Company name'],
        'sort_order' => 100,
    ],
    [
        'area' => 'web',
        'page_key' => 'privacy-policy',
        'route_path' => '/privacy-policy',
        'title_i18n' => ['cz' => 'Ochrana osobních údajů | Company name', 'en' => 'Privacy policy | Company name'],
        'sort_order' => 110,
    ],
    [
        'area' => 'web',
        'page_key' => 'tos',
        'route_path' => '/tos',
        'title_i18n' => ['cz' => 'Obchodní podmínky | Company name', 'en' => 'Terms of service | Company name'],
        'sort_order' => 120,
    ],
    [
        'area' => 'web',
        'page_key' => 'cookies-policy',
        'route_path' => '/cookies-policy',
        'title_i18n' => ['cz' => 'Zásady cookies | Company name', 'en' => 'Cookie policy | Company name'],
        'sort_order' => 130,
    ],
    [
        'area' => 'web',
        'page_key' => 'web-maintenance',
        'route_path' => '/web-maintenance',
        'title_i18n' => ['cz' => 'Probíhá údržba | Company name', 'en' => 'Under maintenance | Company name'],
        'sort_order' => 140,
    ],
    [
        'area' => 'web',
        'page_key' => 'not-found',
        'route_path' => '/404',
        'title_i18n' => ['cz' => 'Stránka nenalezena | Company name', 'en' => 'Page not found | Company name'],
        'sort_order' => 150,
    ],
    [
        'area' => 'web',
        'page_key' => 'project-portal',
        'route_path' => '/projects/:token',
        'title_i18n' => ['cz' => 'Projektový portál | Company name', 'en' => 'Project portal | Company name'],
        'sort_order' => 160,
    ],
];
