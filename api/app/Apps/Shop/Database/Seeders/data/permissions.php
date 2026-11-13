<?php
/**
 * @file permissions.php
 * @path api/app/Apps/Shop/Database/Seeders/data/permissions.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Permission keys of the e-shop module (core_permissions): key, description, module - incl.
 *   the tab permission `view-eshop`. ShopBaseDataSeeder adds the missing ones; the sysadmin role
 *   gets all of them. The description is the English fallback (admin i18n `permission-descriptions`).
 */

return [
    ['permission_key' => 'shop-view-reports', 'description' => 'View e-shop reports and statistics', 'module' => 'shop'],
    ['permission_key' => 'view-eshop', 'description' => '[recommended: always on] Show the E-shop tab in the admin menu - without it the section cannot be opened', 'module' => 'core'],
    ['permission_key' => 'shop-view-dashboard', 'description' => '[recommended: always on] View the dashboard of the e-shop section (default page of the E-shop menu)', 'module' => 'shop'],
    ['permission_key' => 'shop-view-logs', 'description' => 'View the log history (audit trail) of the e-shop', 'module' => 'shop'],
    ['permission_key' => 'shop-set-maintenance-mode', 'description' => 'Switch the e-shop to maintenance mode (closed to customers)', 'module' => 'shop'],
    ['permission_key' => 'shop-products-view', 'description' => 'View e-shop products', 'module' => 'shop'],
    ['permission_key' => 'shop-products-create', 'description' => 'Create an e-shop product', 'module' => 'shop'],
    ['permission_key' => 'shop-products-update', 'description' => 'Edit an e-shop product (including variants and images)', 'module' => 'shop'],
    ['permission_key' => 'shop-products-delete', 'description' => 'Delete / restore an e-shop product from the trash', 'module' => 'shop'],
    ['permission_key' => 'shop-categories-view', 'description' => 'View e-shop product categories', 'module' => 'shop'],
    ['permission_key' => 'shop-categories-create', 'description' => 'Create an e-shop product category', 'module' => 'shop'],
    ['permission_key' => 'shop-categories-update', 'description' => 'Edit an e-shop product category', 'module' => 'shop'],
    ['permission_key' => 'shop-categories-delete', 'description' => 'Delete an e-shop product category', 'module' => 'shop'],
    ['permission_key' => 'shop-customers-view', 'description' => 'View e-shop customers', 'module' => 'shop'],
    ['permission_key' => 'shop-customers-create', 'description' => 'Create an e-shop customer', 'module' => 'shop'],
    ['permission_key' => 'shop-customers-update', 'description' => 'Edit an e-shop customer', 'module' => 'shop'],
    ['permission_key' => 'shop-customers-delete', 'description' => 'Delete / restore an e-shop customer from the trash', 'module' => 'shop'],
    ['permission_key' => 'shop-orders-view', 'description' => 'View e-shop orders', 'module' => 'shop'],
    ['permission_key' => 'shop-orders-create', 'description' => 'Create an e-shop order manually (internally by an administrator)', 'module' => 'shop'],
    ['permission_key' => 'shop-orders-update', 'description' => 'Edit an e-shop order', 'module' => 'shop'],
    ['permission_key' => 'shop-orders-delete', 'description' => 'Delete / restore an e-shop order from the trash', 'module' => 'shop'],
    ['permission_key' => 'shop-suppliers-view', 'description' => 'View e-shop suppliers', 'module' => 'shop'],
    ['permission_key' => 'shop-suppliers-create', 'description' => 'Create an e-shop supplier', 'module' => 'shop'],
    ['permission_key' => 'shop-suppliers-update', 'description' => 'Edit an e-shop supplier', 'module' => 'shop'],
    ['permission_key' => 'shop-suppliers-delete', 'description' => 'Delete / restore an e-shop supplier from the trash', 'module' => 'shop'],
    ['permission_key' => 'shop-shipping-methods-view', 'description' => 'View e-shop shipping methods', 'module' => 'shop'],
    ['permission_key' => 'shop-shipping-methods-create', 'description' => 'Create an e-shop shipping method', 'module' => 'shop'],
    ['permission_key' => 'shop-shipping-methods-update', 'description' => 'Edit an e-shop shipping method', 'module' => 'shop'],
    ['permission_key' => 'shop-shipping-methods-delete', 'description' => 'Delete / restore an e-shop shipping method from the trash', 'module' => 'shop'],
    ['permission_key' => 'shop-payment-methods-view', 'description' => 'View e-shop payment methods', 'module' => 'shop'],
    ['permission_key' => 'shop-payment-methods-update', 'description' => 'Edit an e-shop payment method', 'module' => 'shop'],
    ['permission_key' => 'shop-coupons-view', 'description' => 'View e-shop discount coupons', 'module' => 'shop'],
    ['permission_key' => 'shop-coupons-create', 'description' => 'Create an e-shop discount coupon', 'module' => 'shop'],
    ['permission_key' => 'shop-coupons-update', 'description' => 'Edit an e-shop discount coupon', 'module' => 'shop'],
    ['permission_key' => 'shop-coupons-delete', 'description' => 'Delete / restore an e-shop discount coupon from the trash', 'module' => 'shop'],
    ['permission_key' => 'shop-edit-eshop-view', 'description' => 'View the management page of the public e-shop texts', 'module' => 'shop'],
    ['permission_key' => 'shop-edit-eshop-update', 'description' => 'Edit the public e-shop texts (translations, languages)', 'module' => 'shop'],
    ['permission_key' => 'shop-welcome-page-view', 'description' => 'View the welcome page of the e-shop section', 'module' => 'shop'],
];
