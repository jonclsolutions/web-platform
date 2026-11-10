<?php
/**
 * @file shop_shipping_methods.php
 * @path api/database/seeders/data/shop_shipping_methods.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Default shipping method of the e-shop (BaseDataSeeder): store pickup - free, active,
 *   it needs no carrier setup, so the checkout works from the start. Further methods (carriers) are
 *   added in the admin; the default one can be edited or deleted there (a deleted one is not
 *   created again). Identified by `code` (the same code as in the former database dump).
 */

return [
    [
        'code' => 'local_pickup', 'name' => 'Osobní odběr na prodejně',
        'description' => 'Objednávku si vyzvednete osobně na naší prodejně. Zdarma.',
        'shipping_type' => 'store', 'base_price' => 0, 'free_shipping_threshold' => null, 'max_weight' => null,
        'requires_pickup_point' => false, 'is_active' => true, 'sort_order' => 1,
    ],
];
