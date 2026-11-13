<?php
/**
 * @file shop_site_settings.php
 * @path api/app/Apps/Shop/Database/Seeders/data/shop_site_settings.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Default row of shop_site_settings (singleton id 1): e-shop switched on, maintenance
 *   message and the Czech texts of the order confirmation e-mail (data/shop_order_email.php) -
 *   all editable in the admin.
 *   Generated from the database dump of 2026-10-29; edit by hand from now on.
 */

return [
    'is_shop_active' => 1,
    'maintenance_message' => 'Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.',
] + require __DIR__ . '/shop_order_email.php';
