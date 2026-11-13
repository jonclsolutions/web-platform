<?php
/**
 * @file page_titles.php
 * @path api/app/Apps/Shop/Database/Seeders/data/page_titles.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Browser tab titles of the e-shop pages (legal_page_titles): one row per page key of the
 *   Angular routes (`title: 'shop.page_key'`). Rows are never created from the admin - only
 *   here (ShopBaseDataSeeder).
 */

return [
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
        'page_key' => 'tos',
        'route_path' => '/shop/tos',
        'title_i18n' => ['cz' => 'Obchodní podmínky | Company name', 'en' => 'Terms of service | Company name'],
        'sort_order' => 60,
    ],
    [
        'area' => 'shop',
        'page_key' => 'privacy-policy',
        'route_path' => '/shop/privacy-policy',
        'title_i18n' => ['cz' => 'Ochrana osobních údajů | Company name', 'en' => 'Privacy policy | Company name'],
        'sort_order' => 70,
    ],
    [
        'area' => 'shop',
        'page_key' => 'not-found',
        'route_path' => '/shop/<unknown address>',
        'title_i18n' => ['cz' => 'Stránka nenalezena', 'en' => 'Page not found'],
        'sort_order' => 900,
    ],
];
